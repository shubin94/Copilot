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
import { isKnownSpaPath, isStaticAssetPath } from "./lib/spa-route-manifest.js";
import {
  extractDetectiveRouteParams,
  getDetectiveBySlugForSEO,
  injectSeoTags,
  extractLocationRouteParams,
  getLocationDetectivesForSEO,
  injectLocationSeoTags,
  injectDetectiveLocationAuthorityLink,
  resolveLocationIds,
  generateDetectiveSeo,
  getServiceLocationSeo,
  generateServiceLocationSeo,
} from "./lib/seo-injection.js";
import {
  getTopNearbyCities,
  getPopularServicesInCity,
  getOtherAreasInCity,
  getOtherServicesInCity,
  getNearbyCities,
} from "./lib/internal-links.js";
import { getPublishedCmsPageSeo, injectCmsPageSeoTags } from "./lib/cms-page-seo.js";
import { storage } from "./storage.js";

const STATIC_CMS_SEO_SLUGS = new Set([
  "about",
  "contact",
  "support",
  "privacy",
  "terms",
  "packages",
  "categories",
]);

// Sentry is optional. To enable, set sentry_dsn in app_secrets and restart.

/**
 * Serves a properly structured 404 page with navigation links, noindex meta, and breadcrumb schema.
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
  <script type="application/ld+json">{"@context":"https://schema.org","@type":"BreadcrumbList","itemListElement":[{"@type":"ListItem","position":1,"name":"Home","item":"https://www.askdetectives.com"}]}</script>
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

  const fallback404File = path.resolve(distPath, "404.html");
  const indexHtmlPath = path.resolve(distPath, "index.html");
  let cachedIndexHtml: string | null = null;

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
        res.setHeader("Cache-Control", "public, max-age=3600, stale-while-revalidate=86400");
        res.setHeader("Content-Type", "text/html; charset=utf-8");
        res.setHeader("X-SSR-Cache", "HIT");
        return res.send(cachedHtml);
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
        // Load cache first if not already loaded, then pass to handler
        if (!cachedIndexHtml) {
          cachedIndexHtml = await fs.promises.readFile(indexHtmlPath, 'utf-8');
        }
        return serveIndexHtmlWithSeo(res, indexHtmlPath, null, cachedIndexHtml);
      }

      // ✅ OPTIMIZATION: Load index HTML template once and cache in memory
      // Subsequent requests reuse from module-level cachedIndexHtml variable
      // This eliminates disk I/O on every request (typical 10-30ms saved per request)
      if (!cachedIndexHtml) {
        cachedIndexHtml = await fs.promises.readFile(indexHtmlPath, 'utf-8');
      }

      const isCity = segments.length === 4; // /detectives/:country/:state/:city

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
      const [seoValues, locationSeoData, nearbyCities, popularServices] = await Promise.all([
        getDetectiveLocationSeo(params.country, params.state, params.city),
        getLocationDetectivesForSEO(params.country, params.state, params.city),
        getTopNearbyCities(params.country, params.city, 20),
        getPopularServicesInCity(params.city, 20)
      ]);
      const detectives = locationSeoData.detectives;
      const hasMore = locationSeoData.hasMore;
      const detectiveCount = detectives ? detectives.length : 0;

      // Generate canonical URL
      const canonicalUrl = `https://www.askdetectives.com${requestPath.replace(/\/$/, '')}/`;

      // Internal linking HTML
      let linksHtml = '<section style="margin-top:32px">';
      linksHtml += '<h2 style="font-size:1.2rem;font-weight:600;margin-bottom:12px">Top Nearby Cities</h2>';
      linksHtml += '<ul style="margin-bottom:24px">';
      for (const city of nearbyCities.rows.slice(0, 20)) {
        linksHtml += `<li><a href="/detectives/${params.country}/${city.slug}" style="color:#2563eb;text-decoration:none">Private Detectives in ${city.name}</a></li>`;
      }
      linksHtml += '</ul>';
      linksHtml += `<h2 style="font-size:1.2rem;font-weight:600;margin-bottom:12px">Popular Services in Nearby Cities</h2>`;
      linksHtml += '<ul>';
      for (const svc of popularServices.rows.slice(0, 20)) {
        linksHtml += `<li><a href="/locations/${svc.slug}/${params.country}/${params.city}" style="color:#2563eb;text-decoration:none">${svc.name} in ${params.city}</a></li>`;
      }
      linksHtml += '</ul>';
      linksHtml += '</section>';

      let seoHtml = injectSeoTags(cachedIndexHtml, {
        title: seoValues.meta_title,
        h1: seoValues.h1,
        meta_description: seoValues.meta_description
      });

      // Handle zero-detective pages
      if (detectiveCount === 0) {
        // Add noindex meta tag
        seoHtml = seoHtml.replace('<head>', '<head>\n<meta name="robots" content="noindex, follow">');
        // Show special message
        const cityName = params.city ? params.city.replace(/-/g, ' ') : 'this location';
        const noDetectiveHtml = `<section style="margin-top:32px"><h2 style="font-size:1.5rem;font-weight:700;margin-bottom:16px">No detectives available in ${cityName} yet.</h2><p style="color:#6b7280;margin-bottom:24px;">We are expanding our network. Please check nearby cities or popular services below.</p></section>`;
        seoHtml = seoHtml.replace('</body>', `${noDetectiveHtml}${linksHtml}</body>`);
      } else {
        // Indexable page, show detective listings and internal links
        seoHtml = seoHtml.replace('</body>', `${linksHtml}</body>`);
      }

      setSsrCache(cacheKey, seoHtml);
      res.setHeader("Cache-Control", "public, max-age=3600, stale-while-revalidate=86400");
      res.setHeader("Content-Type", "text/html; charset=utf-8");
      res.setHeader("X-SSR-Cache", "MISS");
      return res.send(seoHtml);

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

      if (!cachedIndexHtml) {
        cachedIndexHtml = await fs.promises.readFile(indexHtmlPath, 'utf-8');
      }

      const canonicalUrl = `https://www.askdetectives.com${requestPath.replace(/\/$/, '')}/`;

      // Fetch detective data for SEO
      let detectiveSeo;
      try {
        detectiveSeo = await getDetectiveLocationSeo(country, state, city);
      } catch (e) {
        detectiveSeo = generateDetectiveSeo(country, state, city);
      }
      const seoHtml = injectSeoTags(cachedIndexHtml, detectiveSeo, canonicalUrl);
      res.setHeader("Cache-Control", "public, max-age=3600, stale-while-revalidate=86400");
      res.setHeader("Content-Type", "text/html; charset=utf-8");
      return res.send(seoHtml);

    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      console.error('[Service Detail SEO] Error:', { url: req.originalUrl, message: errorMsg });
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      return res.status(500).send(
        '<html><head><title>Server Error</title></head><body><h1>500 - Server Error</h1></body></html>'
      );
    }
  });

  // CATCH-ALL ROUTE FOR UNMATCHED /detectives PATHS (6+ segments or invalid patterns)
  // Prevents hard 404s for paths like /detectives/:country/:state/:city/:agency/:something
  // Serves SPA to allow client-side routing to handle navigation
  app.get(/^\/detectives\//, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const requestPath = req.path;
      const segments = requestPath.replace(/\/+$/, '').split('/').filter(s => s);
      
      // Skip if already handled by earlier routes (2-5 segments)
      if (segments.length <= 5) {
        return next(); // Pass through to next middleware/catch-all
      }

      console.log(`[Detectives Catch-All] Serving SPA for unmatched path: ${requestPath} (${segments.length} segments)`);
      
      if (!cachedIndexHtml) {
        cachedIndexHtml = await fs.promises.readFile(indexHtmlPath, 'utf-8');
      }

      res.setHeader("Cache-Control", "public, max-age=3600, stale-while-revalidate=86400");
      res.setHeader("Content-Type", "text/html; charset=utf-8");
      return res.send(cachedIndexHtml);
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

      // ✅ SSR CACHE: serve pre-rendered HTML within 5-min TTL
      const serviceCacheKey = `svc:${requestPath.replace(/\/+$/, '').toLowerCase()}`;
      const cachedServiceHtml = getSsrCache(serviceCacheKey);
      if (cachedServiceHtml) {
        res.setHeader("Cache-Control", "public, max-age=3600, stale-while-revalidate=86400");
        res.setHeader("Content-Type", "text/html; charset=utf-8");
        res.setHeader("X-SSR-Cache", "HIT");
        return res.send(cachedServiceHtml);
      }

      const {
        extractServiceLocationRouteParams,
        resolveServiceLocation,
      } = await import("./lib/seo-injection.js");

      const params = extractServiceLocationRouteParams(requestPath);
      if (!params) {
        console.warn("[Service SEO] Route params extraction failed for:", requestPath);
        return serve404Page(res, 'Service Not Found', 'Invalid service route');
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
      const serviceResults = await storage.searchServices(
        {
          category: params.category,
          country: location.countryCode,
          state: location.stateName,
          city: location.cityName,
        },
        50,
        0,
        "popular"
      );

      // Return 404 if no services found
      if (!serviceResults || serviceResults.length === 0) {
        console.log("[Service SEO] No services found for location");
        return serve404Page(res, 'No Services Found', `No ${params.category} services found in this location`);
      }

      console.log(`[Service SEO] Found ${serviceResults.length} services`);

      // Generate canonical URL
      const canonicalUrl = `https://www.askdetectives.com${requestPath.replace(/\/$/, '')}/`;

      // Load and inject SEO tags
      if (!cachedIndexHtml) {
        cachedIndexHtml = await fs.promises.readFile(indexHtmlPath, 'utf-8');
      }

      // Fetch SEO values and service listings in parallel
      let [otherAreas, otherServices, nearbyCities] = await Promise.all([
        getOtherAreasInCity(params.citySlug || '', '', 20),
        getOtherServicesInCity(params.citySlug || '', params.categorySlug, 20),
        getNearbyCities(params.countrySlug, params.citySlug || '', 20)
      ]);
      let seoValues;
      try {
        seoValues = await getServiceLocationSeo(params.categorySlug, params.countrySlug, params.citySlug || '', '');
      } catch (e) {
        seoValues = generateServiceLocationSeo(params.categorySlug, params.countrySlug, params.citySlug || '', '');
      }
      let seoHtml = injectSeoTags(cachedIndexHtml, {
        title: seoValues.meta_title,
        h1: seoValues.h1,
        meta_description: seoValues.meta_description
      }, canonicalUrl);

      // Internal linking HTML
      let linksHtml = '<section style="margin-top:32px">';
      linksHtml += '<h2 style="font-size:1.2rem;font-weight:600;margin-bottom:12px">Other Areas in ' + params.citySlug + '</h2>';
      linksHtml += '<ul style="margin-bottom:24px">';
      for (const area of otherAreas.rows.slice(0, 20)) {
        linksHtml += `<li><a href="/locations/${params.categorySlug}/${params.countrySlug}/${params.citySlug}/${area.slug}" style="color:#2563eb;text-decoration:none">${params.categorySlug} in ${area.name}, ${params.citySlug}</a></li>`;
      }
      linksHtml += '</ul>';
      linksHtml += '<h2 style="font-size:1.2rem;font-weight:600;margin-bottom:12px">Other Services in ' + params.citySlug + '</h2>';
      linksHtml += '<ul style="margin-bottom:24px">';
      for (const svc of otherServices.rows.slice(0, 20)) {
        linksHtml += `<li><a href="/locations/${svc.slug}/${params.countrySlug}/${params.stateSlug || ''}/${params.citySlug || ''}" style="color:#2563eb;text-decoration:none">${svc.name} in ${params.citySlug || params.stateSlug || params.countrySlug}</a></li>`;
      }
      linksHtml += '</ul>';
      linksHtml += '<h2 style="font-size:1.2rem;font-weight:600;margin-bottom:12px">Nearby Cities</h2>';
      linksHtml += '<ul>';
      for (const city of nearbyCities.rows.slice(0, 20)) {
        linksHtml += `<li><a href="/locations/${params.categorySlug}/${params.countrySlug}/${params.stateSlug || city.slug}" style="color:#2563eb;text-decoration:none">${params.categorySlug} in ${city.name}</a></li>`;
      }
      linksHtml += '</ul>';
      linksHtml += '</section>';

      // Insert links before </body>
      seoHtml = seoHtml.replace('</body>', `${linksHtml}</body>`);

      setSsrCache(serviceCacheKey, seoHtml);
      res.setHeader("Cache-Control", "public, max-age=3600, stale-while-revalidate=86400");
      res.setHeader("Content-Type", "text/html; charset=utf-8");
      res.setHeader("X-SSR-Cache", "MISS");
      return res.send(seoHtml);

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

  // STATIC CMS PAGE SEO INJECTION (Production)
  // Intercepts specific static routes and injects title/description in server HTML source.
  app.get(/^\/(about|contact|support|privacy|terms|packages|categories)\/?$/, async (req: Request, res: Response) => {
    try {
      const slug = req.path.replace(/^\/+|\/+$/g, "");
      if (!STATIC_CMS_SEO_SLUGS.has(slug)) {
        return res.status(404).type("text/plain").send("Not Found");
      }

      if (!cachedIndexHtml) {
        cachedIndexHtml = await fs.promises.readFile(indexHtmlPath, "utf-8");
      }

      const seo = await getPublishedCmsPageSeo(slug);
      let html = cachedIndexHtml;

      if (seo) {
        const canonicalPath = req.path.replace(/\/$/, "") || `/${slug}`;
        const canonicalUrl = `https://www.askdetectives.com${canonicalPath}`;
        html = injectCmsPageSeoTags(cachedIndexHtml, seo, canonicalUrl);
      }

      res.setHeader("Cache-Control", "no-store");
      res.setHeader("Content-Type", "text/html; charset=utf-8");
      return res.send(html);
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      console.error("[SEO] Static CMS page SEO injection failed:", {
        url: req.originalUrl,
        message: errorMsg,
      });
      return res.status(500).type("text/plain").send("Error loading page");
    }
  });

  // Homepage route - serves client index.html
  app.get("/", async (_req: Request, res: Response) => {
    try {
      // Read index.html once and cache it
      if (!cachedIndexHtml) {
        cachedIndexHtml = await fs.promises.readFile(indexHtmlPath, "utf-8");
      }

      let html = cachedIndexHtml;
      const seo = await getPublishedCmsPageSeo("/");
      if (seo) {
        html = injectCmsPageSeoTags(cachedIndexHtml, seo, "https://www.askdetectives.com/");
      }

      // Homepage: allow 1-hour browser/CDN cache, refresh in background (stale-while-revalidate)
      res.setHeader("Cache-Control", "public, max-age=3600, stale-while-revalidate=86400");
      res.setHeader("Content-Type", "text/html; charset=utf-8");
      res.send(html);
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

  // ✅ OPTIMIZATION: Register static file middleware AFTER SSR routes
  // This prevents filesystem lookups from blocking SSR route handlers
  // SSR routes match immediately, static assets still serve correctly
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

  // Route-aware SPA fallback: unknown routes return true HTTP 404
  app.use("*", (req, res) => {
    const requestPath = req.path;

    if (requestPath.startsWith("/api/")) {
      return res.status(404).json({ error: "Not Found" });
    }

    if (isStaticAssetPath(requestPath)) {
      return res.status(404).end();
    }

    res.setHeader("Cache-Control", "no-store");

    if (isKnownSpaPath(requestPath)) {
      return res.status(200).sendFile(path.resolve(distPath, "index.html"));
    }

    if (fs.existsSync(fallback404File)) {
      return res.status(404).sendFile(fallback404File);
    }

    return res.status(404).type("text/plain").send("404 Not Found");
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

    res.setHeader("Cache-Control", "no-store");
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.send(html);
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

