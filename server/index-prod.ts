import "./lib/loadEnv.js";
import * as Sentry from "@sentry/node";
import { nodeProfilingIntegration } from "@sentry/profiling-node";
import fs from "node:fs";
import { type Server } from "node:http";
import path from "node:path";

import express from "express";
import type { Express, Request, Response, NextFunction } from "express";

import runApp from "./app.js";
import { config, validateConfig } from "./config.js";
import { loadSecretsFromDatabase } from "./lib/secretsLoader.js";
import { validateDatabase } from "./startup.js";
import { initializeEnv } from "./lib/loadEnv.js";
import { getEnvironmentBadge } from "../db/validateDatabase.js";
import {
  // extractDetectiveRouteParams,
  getDetectiveBySlugForSEO,
  getServiceBySlugForSEO,
  getDetectiveLocationSeo,
  injectSeoTags,
  injectServiceSeoTags,
  extractLocationRouteParams,
  getLocationDetectivesForSEO,
  // injectLocationSeoTags,
  // injectDetectiveLocationAuthorityLink,
  resolveLocationIds,
  generateDetectiveSeo,
  getServiceLocationSeo,
  generateServiceLocationSeo,
  buildDetectiveListingSsrFragment,
  buildServiceLocationSsrFragment,
  buildArticleSsrFragment,
  buildCmsPageSsrFragment,
  stripHiddenSeoH1,
} from "./lib/seo-injection.js";
import { getPublishedCmsPageSeo, injectCmsPageSeoTags } from "./lib/cms-page-seo.js";
import { pool } from "../db/index.js";
import { storage } from "./storage.js";
import { buildServiceCardDTO } from "../utils/buildServiceCardDTO.js";
import { isKnownSpaPath, isStaticAssetPath } from "./lib/spa-route-manifest.js";

const STATIC_CMS_SEO_SLUGS = new Set([
  "about",
  "contact",
  "support",
  "privacy",
  "terms",
  "packages",
  "categories",
]);

const SERVICE_CATEGORY_SLUG_CACHE_TTL_MS = 10 * 60 * 1000;
const serviceCategorySlugCache = new Map<string, { canonicalSlug: string; expires: number }>();

const NON_CRITICAL_PRELOAD_HREF_PATTERN = /<link\b[^>]*rel=["']modulepreload["'][^>]*href=["']\/assets\/(?:radix-ui|icons)-[^"']+\.js["'][^>]*>\s*/gi;

function isPublicSeoRoutePath(pathname: string): boolean {
  if (pathname === "/") return true;

  const seoPrefixes = [
    "/detectives",
    "/locations",
    "/news",
    "/blog",
    "/category",
  ];

  if (seoPrefixes.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`))) {
    return true;
  }

  return STATIC_CMS_SEO_SLUGS.has(pathname.replace(/^\/+|\/+$/g, ""));
}

function stripNonCriticalModulePreloads(html: string): string {
  if (!html.includes("modulepreload")) {
    return html;
  }

  return html.replace(NON_CRITICAL_PRELOAD_HREF_PATTERN, "");
}

function applyPublicSeoPreloadFiltering(html: string, pathname: string): string {
  if (!isPublicSeoRoutePath(pathname)) {
    return html;
  }

  return stripNonCriticalModulePreloads(html);
}

function sendIndexHtmlResponse(
  req: Request,
  res: Response,
  html: string,
  cacheControl: string,
  extraHeaders?: Record<string, string>,
): void {
  const filteredHtml = applyPublicSeoPreloadFiltering(html, req.path || "/");
  res.setHeader("Cache-Control", cacheControl);
  res.setHeader("Content-Type", "text/html; charset=utf-8");

  if (extraHeaders) {
    for (const [key, value] of Object.entries(extraHeaders)) {
      res.setHeader(key, value);
    }
  }

  res.send(filteredHtml);
}

function toInlineJson(value: unknown): string {
  return JSON.stringify(value)
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/&/g, "\\u0026")
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029");
}

function injectScriptPayloads(
  html: string,
  payloads: Array<{ globalName: string; data: unknown }>,
): string {
  if (!payloads.length) {
    return html;
  }

  const scriptContent = payloads
    .map(({ globalName, data }) => `window.${globalName} = ${toInlineJson(data)};`)
    .join("\n");

  const scriptTag = `<script>\n${scriptContent}\n</script>`;
  return html.replace("</head>", `${scriptTag}\n</head>`);
}

type BreadcrumbItem = {
  name: string;
  url: string;
};

type PageSchemaType = "WebPage" | "CollectionPage" | "ProfilePage";

const SSR_SCHEMA_META_NAME = "askdetectives:ssr-schema";

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function buildBreadcrumbListSchema(items: BreadcrumbItem[]): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item: item.url,
    })),
  };
}

function buildPageSchema(
  pageType: PageSchemaType,
  name: string,
  description: string,
  canonicalUrl: string,
): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": pageType,
    "@id": `${canonicalUrl}#webpage`,
    url: canonicalUrl,
    name,
    description,
    isPartOf: {
      "@type": "WebSite",
      "@id": "https://www.askdetectives.com/#website",
      url: "https://www.askdetectives.com/",
      name: "Ask Detectives",
    },
    inLanguage: "en-US",
  };
}

function injectPhase1Schemas(
  html: string,
  input: {
    canonicalUrl: string;
    pageType: PageSchemaType;
    pageName: string;
    pageDescription: string;
    breadcrumbs: BreadcrumbItem[];
  },
): string {
  const breadcrumbSchema = buildBreadcrumbListSchema(input.breadcrumbs);
  const pageSchema = buildPageSchema(
    input.pageType,
    input.pageName,
    input.pageDescription,
    input.canonicalUrl,
  );

  const markerTag = `<meta name="${SSR_SCHEMA_META_NAME}" content="authoritative" data-ssr-schema-owner="phase1" />`;
  const scripts = [breadcrumbSchema, pageSchema]
    .map((schema) => `<script type="application/ld+json" data-ssr-schema-owner="phase1">\n${toInlineJson(schema)}\n</script>`)
    .join("\n");

  const stripped = html
    .replace(new RegExp(`<meta\\s+name=["']${SSR_SCHEMA_META_NAME}["'][^>]*>`, "gi"), "")
    .replace(/<script\s+type=["']application\/ld\+json["'][^>]*data-ssr-schema-owner=["']phase1["'][^>]*>[\s\S]*?<\/script>/gi, "");

  return stripped.replace("</head>", `${markerTag}\n${scripts}\n</head>`);
}

// ---------------------------------------------------------------------------
// Phase 2: Article / NewsArticle schema (news detail pages only)
// ---------------------------------------------------------------------------

type ArticleSchemaInput = {
  canonicalUrl: string;
  headline: string;
  description: string;
  publishedAt: string;           // ISO 8601
  modifiedAt?: string;           // ISO 8601 — falls back to publishedAt
  thumbnail?: string | null;
  authorName?: string | null;
  authorSlug?: string | null;    // used to build author URL when available
  category?: string | null;
};

function buildArticleSchema(input: ArticleSchemaInput): Record<string, unknown> {
  const authorUrl = input.authorSlug
    ? `https://www.askdetectives.com/detectives/${input.authorSlug}/`
    : "https://www.askdetectives.com/";

  const author: Record<string, unknown> = {
    "@type": "Person",
    name: input.authorName || "Ask Detectives",
    url: authorUrl,
  };

  const schema: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "NewsArticle",
    "@id": `${input.canonicalUrl}#article`,
    headline: input.headline,
    description: input.description,
    url: input.canonicalUrl,
    datePublished: input.publishedAt,
    dateModified: input.modifiedAt || input.publishedAt,
    author,
    publisher: {
      "@type": "Organization",
      name: "Ask Detectives",
      url: "https://www.askdetectives.com/",
      logo: {
        "@type": "ImageObject",
        url: "https://www.askdetectives.com/favicon.png",
        width: 32,
        height: 32,
      },
    },
    mainEntityOfPage: {
      "@type": "WebPage",
      "@id": `${input.canonicalUrl}#webpage`,
    },
    inLanguage: "en-US",
    isPartOf: {
      "@type": "WebSite",
      "@id": "https://www.askdetectives.com/#website",
      url: "https://www.askdetectives.com/",
      name: "Ask Detectives",
    },
  };

  if (input.thumbnail) {
    schema.image = {
      "@type": "ImageObject",
      url: input.thumbnail,
    };
  }

  if (input.category) {
    schema.articleSection = input.category;
  }

  return schema;
}

/**
 * Injects a single NewsArticle JSON-LD script tagged with phase2 ownership.
 * The SSR-authoritative meta marker is ALREADY set by injectPhase1Schemas on
 * the same response — this function only appends the article schema block and
 * MUST be called AFTER injectPhase1Schemas.
 */
function injectPhase2ArticleSchema(html: string, input: ArticleSchemaInput): string {
  const articleSchema = buildArticleSchema(input);

  // Strip any pre-existing phase2 article block (idempotent / re-render safe)
  const stripped = html.replace(
    /<script\s+type=["']application\/ld\+json["'][^>]*data-ssr-schema-owner=["']phase2["'][^>]*>[\s\S]*?<\/script>/gi,
    "",
  );

  const scriptTag = `<script type="application/ld+json" data-ssr-schema-owner="phase2">\n${toInlineJson(articleSchema)}\n</script>`;

  return stripped.replace("</head>", `${scriptTag}\n</head>`);
}

type ServiceSchemaInput = {
  canonicalUrl: string;
  serviceTitle: string;
  description: string;
  category: string;
  detectiveName: string;
  countryName: string;
  cityName: string;
  stateName: string;
  countrySlug: string;
  isOnEnquiry: boolean;
  basePrice: number | null;
  offerPrice: number | null;
  avgRating: number;
  reviewCount: number;
};

function getPriceCurrencyFromCountrySlug(countrySlug: string): string {
  const key = (countrySlug || "").trim().toLowerCase();
  const map: Record<string, string> = {
    india: "INR",
    in: "INR",
    united-kingdom: "GBP",
    uk: "GBP",
    gb: "GBP",
    united-states: "USD",
    usa: "USD",
    us: "USD",
    australia: "AUD",
    au: "AUD",
    canada: "CAD",
    ca: "CAD",
    uae: "AED",
    united-arab-emirates: "AED",
    singapore: "SGD",
    sg: "SGD",
    pakistan: "PKR",
    pk: "PKR",
  };
  return map[key] || "USD";
}

function buildServiceDetailSchema(input: ServiceSchemaInput): Record<string, unknown> | null {
  const serviceTitle = (input.serviceTitle || "").trim();
  const description = (input.description || "").trim();
  const detectiveName = (input.detectiveName || "").trim();
  if (!serviceTitle || !description || !detectiveName) return null;

  const schema: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "Service",
    "@id": `${input.canonicalUrl}#service`,
    name: serviceTitle,
    description,
    url: input.canonicalUrl,
    mainEntityOfPage: {
      "@type": "WebPage",
      "@id": `${input.canonicalUrl}#webpage`,
    },
    provider: {
      "@type": "Organization",
      name: detectiveName,
      areaServed: {
        "@type": "Place",
        name: [input.cityName, input.stateName, input.countryName].filter(Boolean).join(", "),
      },
    },
    serviceType: (input.category || "").trim() || "Private Investigation",
    areaServed: {
      "@type": "Place",
      name: [input.cityName, input.stateName, input.countryName].filter(Boolean).join(", "),
    },
    inLanguage: "en-US",
  };

  const basePrice = Number(input.basePrice);
  const offerPrice = Number(input.offerPrice);
  const hasBasePrice = Number.isFinite(basePrice) && basePrice > 0;
  const hasOfferPrice = Number.isFinite(offerPrice) && offerPrice > 0;
  if (!input.isOnEnquiry && (hasOfferPrice || hasBasePrice)) {
    const finalPrice = hasOfferPrice ? offerPrice : basePrice;
    schema.offers = {
      "@type": "Offer",
      url: input.canonicalUrl,
      price: finalPrice,
      priceCurrency: getPriceCurrencyFromCountrySlug(input.countrySlug),
      availability: "https://schema.org/InStock",
    };
  }

  const reviewCount = Math.round(Number(input.reviewCount));
  const ratingValue = Math.round(Number(input.avgRating) * 10) / 10;
  if (
    Number.isFinite(reviewCount) &&
    reviewCount > 0 &&
    Number.isFinite(ratingValue) &&
    ratingValue >= 1 &&
    ratingValue <= 5
  ) {
    schema.aggregateRating = {
      "@type": "AggregateRating",
      ratingValue,
      bestRating: 5,
      worstRating: 1,
      reviewCount,
    };
  }

  return schema;
}

function injectPhase5ServiceSchema(html: string, input: ServiceSchemaInput): string {
  const serviceSchema = buildServiceDetailSchema(input);
  if (!serviceSchema) return html;

  const stripped = html.replace(
    /<script\s+type=["']application\/ld\+json["'][^>]*data-ssr-schema-owner=["']phase5-service["'][^>]*>[\s\S]*?<\/script>/gi,
    "",
  );

  const scriptTag = `<script type="application/ld+json" data-ssr-schema-owner="phase5-service">\n${toInlineJson(serviceSchema)}\n</script>`;
  return stripped.replace("</head>", `${scriptTag}\n</head>`);
}

function buildArchiveSsrFragment(input: {
  heading: string;
  subtitle: string;
  breadcrumbs: BreadcrumbItem[];
}): string {
  const breadcrumbItems = input.breadcrumbs
    .map((crumb, index) => {
      const isLast = index === input.breadcrumbs.length - 1;
      if (isLast) {
        return `<li style="display:inline;"><span style="color:#374151;">${escapeHtml(crumb.name)}</span></li>`;
      }
      return `<li style="display:inline;"><a href="${escapeHtml(crumb.url)}" style="color:#1d4ed8;text-decoration:none;">${escapeHtml(crumb.name)}</a><span style="margin:0 6px;color:#9ca3af;">/</span></li>`;
    })
    .join("");

  return [
    `<section data-ssr-fragment="archive" style="max-width:960px;margin:16px auto 8px;padding:0 24px;">`,
    `<nav aria-label="Breadcrumb" style="margin-bottom:10px;"><ol style="display:flex;gap:0;flex-wrap:wrap;list-style:none;padding:0;margin:0;font-size:0.875rem;">${breadcrumbItems}</ol></nav>`,
    `<h1 style="margin:0 0 8px 0;font-size:2rem;line-height:1.25;color:#111827;">${escapeHtml(input.heading)}</h1>`,
    `<p style="margin:0;color:#4b5563;line-height:1.6;">${escapeHtml(input.subtitle)}</p>`,
    `</section>`,
  ].join("\n");
}

function injectFragmentBeforeRoot(html: string, fragmentHtml: string): string {
  const markedFragmentHtml = /data-ssr-fragment\s*=/.test(fragmentHtml)
    ? fragmentHtml
    : `<section data-ssr-fragment="generic">${fragmentHtml}</section>`;

  const rootMarker = '<div id="root"><!--app-html--></div>';
  if (html.includes(rootMarker)) {
    return html.replace(rootMarker, `${markedFragmentHtml}\n${rootMarker}`);
  }

  return html.replace("<body>", `<body>\n${markedFragmentHtml}`);
}

function generateServiceCategorySlug(text: string): string {
  return text
    .toString()
    .normalize("NFKD")
    .toLowerCase()
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

async function resolveCanonicalServiceCategorySlug(slug: string): Promise<string | null> {
  const now = Date.now();
  const cached = serviceCategorySlugCache.get(slug);
  if (cached && cached.expires > now) {
    return cached.canonicalSlug;
  }

  serviceCategorySlugCache.clear();
  const categories = await storage.getAllServiceCategories(false);
  for (const category of categories) {
    const canonicalSlug = generateServiceCategorySlug(category.name);
    const variants = new Set([
      canonicalSlug,
      category.name.toLowerCase().replace(/\s+/g, "-"),
      `${category.name.toLowerCase().replace(/\s+/g, "-")}s`,
      `${canonicalSlug}s`,
      category.name.toLowerCase().replace(/[^a-z0-9]/g, "-").replace(/-+/g, "-"),
    ]);

    for (const variant of variants) {
      if (!variant) continue;
      serviceCategorySlugCache.set(variant, {
        canonicalSlug,
        expires: now + SERVICE_CATEGORY_SLUG_CACHE_TTL_MS,
      });
    }
  }

  return serviceCategorySlugCache.get(slug)?.canonicalSlug || null;
}

async function getCategoryIdFromHierarchicalSlug(slugPath: string): Promise<string | null> {
  const directResult = await pool.query("SELECT id FROM categories WHERE slug = $1", [slugPath]);
  if (directResult.rows.length > 0) {
    return directResult.rows[0].id;
  }

  const slugParts = slugPath.split("/").filter(Boolean);
  let currentCategoryId: string | null = null;

  for (const slugPart of slugParts) {
    let query = "SELECT id FROM categories WHERE slug = $1";
    const params: any[] = [slugPart];

    if (currentCategoryId) {
      query += " AND parent_id = $2";
      params.push(currentCategoryId);
    } else {
      query += " AND parent_id IS NULL";
    }

    const result = await pool.query(query, params);
    if (result.rows.length === 0) {
      return null;
    }

    currentCategoryId = result.rows[0].id;
  }

  return currentCategoryId;
}

// Sentry is optional. To enable, set sentry_dsn in app_secrets and restart.

/**
 * Serves a properly structured 404 page with navigation links and noindex.
 * Replaces bare HTML 404 strings to improve crawl budget and site quality signals.
 */
function serve404Page(res: Response, title: string, message: string): void {
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title} | Ask Detectives</title>
  <meta name="robots" content="noindex, follow">
  <link rel="canonical" href="https://www.askdetectives.com/">
  <link rel="icon" type="image/png" href="/favicon.png">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&display=swap" rel="stylesheet">
</head>
<body style="font-family:Inter,sans-serif;max-width:800px;margin:60px auto;padding:0 24px;color:#1a1a1a;">
  <h1 style="font-size:2rem;font-weight:700;margin-bottom:16px;">${message}</h1>
  <p style="color:#6b7280;margin-bottom:32px;">The page you requested could not be found, or no investigators are listed in this location yet. Try browsing our top directories below.</p>
  <nav style="display:flex;flex-wrap:wrap;gap:16px;">
    <a href="/" style="color:#2563eb;text-decoration:none;font-weight:600;border:1px solid #2563eb;padding:8px 16px;border-radius:6px;">Back to Homepage</a>
    <a href="/detectives/india/" style="color:#374151;text-decoration:none;border:1px solid #d1d5db;padding:8px 16px;border-radius:6px;">Detectives in India</a>
    <a href="/detectives/united-states/" style="color:#374151;text-decoration:none;border:1px solid #d1d5db;padding:8px 16px;border-radius:6px;">Detectives in USA</a>
    <a href="/detectives/united-kingdom/" style="color:#374151;text-decoration:none;border:1px solid #d1d5db;padding:8px 16px;border-radius:6px;">Detectives in UK</a>
    <a href="/search" style="color:#374151;text-decoration:none;border:1px solid #d1d5db;padding:8px 16px;border-radius:6px;">Search All Detectives</a>
  </nav>
</body>
</html>`;
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.status(404).send(html);
}

export async function serveStatic(app: Express, _server: Server) {
  const distPath = path.resolve(import.meta.dirname, "..", "dist", "public");

  if (!fs.existsSync(distPath)) {
    throw new Error(
      `Could not find the build directory: ${distPath}, make sure to build the client first`,
    );
  }

  const indexHtmlPath = path.resolve(distPath, "index.html");
  // Never cache index.html in memory — always read from disk so a new build
  // is picked up immediately without needing a server restart.
  async function readIndexHtml(): Promise<string> {
    return fs.promises.readFile(indexHtmlPath, "utf-8");
  }

  console.log("SERVING FRONTEND FROM:", indexHtmlPath);

  // In-memory SSR cache: caches fully-rendered HTML for location/service pages.
  // Keyed by request path, TTL 5 minutes. Dramatically reduces DB load on
  // repeated hits to the same city/state/country pages within a warm server instance.
  const SSR_CACHE_TTL_MS = 4 * 60 * 60 * 1000; // 4 hours
  const ssrCache = new Map<string, { html: string; expiresAt: number }>();

  function getSsrCache(key: string): string | null {
    const entry = ssrCache.get(key);
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) { ssrCache.delete(key); return null; }
    return entry.html;
  }

  function setSsrCache(key: string, html: string): void {
    // Evict oldest entries if cache grows beyond 500 items to prevent memory leak
    if (ssrCache.size >= 500) {
      const firstKey = ssrCache.keys().next().value;
      if (firstKey) ssrCache.delete(firstKey);
    }
    ssrCache.set(key, { html, expiresAt: Date.now() + SSR_CACHE_TTL_MS });
  }

  // ✅ GLOBAL REQUEST LOGGER - Runs before all routes and middleware
  // Logs every incoming request to track execution flow
  app.use((req: Request, _res: Response, next: Function) => {
    console.log("[REQUEST]", req.method, req.originalUrl, new Date().toISOString());
    next();
  });


  // GLOBAL URL NORMALIZATION MIDDLEWARE (production-safe)
  app.use((req: Request, res: Response, next: Function) => {
    const originalPath = req.path;

    // Ignore static files and assets
    if (
      originalPath.startsWith('/assets') ||
      originalPath.startsWith('/static') ||
      originalPath.startsWith('/images') ||
      originalPath.startsWith('/js') ||
      originalPath.startsWith('/css') ||
      originalPath.startsWith('/build') ||
      originalPath.startsWith('/favicon') ||
      /\.[a-zA-Z0-9]+$/.test(originalPath)
    ) {
      return next();
    }

    // Normalize to lowercase only — do NOT strip trailing slashes.
    // Stripping trailing slashes causes "Canonical points to redirect" in Ahrefs/Google because
    // all canonical URLs and sitemap entries use trailing slashes. Stripping creates a redirect
    // loop: canonical → trailing-slash URL → 301 to no-slash URL → canonical says trailing slash.
    const normalizedPath = originalPath.toLowerCase();

    if (normalizedPath !== originalPath) {
      const query = req.url.includes('?')
        ? req.url.slice(req.url.indexOf('?'))
        : '';
      return res.redirect(301, normalizedPath + query);
    }

    next();
  });

  // LOCATION LISTING SEO INJECTION
  // Intercepts /detectives/:country, /detectives/:country/:state, /detectives/:country/:state/:city
  // and injects SEO meta tags with detective listings
  app.get(/^\/detectives\/[^\/]+(?:\/[^\/]+)?(?:\/[^\/]+)?\/?$/, async (req: Request, res: Response) => {
    try {
      const requestPath = req.path;
      console.log("[SSR] Route start", { path: requestPath, timestamp: new Date().toISOString() });

      // ✅ SSR CACHE: serve pre-rendered HTML within 5-min TTL to avoid repeated DB queries
      const cacheKey = requestPath.replace(/\/+$/, '').toLowerCase();
      const cachedHtml = getSsrCache(cacheKey);
      if (cachedHtml) {
        return sendIndexHtmlResponse(req, res, cachedHtml, "public, max-age=3600, stale-while-revalidate=86400", {
          "X-SSR-Cache": "HIT",
        });
      }

      const params = extractLocationRouteParams(requestPath);

      // Check if this is actually a location listing page (2-4 segments)
      // NOT a detective profile (which would have 5 segments)
      const segments = requestPath.replace(/\/+$/, '').split('/').filter(s => s);
      if (segments.length !== 2 && segments.length !== 3 && segments.length !== 4) {
        // Not a location listing page - let other handlers process it
        return;
      }

      if (!params) {
        // Fallback to normal SPA if params don't match
        return serveIndexHtmlWithSeo(res, indexHtmlPath, null, null);
      }

      // const isCity = segments.length === 4; // /detectives/:country/:state/:city

      // ✅ OPTIMIZATION: Resolve location once to avoid duplicate queries
      // Prevents redundant lookups in both searchServices() and generateLocationSeoMetaTags()
      console.log("[SSR] Resolving location IDs...", { country: params.country, state: params.state, city: params.city });
      const resolvedLocation = await resolveLocationIds({
        country: params.country,
        state: params.state,
        city: params.city,
      });
      console.log("[SSR] Location resolved", resolvedLocation);



      console.log("[SSR] Fetching detectives...", { countrySlug: params.country, stateSlug: params.state, citySlug: params.city });
      // Fetch SEO values and detective listings in parallel
      const [seoValues, locationSeoData] = await Promise.all([
        getDetectiveLocationSeo(params.country, params.state, params.city),
        getLocationDetectivesForSEO(params.country, params.state, params.city, 15, 0, {
          includeTotalCount: true,
        }),
      ]);
      const detectives = locationSeoData.detectives;
      // const hasMore = locationSeoData.hasMore;
      const detectiveCount = detectives ? detectives.length : 0;

      // Generate canonical URL
      // const canonicalUrl = `https://www.askdetectives.com${requestPath.replace(/\/$/, '')}/`;

      const locationCanonicalUrl = `https://www.askdetectives.com${requestPath.replace(/\/$/, '')}/`;
      let seoHtml = injectServiceSeoTags(await readIndexHtml(), {
        title: seoValues.meta_title,
        h1: seoValues.h1,
        meta_description: seoValues.meta_description,
      }, locationCanonicalUrl);

      const cityPagePayload = {
        location: {
          country: locationSeoData.location.country,
          state: locationSeoData.location.state,
          city: locationSeoData.location.city,
        },
        detectives: detectives.map((detective) => ({
          id: detective.id,
          businessName: detective.businessName,
          slug: detective.slug,
          logo: detective.logo,
          city: detective.city,
          state: detective.state,
          country: detective.country,
          isVerified: detective.isVerified,
          level: detective.level,
          phone: detective.phone,
          whatsapp: detective.whatsapp,
          contactEmail: detective.contactEmail,
          avgRating: detective.avgRating,
          reviewCount: detective.reviewCount,
          effectiveBadges: detective.effectiveBadges,
        })),
        count: locationSeoData.totalCount,
        hasMore: locationSeoData.hasMore,
        pagination: {
          limit: 15,
          offset: 0,
          nextOffset: locationSeoData.hasMore ? detectives.length : null,
          prevOffset: null,
        },
      };

      const seoDataPayload = {
        title: seoValues.meta_title,
        description: seoValues.meta_description,
        h1: seoValues.h1,
      };

      seoHtml = injectScriptPayloads(seoHtml, [
        { globalName: "CITY_PAGE_DATA", data: cityPagePayload },
        { globalName: "SEO_DATA", data: seoDataPayload },
      ]);

      const fragmentHtml = buildDetectiveListingSsrFragment({
        countrySlug: params.country,
        stateSlug: params.state,
        citySlug: params.city,
        location: cityPagePayload.location,
        h1: seoValues.h1,
        totalCount: locationSeoData.totalCount,
        detectives,
      });

      seoHtml = stripHiddenSeoH1(seoHtml);
      seoHtml = injectFragmentBeforeRoot(seoHtml, fragmentHtml);

      if (detectiveCount > 0) {
        const countryLabel = cityPagePayload.location.country || params.country.replace(/-/g, " ");
        const stateLabel = cityPagePayload.location.state || params.state?.replace(/-/g, " ") || "";
        const cityLabel = cityPagePayload.location.city || params.city?.replace(/-/g, " ") || "";
        const breadcrumbs: BreadcrumbItem[] = [
          { name: "Home", url: "https://www.askdetectives.com/" },
          { name: countryLabel, url: `https://www.askdetectives.com/detectives/${params.country}/` },
        ];

        if (params.state && stateLabel) {
          breadcrumbs.push({
            name: stateLabel,
            url: `https://www.askdetectives.com/detectives/${params.country}/${params.state}/`,
          });
        }

        if (params.city && cityLabel) {
          breadcrumbs.push({
            name: cityLabel,
            url: locationCanonicalUrl,
          });
        }

        seoHtml = injectPhase1Schemas(seoHtml, {
          canonicalUrl: locationCanonicalUrl,
          pageType: "CollectionPage",
          pageName: seoValues.h1,
          pageDescription: seoValues.meta_description,
          breadcrumbs,
        });
      }

      // Handle zero-detective pages
      if (detectiveCount === 0) {
        // Replace existing robots with authoritative SSR noindex to avoid conflicting tags.
        const ssrNoindexTag = '<meta name="robots" content="noindex, follow" data-ssr-robots="authoritative">';
        if (/<meta\s+name=["']robots["'][^>]*>/i.test(seoHtml)) {
          seoHtml = seoHtml.replace(/<meta\s+name=["']robots["'][^>]*>/i, ssrNoindexTag);
        } else {
          seoHtml = seoHtml.replace('<head>', `<head>\n${ssrNoindexTag}`);
        }
        // Show special message
        const cityName = params.city ? params.city.replace(/-/g, ' ') : 'this location';
        const noDetectiveHtml = `<section style="margin-top:32px"><h2 style="font-size:1.5rem;font-weight:700;margin-bottom:16px">No detectives available in ${cityName} yet.</h2><p style="color:#6b7280;margin-bottom:24px;">We are expanding our network. Please check back soon.</p></section>`;
        seoHtml = seoHtml.replace('</body>', `${noDetectiveHtml}</body>`);
      }

      setSsrCache(cacheKey, seoHtml);
      return sendIndexHtmlResponse(req, res, seoHtml, "public, max-age=3600, stale-while-revalidate=86400", {
        "X-SSR-Cache": "MISS",
      });

    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      console.error('[SEO Location Injection] CRITICAL ERROR:', {
        url: req.originalUrl,
        message: errorMsg,
        stack: error instanceof Error ? error.stack : undefined,
      });
      // Return 500 error instead of silently falling back
      if (!res.headersSent) {
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        return res.status(500).send(
          '<html><head><title>Server Error</title></head><body><h1>500 - Server Error</h1><p>Failed to load location detectives</p></body></html>'
        );
      }
      res.end();
    }
  });

  // DETECTIVE PROFILE SEO INJECTION
  // Intercepts /detectives/:country/:state/:city/:slug and injects SEO meta tags
  app.get(/^\/detectives\/[^\/]+\/[^\/]+\/[^\/]+\/[^\/]+\/?$/, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const requestPath = req.path;
      const segments = requestPath.replace(/\/+$/, '').split('/').filter(s => s);

      if (segments.length !== 5 || segments[0] !== 'detectives') {
        return next();
      }

      const [, country, state, city, detectiveSlug] = segments;

      const canonicalUrl = `https://www.askdetectives.com${requestPath.replace(/\/$/, '')}/`;

      // Fetch individual detective with their SEO override from location_seo_overrides
      let detective: any = null;
      try {
        detective = await getDetectiveBySlugForSEO(country, state, city, detectiveSlug);
      } catch (e) {
        // ignore — fall through to city-level SEO below
      }

      let seoHtml: string;
      if (detective) {
        // Use detective-specific SEO (respects seoOverride from location_seo_overrides)
        seoHtml = injectSeoTags(await readIndexHtml(), detective, canonicalUrl);
      } else {
        // Fallback: use city-level SEO from detective_location_seo
        let citySeo;
        try {
          citySeo = await getDetectiveLocationSeo(country, state, city);
        } catch (e) {
          citySeo = generateDetectiveSeo(country, state, city);
        }
        seoHtml = injectServiceSeoTags(await readIndexHtml(), {
          title: citySeo.meta_title,
          h1: citySeo.h1,
          meta_description: citySeo.meta_description,
        }, canonicalUrl);
      }
      return sendIndexHtmlResponse(req, res, seoHtml, "public, max-age=3600, stale-while-revalidate=86400");

    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      console.error('[Service Detail SEO] Error:', { url: req.originalUrl, message: errorMsg });
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      return res.status(500).send(
        '<html><head><title>Server Error</title></head><body><h1>500 - Server Error</h1></body></html>'
      );
    }
  });

  // SERVICE DETAIL PAGE SEO INJECTION (Production)
  // Intercepts /service/:country/:state/:city/:detectiveSlug/:serviceSlug
  app.get(/^\/service\/[^\/]+\/[^\/]+\/[^\/]+\/[^\/]+\/[^\/]+\/?$/, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const requestPath = req.path;
      const segments = requestPath.replace(/\/+$/, '').split('/').filter(s => s);
      if (segments.length !== 6 || segments[0] !== 'service') return next();

      const [, country, state, city, detectiveSlug, serviceSlug] = segments;

      const seoData = await getServiceBySlugForSEO(country, state, city, detectiveSlug, serviceSlug);
      if (!seoData) {
        return serve404Page(res, 'Service Not Found', 'This service could not be found');
      }

      const canonicalUrl = `https://www.askdetectives.com${seoData.canonicalPath}`;
      const categoryLabel = seoData.category || "Services";
      const categoryUrl = `https://www.askdetectives.com/search?category=${encodeURIComponent(seoData.category || "")}`;

      const seoHtml = injectServiceSeoTags(await readIndexHtml(), {
        title: seoData.meta_title,
        h1: seoData.h1,
        meta_description: seoData.meta_description,
      }, canonicalUrl);

      const schemaHtml = injectPhase1Schemas(seoHtml, {
        canonicalUrl,
        pageType: "WebPage",
        pageName: seoData.h1,
        pageDescription: seoData.meta_description,
        breadcrumbs: [
          { name: "Home", url: "https://www.askdetectives.com/" },
          { name: categoryLabel, url: categoryUrl },
          { name: seoData.serviceTitle, url: canonicalUrl },
        ],
      });

      const serviceSchemaHtml = injectPhase5ServiceSchema(schemaHtml, {
        canonicalUrl,
        serviceTitle: seoData.serviceTitle,
        description: seoData.serviceDescription,
        category: seoData.category,
        detectiveName: seoData.detectiveName,
        countryName: seoData.countryName,
        cityName: seoData.cityName,
        stateName: seoData.stateName,
        countrySlug: seoData.countrySlug,
        isOnEnquiry: seoData.isOnEnquiry,
        basePrice: seoData.basePrice,
        offerPrice: seoData.offerPrice,
        avgRating: seoData.avgRating,
        reviewCount: seoData.reviewCount,
      });

      return sendIndexHtmlResponse(req, res, serviceSchemaHtml, "public, max-age=3600, stale-while-revalidate=86400");
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      console.error('[Service Detail SEO] Error:', { url: req.originalUrl, message: errorMsg });
      return next();
    }
  });

  // CATCH-ALL ROUTE FOR UNMATCHED /detectives PATHS (6+ segments or invalid patterns)
  // Return hard 404 to avoid soft-404 crawl waste.
  app.get(/^\/detectives\//, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const requestPath = req.path;
      const segments = requestPath.replace(/\/+$/, '').split('/').filter(s => s);
      
      // Skip if already handled by earlier routes (2-5 segments)
      if (segments.length <= 5) {
        return next(); // Pass through to next middleware/catch-all
      }

      console.log(`[Detectives Catch-All] 404 for invalid deep path: ${requestPath} (${segments.length} segments)`);
      return serve404Page(res, 'Page Not Found', 'This detective route does not exist');
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      console.error('[Detectives Catch-All] Error:', errorMsg);
      res.status(500).type("text/plain").send("Error loading page");
    }
  });

  // SERVICE + LOCATION SEO INJECTION (Production)
  // Intercepts /locations/:category/:country[/:state][/:city] — handles country, state, and city levels
  app.get(/^\/locations\/[a-z-]+\/[^\/]+(?:\/[^\/]+)?(?:\/[^\/]+)?\/?$/, async (req: Request, res: Response) => {
    try {
      const requestPath = req.path;

      const {
        extractServiceLocationRouteParams,
        resolveServiceLocation,
      } = await import("./lib/seo-injection.js");

      const params = extractServiceLocationRouteParams(requestPath);
      if (!params) {
        console.warn("[Service SEO] Route params extraction failed for:", requestPath);
        return serve404Page(res, 'Service Not Found', 'Invalid service route');
      }

      const canonicalCategorySlug = await resolveCanonicalServiceCategorySlug(params.categorySlug);
      if (!canonicalCategorySlug) {
        console.warn("[Service SEO] Unknown service category slug:", params.categorySlug);
        return serve404Page(res, 'Service Not Found', 'Invalid service category');
      }

      if (params.categorySlug !== canonicalCategorySlug) {
        const canonicalPath = params.level === 'city'
          ? `/locations/${canonicalCategorySlug}/${params.countrySlug}/${params.stateSlug}/${params.citySlug}/`
          : params.level === 'state'
          ? `/locations/${canonicalCategorySlug}/${params.countrySlug}/${params.stateSlug}/`
          : `/locations/${canonicalCategorySlug}/${params.countrySlug}/`;
        const query = req.url.includes('?') ? req.url.slice(req.url.indexOf('?')) : '';
        return res.redirect(301, `${canonicalPath}${query}`);
      }

      // ✅ SSR CACHE: serve pre-rendered HTML within 5-min TTL
      const serviceCacheKey = `svc:${requestPath.replace(/\/+$/, '').toLowerCase()}`;
      const cachedServiceHtml = getSsrCache(serviceCacheKey);
      if (cachedServiceHtml) {
        return sendIndexHtmlResponse(req, res, cachedServiceHtml, "public, max-age=3600, stale-while-revalidate=86400", {
          "X-SSR-Cache": "HIT",
        });
      }

      console.log("[Service SEO] Extracted params:", params);

      // Resolve location slugs to actual country/state/city
      const location = await resolveServiceLocation(params.countrySlug, params.stateSlug, params.citySlug);
      if (!location) {
        console.log("[Service SEO] Location resolution failed");
        return serve404Page(res, 'Location Not Found', 'No services found in this location');
      }

      console.log("[Service SEO] Location resolved:", location);

      // Fetch services for this category and location
      // Use categorySlug (regexp_replace) so special chars like & are handled
      // Use pre-resolved IDs directly — avoids a second country/state/city DB lookup
      const serviceResults = await storage.searchServices(
        { categorySlug: canonicalCategorySlug },
        50,
        0,
        "popular",
        false,
        {
          countryId: location.countryId,
          stateId: location.stateId ?? null,
          cityId: location.cityId ?? null,
          countryName: location.countryName,
          stateName: location.stateName ?? "",
          cityName: location.cityName ?? "",
        }
      );

      // Return 404 if no services found
      if (!serviceResults || serviceResults.length === 0) {
        console.log("[Service SEO] No services found for location");
        return serve404Page(res, 'No Services Found', `No ${params.category} services found in this location`);
      }

      console.log(`[Service SEO] Found ${serviceResults.length} services`);

      // Generate canonical URL
      const canonicalUrl = `https://www.askdetectives.com${requestPath.replace(/\/$/, '')}/`;

      // Fetch SEO values
      let seoValues;
      try {
        seoValues = await getServiceLocationSeo(canonicalCategorySlug, params.countrySlug, params.stateSlug || '', params.citySlug || '');
      } catch (e) {
        seoValues = generateServiceLocationSeo(canonicalCategorySlug, params.countrySlug, params.citySlug || '', undefined, params.stateSlug || '');
      }
      let seoHtml = injectServiceSeoTags(await readIndexHtml(), {
        title: seoValues.meta_title,
        h1: seoValues.h1,
        meta_description: seoValues.meta_description,
      }, canonicalUrl);

      const serviceCards = serviceResults.map((service: any) => ({
        ...buildServiceCardDTO({
          service,
          detective: service.detective,
          avgRating: service.avgRating,
          reviewCount: service.reviewCount,
        }),
        isOnEnquiry: service.isOnEnquiry,
        basePrice: service.basePrice,
        offerPrice: service.offerPrice,
        category: service.category,
        description: service.description,
      }));

      const resolvedCategoryName = serviceCards[0]?.category || params.category.replace(/-/g, " ");
      const hasMoreResults = serviceCards.length === 50;

      const serviceLocationDataPayload = {
        meta: {
          country: location.countryName,
          countryCode: location.countryCode,
          state: location.stateName || null,
          city: location.cityName || null,
          category: resolvedCategoryName,
          categorySlug: canonicalCategorySlug,
          countrySlug: params.countrySlug,
          stateSlug: params.stateSlug || null,
          citySlug: params.citySlug || null,
          total: serviceCards.length,
          hasMore: hasMoreResults,
          offset: 0,
          found: true,
          seo: {
            h1: seoValues.h1,
            meta_title: seoValues.meta_title,
            meta_description: seoValues.meta_description,
          },
        },
        services: serviceCards,
        pagination: {
          limit: 50,
          offset: 0,
          nextOffset: hasMoreResults ? serviceCards.length : null,
          prevOffset: null,
        },
      };

      const serviceLocationSeoPayload = {
        title: seoValues.meta_title,
        description: seoValues.meta_description,
        h1: seoValues.h1,
        category: resolvedCategoryName,
        categorySlug: canonicalCategorySlug,
      };

      seoHtml = injectScriptPayloads(seoHtml, [
        { globalName: "SERVICE_LOCATION_DATA", data: serviceLocationDataPayload },
        { globalName: "SERVICE_LOCATION_SEO_DATA", data: serviceLocationSeoPayload },
      ]);

      const serviceFragmentHtml = buildServiceLocationSsrFragment({
        categoryName: resolvedCategoryName,
        categorySlug: canonicalCategorySlug,
        countrySlug: params.countrySlug,
        stateSlug: params.stateSlug,
        citySlug: params.citySlug,
        location: {
          country: location.countryName,
          state: location.stateName,
          city: location.cityName,
        },
        h1: seoValues.h1,
        totalCount: serviceCards.length,
        services: serviceCards,
      });

      seoHtml = stripHiddenSeoH1(seoHtml);
      seoHtml = injectFragmentBeforeRoot(seoHtml, serviceFragmentHtml);

      const categoryLabel = resolvedCategoryName || canonicalCategorySlug.replace(/-/g, " ");
      const breadcrumbs: BreadcrumbItem[] = [
        { name: "Home", url: "https://www.askdetectives.com/" },
        {
          name: categoryLabel,
          url: `https://www.askdetectives.com/locations/${canonicalCategorySlug}/`,
        },
        {
          name: location.countryName,
          url: `https://www.askdetectives.com/locations/${canonicalCategorySlug}/${params.countrySlug}/`,
        },
      ];

      if (params.stateSlug && location.stateName) {
        breadcrumbs.push({
          name: location.stateName,
          url: `https://www.askdetectives.com/locations/${canonicalCategorySlug}/${params.countrySlug}/${params.stateSlug}/`,
        });
      }

      if (params.citySlug && location.cityName) {
        breadcrumbs.push({
          name: location.cityName,
          url: canonicalUrl,
        });
      }

      seoHtml = injectPhase1Schemas(seoHtml, {
        canonicalUrl,
        pageType: "CollectionPage",
        pageName: seoValues.h1,
        pageDescription: seoValues.meta_description,
        breadcrumbs,
      });

      setSsrCache(serviceCacheKey, seoHtml);
      return sendIndexHtmlResponse(req, res, seoHtml, "public, max-age=3600, stale-while-revalidate=86400", {
        "X-SSR-Cache": "MISS",
      });

    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      console.error('[Service SEO] CRITICAL ERROR:', {
        url: req.originalUrl,
        message: errorMsg,
        stack: error instanceof Error ? error.stack : undefined,
      });
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      return res.status(500).send(
        '<html><head><title>Server Error</title></head><body><h1>500 - Server Error</h1><p>Failed to load services</p></body></html>'
      );
    }
  });

  // NEWS/ARTICLE PAGE SSR — Phase A+B
  // Intercepts /news/:slug, injects ARTICLE_PAGE_DATA seed + visible SSR fragment outside #root.
  app.get(/^\/news\/([^/]+)\/?$/, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const segments = req.path.replace(/\/+$/, "").split("/").filter(Boolean);
      if (segments.length !== 2 || segments[0] !== "news") return next();
      const slug = segments[1];

      // Fetch article from DB (same query as /api/case-studies/:slug but read-only, no view increment)
      const articleResult = await pool.query(
        `SELECT cs.id, cs.title, cs.slug, cs.content, cs.excerpt_html, cs.category,
                cs.featured, cs.thumbnail, cs.view_count, cs.published_at, cs.created_at,
                d.id as detective_id, d.business_name, d.slug as detective_slug,
                d.logo, d.city, d.state, d.country
         FROM case_studies cs
         LEFT JOIN detectives d ON cs.detective_id = d.id
         WHERE cs.slug = $1
         LIMIT 1`,
        [slug],
      );

      if (articleResult.rows.length === 0) {
        // Not found — fall through to SPA which will show 404
        return next();
      }

      const row = articleResult.rows[0];

      const detective = row.detective_id
        ? {
            businessName: row.business_name || null,
            slug: row.detective_slug || null,
            city: row.city || null,
            country: row.country || null,
          }
        : null;

      // Plain-text excerpt from excerpt_html or first 300 chars of content
      const rawExcerpt: string = row.excerpt_html || row.content || "";
      const plainExcerpt = rawExcerpt.replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim().substring(0, 300);

      const articlePagePayload = {
        id: row.id,
        title: row.title,
        slug: row.slug,
        content: row.content,
        excerptHtml: row.excerpt_html || null,
        category: row.category || "General",
        featured: !!row.featured,
        thumbnail: row.thumbnail || null,
        viewCount: row.view_count || 0,
        publishedAt: row.published_at ? new Date(row.published_at).toISOString() : new Date(row.created_at).toISOString(),
        createdAt: new Date(row.created_at).toISOString(),
        detective,
      };

      const seoTitle = `${row.title} | Case Studies | Ask Detectives`;
      const seoDescription = plainExcerpt.substring(0, 160) || `Case study: ${row.title}. Professional private investigation and detective services.`;

      const articleSeoPayload = {
        title: seoTitle,
        description: seoDescription,
        slug: row.slug,
        canonical: `https://www.askdetectives.com/news/${row.slug}`,
      };

      let seoHtml = await readIndexHtml();

      // Inject head SEO tags
      seoHtml = injectServiceSeoTags(seoHtml, {
        title: seoTitle,
        h1: row.title,
        meta_description: seoDescription,
      }, `https://www.askdetectives.com/news/${row.slug}`);

      // Phase A: seed payloads
      seoHtml = injectScriptPayloads(seoHtml, [
        { globalName: "ARTICLE_PAGE_DATA", data: articlePagePayload },
        { globalName: "ARTICLE_SEO_DATA", data: articleSeoPayload },
      ]);

      // Phase B: SSR fragment
      const fragmentHtml = buildArticleSsrFragment({
        slug: row.slug,
        title: row.title,
        h1: row.title,
        category: row.category || "General",
        publishedAt: articlePagePayload.publishedAt,
        excerpt: plainExcerpt,
        thumbnail: row.thumbnail || null,
        detective,
      });

      seoHtml = stripHiddenSeoH1(seoHtml);
      seoHtml = injectFragmentBeforeRoot(seoHtml, fragmentHtml);

      const articleCanonicalUrl = `https://www.askdetectives.com/news/${row.slug}`;

      // Phase 1: BreadcrumbList + WebPage schemas + SSR-authoritative marker
      seoHtml = injectPhase1Schemas(seoHtml, {
        canonicalUrl: articleCanonicalUrl,
        pageType: "WebPage",
        pageName: row.title,
        pageDescription: seoDescription,
        breadcrumbs: [
          { name: "Home", url: "https://www.askdetectives.com/" },
          { name: "News & Cases", url: "https://www.askdetectives.com/news" },
          { name: row.title, url: articleCanonicalUrl },
        ],
      });

      // Phase 2: NewsArticle schema — single entity, canonical URL, parity with visible fragment
      seoHtml = injectPhase2ArticleSchema(seoHtml, {
        canonicalUrl: articleCanonicalUrl,
        headline: row.title,
        description: seoDescription,
        publishedAt: articlePagePayload.publishedAt,
        modifiedAt: articlePagePayload.publishedAt,
        thumbnail: row.thumbnail || null,
        authorName: detective?.businessName || null,
        authorSlug: detective?.slug || null,
        category: row.category || null,
      });

      return sendIndexHtmlResponse(req, res, seoHtml, "public, max-age=3600, stale-while-revalidate=86400");
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      console.error("[News Article SSR] Error:", { url: req.originalUrl, message: errorMsg });
      return next();
    }
  });

  // LEGACY CMS URL BRIDGE — redirect /pages/* routes to canonical CMS paths or return hard 404.
  app.get(/^\/pages\/([^/]+)\/([^/]+)\/([^/]+)\/?$/, async (req: Request, res: Response) => {
    try {
      const segments = req.path.replace(/\/+$/, "").split("/").filter(Boolean);
      const parentSlug = segments[1];
      const categorySlug = segments[2];
      const pageSlug = segments[3];
      const categoryPath = `${parentSlug}/${categorySlug}`;
      const categoryId = await getCategoryIdFromHierarchicalSlug(categoryPath);

      if (!categoryId) {
        return serve404Page(res, "Page Not Found", "This page could not be found");
      }

      const pageResult = await pool.query(
        `SELECT p.slug
         FROM pages p
         WHERE p.slug = $1 AND p.status = 'published' AND p.category_id = $2
         LIMIT 1`,
        [pageSlug, categoryId],
      );

      if (pageResult.rows.length === 0) {
        return serve404Page(res, "Page Not Found", "This page could not be found");
      }

      return res.redirect(301, `/${categoryPath}/${pageSlug}`);
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      console.error("[Legacy CMS Redirect] Error:", { url: req.originalUrl, message: errorMsg });
      return serve404Page(res, "Page Not Found", "This page could not be found");
    }
  });

  app.get(/^\/pages\/([^/]+)\/([^/]+)\/?$/, async (req: Request, res: Response) => {
    try {
      const segments = req.path.replace(/\/+$/, "").split("/").filter(Boolean);
      const categorySlug = segments[1];
      const pageSlug = segments[2];
      const categoryId = await getCategoryIdFromHierarchicalSlug(categorySlug);

      if (!categoryId) {
        return serve404Page(res, "Page Not Found", "This page could not be found");
      }

      const pageResult = await pool.query(
        `SELECT p.slug
         FROM pages p
         WHERE p.slug = $1 AND p.status = 'published' AND p.category_id = $2
         LIMIT 1`,
        [pageSlug, categoryId],
      );

      if (pageResult.rows.length === 0) {
        return serve404Page(res, "Page Not Found", "This page could not be found");
      }

      return res.redirect(301, `/${categorySlug}/${pageSlug}`);
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      console.error("[Legacy CMS Redirect] Error:", { url: req.originalUrl, message: errorMsg });
      return serve404Page(res, "Page Not Found", "This page could not be found");
    }
  });

  app.get(/^\/pages\/([^/]+)\/?$/, async (req: Request, res: Response) => {
    try {
      const segments = req.path.replace(/\/+$/, "").split("/").filter(Boolean);
      const pageSlug = segments[1];
      const pageResult = await pool.query(
        `SELECT p.slug, c.slug AS category_slug
         FROM pages p
         LEFT JOIN categories c ON p.category_id = c.id
         WHERE p.slug = $1 AND p.status = 'published'
         LIMIT 1`,
        [pageSlug],
      );

      if (pageResult.rows.length === 0 || !pageResult.rows[0].category_slug) {
        return serve404Page(res, "Page Not Found", "This page could not be found");
      }

      return res.redirect(301, `/${pageResult.rows[0].category_slug}/${pageSlug}`);
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      console.error("[Legacy CMS Redirect] Error:", { url: req.originalUrl, message: errorMsg });
      return serve404Page(res, "Page Not Found", "This page could not be found");
    }
  });

  // CMS BLOG/PAGE SSR — Phase A+B
  // Intercepts /:category/:slug and /:parent/:category/:slug patterns (CMS pages).
  // Injects CMS_PAGE_DATA seed + visible SSR fragment outside #root.
  // Must run BEFORE SPA fallback. Only handles routes that are known CMS page patterns.
  app.get(/^\/([^/]+)\/([^/]+)(?:\/([^/]+))?\/?$/, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const rawPath = req.path.replace(/\/+$/, "");
      const segments = rawPath.split("/").filter(Boolean);

      // This regex handles: /category/slug and /parent/category/slug
      // Segments: [category, slug] or [parent, category, slug]
      let categoryPath: string;
      let pageSlug: string;

      if (segments.length === 2) {
        categoryPath = segments[0];
        pageSlug = segments[1];
      } else if (segments.length === 3) {
        categoryPath = `${segments[0]}/${segments[1]}`;
        pageSlug = segments[2];
      } else {
        return next();
      }

      // Skip known non-CMS two-segment routes that have their own handlers
      const NON_CMS_PREFIXES = new Set([
        "detectives", "locations", "service", "news", "api", "blog", "pages",
        "about", "contact", "support", "privacy", "terms", "packages", "categories",
        "admin", "dashboard", "auth", "login", "register",
        "search", "verify", "reset-password",
      ]);
      if (NON_CMS_PREFIXES.has(segments[0])) return next();

      const categoryId = await getCategoryIdFromHierarchicalSlug(categoryPath);
      if (!categoryId) {
        return serve404Page(res, "Page Not Found", "This page could not be found");
      }

      // Fetch CMS page from DB
      const pageResult = await pool.query(
        `SELECT p.id, p.title, p.slug, p.content, p.banner_image, p.status,
                p.meta_title, p.meta_description, p.h1, p.created_at, p.updated_at,
                p.author_name, p.author_email, p.author_bio,
                c.id as category_id, c.name as category_name, c.slug as category_slug
         FROM pages p
         LEFT JOIN categories c ON p.category_id = c.id
         WHERE p.slug = $1 AND p.status = 'published' AND p.category_id = $2
         LIMIT 1`,
        [pageSlug, categoryId],
      );

      if (pageResult.rows.length === 0) {
        return serve404Page(res, "Page Not Found", "This page could not be found");
      }
      const row = pageResult.rows[0];

      // Fetch tags
      const tagsResult = await pool.query(
        `SELECT t.id, t.name, t.slug FROM tags t
         INNER JOIN page_tags pt ON t.id = pt.tag_id WHERE pt.page_id = $1`,
        [row.id],
      );
      const tags = tagsResult.rows.map((t: { id: string; name: string; slug: string }) => ({
        id: t.id, name: t.name, slug: t.slug,
      }));

      const category = row.category_id
        ? { id: row.category_id, name: row.category_name, slug: row.category_slug }
        : null;

      const author = row.author_name ? { name: row.author_name, email: row.author_email || undefined } : null;

      // Plain-text excerpt
      const rawContent: string = row.content || "";
      const plainExcerpt = rawContent.replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim().substring(0, 300);

      const cmsPagePayload = {
        id: row.id,
        title: row.title,
        slug: row.slug,
        categoryPath,
        content: row.content,
        bannerImage: row.banner_image || null,
        status: row.status,
        metaTitle: row.meta_title || null,
        metaDescription: row.meta_description || null,
        h1: row.h1 || null,
        createdAt: new Date(row.created_at).toISOString(),
        updatedAt: new Date(row.updated_at).toISOString(),
        author,
        category,
        tags,
      };

      const seoTitle = row.meta_title || row.title;
      const seoDescription = row.meta_description || plainExcerpt.substring(0, 160) || `Learn more about ${row.title} on Ask Detectives.`;

      const cmsSeoPayload = {
        title: seoTitle,
        description: seoDescription,
        h1: row.h1 || row.title,
        slug: row.slug,
        categorySlug: category?.slug || null,
        categoryPath,
      };

      const canonicalPath = `/${categoryPath}/${row.slug}`;
      const canonicalUrl = `https://www.askdetectives.com${canonicalPath}`;

      if (rawPath !== canonicalPath) {
        const query = req.url.includes("?") ? req.url.slice(req.url.indexOf("?")) : "";
        return res.redirect(301, `${canonicalPath}${query}`);
      }

      let seoHtml = await readIndexHtml();

      // Inject head SEO tags
      seoHtml = injectServiceSeoTags(seoHtml, {
        title: seoTitle,
        h1: row.h1 || row.title,
        meta_description: seoDescription,
      }, canonicalUrl);

      // Phase A: seed payloads
      seoHtml = injectScriptPayloads(seoHtml, [
        { globalName: "CMS_PAGE_DATA", data: cmsPagePayload },
        { globalName: "CMS_SEO_DATA", data: cmsSeoPayload },
      ]);

      // Phase B: SSR fragment
      const fragmentHtml = buildCmsPageSsrFragment({
        slug: row.slug,
        title: row.title,
        h1: row.h1 || undefined,
        metaTitle: row.meta_title || undefined,
        metaDescription: row.meta_description || undefined,
        createdAt: cmsPagePayload.createdAt,
        updatedAt: cmsPagePayload.updatedAt,
        excerpt: plainExcerpt,
        bannerImage: row.banner_image || null,
        author,
        category,
        tags,
        canonicalPath,
      });

      seoHtml = stripHiddenSeoH1(seoHtml);
      seoHtml = injectFragmentBeforeRoot(seoHtml, fragmentHtml);

      const cmsBreadcrumbs: BreadcrumbItem[] = [{ name: "Home", url: "https://www.askdetectives.com/" }];
      if (category?.name && category?.slug) {
        cmsBreadcrumbs.push({
          name: category.name,
          url: `https://www.askdetectives.com/blog/category/${category.slug}`,
        });
      }
      cmsBreadcrumbs.push({ name: row.title, url: canonicalUrl });

      seoHtml = injectPhase1Schemas(seoHtml, {
        canonicalUrl,
        pageType: "WebPage",
        pageName: row.h1 || row.title,
        pageDescription: seoDescription,
        breadcrumbs: cmsBreadcrumbs,
      });

      return sendIndexHtmlResponse(req, res, seoHtml, "public, max-age=3600, stale-while-revalidate=86400");
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      console.error("[CMS Page SSR] Error:", { url: req.originalUrl, message: errorMsg });
      return next();
    }
  });

  // STATIC CMS PAGE SEO INJECTION (Production)
  // Intercepts specific static routes and injects title/description in server HTML source.
  app.get(/^\/(about|contact|support|privacy|terms|packages|categories)\/?$/, async (req: Request, res: Response) => {
    try {
      const slug = req.path.replace(/^\/+|\/+$/g, "");
      if (!STATIC_CMS_SEO_SLUGS.has(slug)) {
        return res.status(404).type("text/plain").send("Not Found");
      }

      const seo = await getPublishedCmsPageSeo(slug);
      let html = await readIndexHtml();
      const canonicalPath = req.path.replace(/\/$/, "") || `/${slug}`;
      const canonicalUrl = `https://www.askdetectives.com${canonicalPath}`;

      const pageResult = await pool.query(
        `SELECT p.id, p.title, p.slug, p.content, p.banner_image, p.status,
                p.meta_title, p.meta_description, p.h1, p.created_at, p.updated_at,
                p.author_name, p.author_email, c.id as category_id,
                c.name as category_name, c.slug as category_slug
         FROM pages p
         LEFT JOIN categories c ON p.category_id = c.id
         WHERE p.slug = $1 AND p.status = 'published'
         LIMIT 1`,
        [slug],
      );

      if (seo) {
        html = injectCmsPageSeoTags(html, seo, canonicalUrl);
      }

      if (pageResult.rows.length > 0) {
        const row = pageResult.rows[0];
        const category = row.category_id
          ? { id: row.category_id, name: row.category_name, slug: row.category_slug }
          : null;
        const author = row.author_name
          ? { name: row.author_name, email: row.author_email || undefined }
          : null;

        const rawContent: string = row.content || "";
        const plainExcerpt = rawContent.replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim().substring(0, 300);

        const cmsPagePayload = {
          id: row.id,
          title: row.title,
          slug: row.slug,
          content: row.content,
          bannerImage: row.banner_image || null,
          status: row.status,
          metaTitle: row.meta_title || null,
          metaDescription: row.meta_description || null,
          h1: row.h1 || null,
          createdAt: new Date(row.created_at).toISOString(),
          updatedAt: new Date(row.updated_at).toISOString(),
          author,
          category,
          tags: [],
        };

        const cmsSeoPayload = {
          title: row.meta_title || row.title,
          description: row.meta_description || plainExcerpt.substring(0, 160) || `Learn more about ${row.title} on Ask Detectives.`,
          h1: row.h1 || row.title,
          slug: row.slug,
          categorySlug: category?.slug || null,
        };

        html = injectScriptPayloads(html, [
          { globalName: "CMS_PAGE_DATA", data: cmsPagePayload },
          { globalName: "CMS_SEO_DATA", data: cmsSeoPayload },
        ]);

        const fragmentHtml = buildCmsPageSsrFragment({
          slug: row.slug,
          title: row.title,
          h1: row.h1 || undefined,
          metaTitle: row.meta_title || undefined,
          metaDescription: row.meta_description || undefined,
          createdAt: cmsPagePayload.createdAt,
          updatedAt: cmsPagePayload.updatedAt,
          excerpt: plainExcerpt,
          bannerImage: row.banner_image || null,
          author,
          category,
          tags: [],
          canonicalPath,
        });

        html = stripHiddenSeoH1(html);
        html = injectFragmentBeforeRoot(html, fragmentHtml);

        const staticBreadcrumbs: BreadcrumbItem[] = [{ name: "Home", url: "https://www.askdetectives.com/" }];
        if (category?.name && category?.slug) {
          staticBreadcrumbs.push({
            name: category.name,
            url: `https://www.askdetectives.com/blog/category/${category.slug}`,
          });
        }
        staticBreadcrumbs.push({ name: row.title, url: canonicalUrl });

        html = injectPhase1Schemas(html, {
          canonicalUrl,
          pageType: "WebPage",
          pageName: row.h1 || row.title,
          pageDescription: row.meta_description || plainExcerpt.substring(0, 160) || `Learn more about ${row.title} on Ask Detectives.`,
          breadcrumbs: staticBreadcrumbs,
        });
      }

      return sendIndexHtmlResponse(req, res, html, "no-store");

    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      console.error("[SEO] Static CMS page SEO injection failed:", {
        url: req.originalUrl,
        message: errorMsg,
      });
      return res.status(500).type("text/plain").send("Error loading page");
    }
  });

  // BLOG CATEGORY ARCHIVE SSR (Phase 1 schema ownership)
  app.get(/^\/blog\/category\/([^\/]+)(?:\/([^\/]+))?\/?$/, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const segments = req.path.replace(/\/+$/, "").split("/").filter(Boolean);
      if (segments.length !== 3 && segments.length !== 4) return next();

      const categoryPath = segments.length === 4
        ? `${segments[2]}/${segments[3]}`
        : segments[2];

      const categoryResult = await pool.query(
        `SELECT id, name, slug FROM categories WHERE slug = $1 AND status = 'published' LIMIT 1`,
        [categoryPath],
      );
      if (categoryResult.rows.length === 0) {
        return serve404Page(res, "Category Not Found", "This category could not be found");
      }

      const category = categoryResult.rows[0] as { id: string; name: string; slug: string };
      const pageCountResult = await pool.query(
        `SELECT COUNT(*)::int AS count FROM pages WHERE status = 'published' AND category_id = $1`,
        [category.id],
      );
      const pageCount = Number(pageCountResult.rows[0]?.count || 0);

      const canonicalPath = `/blog/category/${categoryPath}`;
      const canonicalUrl = `https://www.askdetectives.com${canonicalPath}`;
      const title = `${category.name} | Pages`;
      const description = `Browse all articles and insights in the ${category.name} category on AskDetectives.`;

      let html = injectServiceSeoTags(await readIndexHtml(), {
        title,
        h1: category.name,
        meta_description: description,
      }, canonicalUrl);

      const fragmentHtml = buildArchiveSsrFragment({
        heading: category.name,
        subtitle: `${pageCount} pages`,
        breadcrumbs: [
          { name: "Home", url: "https://www.askdetectives.com/" },
          { name: "Blog", url: "https://www.askdetectives.com/blog" },
          { name: category.name, url: canonicalUrl },
        ],
      });
      html = stripHiddenSeoH1(html);
      html = injectFragmentBeforeRoot(html, fragmentHtml);

      if (pageCount > 0) {
        html = injectPhase1Schemas(html, {
          canonicalUrl,
          pageType: "CollectionPage",
          pageName: category.name,
          pageDescription: description,
          breadcrumbs: [
            { name: "Home", url: "https://www.askdetectives.com/" },
            { name: "Blog", url: "https://www.askdetectives.com/blog" },
            { name: category.name, url: canonicalUrl },
          ],
        });
      } else {
        html = html.replace(
          /<meta\s+name=["']robots["'][^>]*>/i,
          '<meta name="robots" content="noindex, follow" data-ssr-robots="authoritative">',
        );
      }

      return sendIndexHtmlResponse(req, res, html, "public, max-age=3600, stale-while-revalidate=86400");
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      console.error("[Category Archive SSR] Error:", { url: req.originalUrl, message: errorMsg });
      return next();
    }
  });

  // BLOG TAG ARCHIVE SSR (Phase 1 schema ownership)
  app.get(/^\/blog\/tag\/([^\/]+)(?:\/([^\/]+))?\/?$/, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const segments = req.path.replace(/\/+$/, "").split("/").filter(Boolean);
      if (segments.length !== 3 && segments.length !== 4) return next();

      const tagPath = segments.length === 4
        ? `${segments[2]}/${segments[3]}`
        : segments[2];

      const tagResult = await pool.query(
        `SELECT id, name, slug FROM tags WHERE slug = $1 AND status = 'published' LIMIT 1`,
        [tagPath],
      );
      if (tagResult.rows.length === 0) {
        return serve404Page(res, "Tag Not Found", "This tag could not be found");
      }

      const tag = tagResult.rows[0] as { id: string; name: string; slug: string };
      const pageCountResult = await pool.query(
        `SELECT COUNT(*)::int AS count
         FROM pages p
         INNER JOIN page_tags pt ON pt.page_id = p.id
         WHERE p.status = 'published' AND pt.tag_id = $1`,
        [tag.id],
      );
      const pageCount = Number(pageCountResult.rows[0]?.count || 0);

      const canonicalPath = `/blog/tag/${tagPath}`;
      const canonicalUrl = `https://www.askdetectives.com${canonicalPath}`;
      const heading = `#${tag.name}`;
      const title = `${tag.name} | Pages`;
      const description = `Explore all articles tagged "${tag.name}" on AskDetectives.`;

      let html = injectServiceSeoTags(await readIndexHtml(), {
        title,
        h1: heading,
        meta_description: description,
      }, canonicalUrl);

      const fragmentHtml = buildArchiveSsrFragment({
        heading,
        subtitle: `${pageCount} pages`,
        breadcrumbs: [
          { name: "Home", url: "https://www.askdetectives.com/" },
          { name: "Blog", url: "https://www.askdetectives.com/blog" },
          { name: heading, url: canonicalUrl },
        ],
      });
      html = stripHiddenSeoH1(html);
      html = injectFragmentBeforeRoot(html, fragmentHtml);

      if (pageCount > 0) {
        html = injectPhase1Schemas(html, {
          canonicalUrl,
          pageType: "CollectionPage",
          pageName: heading,
          pageDescription: description,
          breadcrumbs: [
            { name: "Home", url: "https://www.askdetectives.com/" },
            { name: "Blog", url: "https://www.askdetectives.com/blog" },
            { name: heading, url: canonicalUrl },
          ],
        });
      } else {
        html = html.replace(
          /<meta\s+name=["']robots["'][^>]*>/i,
          '<meta name="robots" content="noindex, follow" data-ssr-robots="authoritative">',
        );
      }

      return sendIndexHtmlResponse(req, res, html, "public, max-age=3600, stale-while-revalidate=86400");
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      console.error("[Tag Archive SSR] Error:", { url: req.originalUrl, message: errorMsg });
      return next();
    }
  });

  // Homepage route - serves client index.html
  app.get("/", async (_req: Request, res: Response) => {
    try {
      let html = await readIndexHtml();
      const [cmsSeo, siteSettings] = await Promise.all([
        getPublishedCmsPageSeo("/"),
        storage.getSiteSettings(),
      ]);
      const seo = cmsSeo ?? {
        title: "Find Detectives - Hire Top Private Investigators | AskDetectives",
        description: "The world's first dedicated detective service platform. A single place to discover, compare, and hire professional detectives across verified categories.",
        h1: "Find the Perfect Private Detectives Near You - AskDetectives",
      };
      const logoUrl = (siteSettings as any)?.headerLogoUrl || (siteSettings as any)?.logoUrl || null;
      html = injectCmsPageSeoTags(html, seo, "https://www.askdetectives.com/", { logoUrl });

      // Homepage: allow 1-hour browser/CDN cache, refresh in background (stale-while-revalidate)
      sendIndexHtmlResponse(_req, res, html, "public, max-age=3600, stale-while-revalidate=86400");
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      console.error("[Homepage] Error:", {
        message: errorMsg,
        stack: error instanceof Error ? error.stack : undefined,
      });
      // Fallback to plain error response
      res.status(500).type("text/plain").send("Error loading page");
    }
  });

  // Register static file middleware AFTER SSR routes
  app.use(express.static(distPath, {
    maxAge: "1y",
    immutable: true,
    setHeaders: (res, filePath) => {
      if (filePath.endsWith("index.html")) {
        res.setHeader("Cache-Control", "no-store");
      }
    }
  }));

  // SPA fallback: only after all API routes and middleware
  app.get("*", async (req, res) => {
    if (req.path.startsWith("/api")) return res.status(404).end();
    if (isStaticAssetPath(req.path)) return res.status(404).end();
    if (!isKnownSpaPath(req.path)) {
      return serve404Page(res, 'Page Not Found', 'This page could not be found');
    }

    try {
      const html = await readIndexHtml();
      sendIndexHtmlResponse(req, res, html, "no-store");
    } catch {
      res.status(500).type("text/plain").send("Error loading page");
    }
  });
}

/**
 * Helper to serve index.html with optional SEO injection
 */
async function serveIndexHtmlWithSeo(
  res: Response,
  indexHtmlPath: string,
  detective: any | null,
  cachedHtml: string | null
): Promise<void> {
  try {
    let html = cachedHtml || (await fs.promises.readFile(indexHtmlPath, 'utf-8'));
    
    if (detective) {
      const canonicalUrl = `https://www.askdetectives.com${res.req.path.replace(/\/$/, '')}/`;
      html = injectSeoTags(html, detective, canonicalUrl);
    }

    sendIndexHtmlResponse(res.req as Request, res, html, "no-store");
  } catch (error) {
    console.error('[SEO] Error serving index.html:', error);
    res.status(500).type("text/plain").send("Error loading page");
  }
}

// Global error handlers
process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught Exception:', error);
  if (config.env.isProd && config.sentryDsn) {
    Sentry.captureException(error);
  }
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
  if (config.env.isProd && config.sentryDsn) {
    Sentry.captureException(reason);
  }
  process.exit(1);
});

process.on('exit', (code) => {
  console.log(`Process exiting with code: ${code}`);
});

process.on('SIGTERM', async () => {
  console.log('SIGTERM received, shutting down gracefully...');
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('SIGINT received, shutting down gracefully...');
  process.exit(0);
});

// Main startup function
async function main() {
  try {
    // Initialize environment with logging
    console.log(`\n${getEnvironmentBadge()} Environment`);
    await initializeEnv();

    // Log Supabase configuration (environment-only)
    const supabaseUrl = process.env.SUPABASE_URL;
    if (supabaseUrl) {
      try {
        const supabaseHost = new URL(supabaseUrl).hostname;
        const isLocal = supabaseHost.includes('localhost') || supabaseHost.includes('127.0.0.1');
        console.log(`📦 Supabase: ${isLocal ? '🟢 Local' : '☁️  Cloud'} (${supabaseHost})`);
        console.log(`   Source: Hosting Provider Environment Variables`);
        if (isLocal) {
          console.warn(`   ⚠️  WARNING: Production mode using LOCAL Supabase!`);
          console.warn(`   This should only be for testing. Production should use cloud Supabase.`);
        }
      } catch (parseError) {
        console.warn(`⚠️  Supabase URL parsing failed:`, parseError);
        console.log(`📦 Supabase: Unable to parse (${supabaseUrl})`);
      }
    } else {
      console.log(`⚠️  Supabase: Not configured (storage disabled)`);
    }

    console.log('🚀 Starting server initialization...');

    if (process.env.NODE_ENV !== "production") {
      throw new Error("NODE_ENV must be production for production boot. Set NODE_ENV=production.");
    }

    console.log('🔐 Loading auth/secrets from database...');
    await loadSecretsFromDatabase();
    
    const { secretsLoadedSuccessfully } = await import("./lib/secretsLoader.js");
    
    // NOTE: Database migrations are NOT run in production serverless environments
    // Migrations should be applied via CI/CD pipeline or separate migration job
    // Running migrations on every cold start causes request timeouts
    console.log('ℹ️  Skipping migrations (production assumes migrations pre-applied)');
    
    if (config.env.isProd && config.sentryDsn) {
      Sentry.init({
        dsn: config.sentryDsn,
        environment: process.env.NODE_ENV || "production",
        integrations: [nodeProfilingIntegration()],
        tracesSampleRate: 0.1, // 10% of requests for performance monitoring
        profilesSampleRate: 0.1, // 10% profiling
        beforeSend(event, _hint) {
          // PII scrubbing: redact sensitive fields
          if (event.request) {
            // Redact sensitive headers
            if (event.request.headers) {
              delete event.request.headers['authorization'];
              delete event.request.headers['cookie'];
              delete event.request.headers['x-api-key'];
            }
            // Redact sensitive body fields
            if (event.request.data && typeof event.request.data === 'object') {
              const data = event.request.data as Record<string, unknown>;
              const sensitiveKeys = ['password', 'temporaryPassword', 'token', 'apiKey', 'creditCard', 'ssn', 'passport', 'csrfToken', 'session_secret'];
              for (const key of sensitiveKeys) {
                if (key in data) {
                  data[key] = '[REDACTED]';
                }
              }
            }
          }
          return event;
        },
      });
    }

    if (config.env.isProd) {
      console.log('📋 Validating production config...');
      validateConfig(secretsLoadedSuccessfully);
    }

    console.log('🔍 Validating database connection...');
    await validateDatabase();

    console.log('⚙️  Starting Express app...');
    await runApp(serveStatic);
    
    console.log('✅ Server started successfully');
    console.log("✅ Production ready: DB-backed secrets loaded, validations passed");
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    if (config.env.isProd && config.sentryDsn) {
      Sentry.captureException(error);
    }
    process.exit(1);
  }
}

// Start the server
main();

