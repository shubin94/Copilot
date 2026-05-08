import "./lib/loadEnv.js";
import fs from "node:fs";
import { type Server } from "node:http";
import path from "node:path";

import type { Express, Request, Response } from "express";
import { nanoid } from "nanoid";
import { createServer as createViteServer, createLogger } from "vite";

import runApp from "./app.js";

import viteConfig from "../vite.config.js";
import { config, validateConfig } from "./config.js";
import { loadSecretsFromDatabase } from "./lib/secretsLoader.js";
import { validateDatabase } from "./startup.js";
import { initializeEnv } from "./lib/loadEnv.js";
import { getEnvironmentBadge } from "../db/validateDatabase.js";
import { isKnownSpaPath, isStaticAssetPath } from "./lib/spa-route-manifest.js";
import {
  extractDetectiveRouteParams,
  getDetectiveBySlugForSEO,
  getServiceBySlugForSEO,
  injectSeoTags,
  injectServiceSeoTags,
  extractLocationRouteParams,
  getLocationDetectivesForSEO,
  injectLocationSeoTags,
  injectDetectiveLocationAuthorityLink,
  resolveLocationIds,
  getServiceLocationSeo,
  generateServiceLocationSeo,
} from "./lib/seo-injection.js";
import { getPublishedCmsPageSeo, injectCmsPageSeoTags } from "./lib/cms-page-seo.js";
import { storage } from "./storage.js";

const viteLogger = createLogger();
const STATIC_CMS_SEO_SLUGS = new Set([
  "about",
  "contact",
  "support",
  "privacy",
  "terms",
  "packages",
  "categories",
]);

function serveDev404Page(res: Response, title: string, message: string): void {
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${title} | Ask Detectives</title>
  <meta name="robots" content="noindex, follow" />
</head>
<body style="font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;max-width:760px;margin:64px auto;padding:0 16px;">
  <h1>${message}</h1>
  <p>The requested route is not part of the SPA route manifest.</p>
  <p><a href="/">Go to homepage</a></p>
</body>
</html>`;
  res.status(404).set({ "Content-Type": "text/html; charset=utf-8" }).end(html);
}

export async function setupVite(app: Express, server: Server) {
  const serverOptions = {
    middlewareMode: true,
    // Reuse the existing HTTP server for HMR websocket to avoid standalone WS port conflicts.
    hmr: { server },
    allowedHosts: true as const,
  };

  const vite = await createViteServer({
    ...viteConfig,
    configFile: false,
    customLogger: {
      ...viteLogger,
      error: (msg, options) => {
        viteLogger.error(msg, options);
        process.exit(1);
      },
    },
    server: serverOptions,
    appType: "custom",
  });

  // ============================================================================
  // STEP 1: SEO ROUTE INTERCEPTION (MUST be BEFORE app.use(vite.middlewares))
  // ============================================================================
  // These specific route handlers run FIRST, before Vite middleware intercepts
  // Ensures SEO injection logic executes before Vite's file serving
  // ============================================================================

  // LOCATION LISTING SEO INJECTION (Development)
  // Intercepts /detectives/:country, /detectives/:country/:state, /detectives/:country/:state/:city
  app.get(/^\/detectives\/[^\/]+(?:\/[^\/]+)?(?:\/[^\/]+)?\/?$/, async (req: Request, res: Response) => {
    try {
      console.log("[SEO DEBUG] Location route matched:", req.originalUrl);
      const requestPath = req.path;
      const params = extractLocationRouteParams(requestPath);

      // Check if this is actually a location listing page (2-4 segments)
      const segments = requestPath.replace(/\/+$/, '').split('/').filter(s => s);
      if (segments.length !== 2 && segments.length !== 3 && segments.length !== 4) {
        // Not a location listing page
        return attachViteTransform(vite, res, req, '');
      }

      if (!params) {
        console.warn("[SEO] Location params extraction failed for:", requestPath);
        return attachViteTransform(vite, res, req, '');
      }

      console.log("[SEO] Fetching detectives for location:", { country: params.country, state: params.state, city: params.city });

      // Fetch detective listings for this location
      const locationSeoData = await getLocationDetectivesForSEO(
        params.country,
        params.state,
        params.city,
        15,
        0,
        { includeTotalCount: true }
      );
      const detectives = locationSeoData.detectives;
      const seoDetectives = detectives
        .filter((d) => Boolean(d.slug) && Boolean(d.businessName))
        .map((d) => ({
          slug: d.slug as string,
          businessName: d.businessName as string,
          city: d.city,
          state: d.state,
          country: d.country,
        }));
      const hasMore = locationSeoData.hasMore;

      // If no detectives found for this location, return 404
      if (!detectives || detectives.length === 0) {
        console.log("[SEO] No detectives found for location:", params);
        return res.status(404).set({ "Content-Type": "text/html" }).send(
          "<html><head><title>Location Not Found</title></head><body><h1>404 - No detectives in this location</h1></body></html>"
        );
      }

      console.log(`[SEO] Found ${detectives.length} detectives for location (hasMore: ${hasMore}): ${params.country}${params.state ? '/' + params.state : ''}${params.city ? '/' + params.city : ''}`);

      const clientTemplate = path.resolve(
        import.meta.dirname,
        "..",
        "client",
        "index.html",
      );

      let template = await fs.promises.readFile(clientTemplate, "utf-8");
      template = template.replace(
        `src="/src/main.tsx"`,
        `src="/src/main.tsx?v=${nanoid()}"`,
      );

      const canonicalUrl = `https://www.askdetectives.com${requestPath.replace(/\/$/, '')}/`;

      // Transform through Vite FIRST so its HTML pipeline can't strip injected elements
      let transformedHtml = await vite.transformIndexHtml(req.originalUrl, template);

      const resolvedLocation = await resolveLocationIds({
        country: params.country,
        state: params.state,
        city: params.city,
      });

      // Inject SEO tags (H1, meta, JSON-LD) AFTER Vite transform
      transformedHtml = await injectLocationSeoTags(
        transformedHtml,
        params,
        seoDetectives,
        canonicalUrl,
        detectives.length,
        resolvedLocation
      );
      console.log(`[DEV-SEO] Successfully injected meta tags for location: ${params.country}${params.state ? '/' + params.state : ''}${params.city ? '/' + params.city : ''} (${detectives.length} detectives, hasMore: ${hasMore})`);

      // Inject detective data as JSON for client-side rendering
      const cityPageData = {
        location: {
          country: params.country,
          state: params.state,
          city: params.city,
        },
        detectives: detectives,
        count: locationSeoData.totalCount,
        hasMore: hasMore,
      };

      const dataScript = `<script>
  window.__CITY_PAGE_DATA__ = ${JSON.stringify(cityPageData)};
</script>`;

      transformedHtml = transformedHtml.replace('</head>', `${dataScript}</head>`);
      console.log(`[DEV-SEO] Injected city page data for ${detectives.length} detectives into window.__CITY_PAGE_DATA__`);

      // CHECK IF CITY LEVEL: Inject detective → service authority link for city-level pages only
      const pathSegments = requestPath.replace(/\/+$/, '').split('/').filter(s => s);
      if (pathSegments.length === 4) { // /detectives/:country/:state/:city
        try {
          const countrySlug = pathSegments[1];
          const stateSlug = pathSegments[2];
          const citySlug = pathSegments[3];

          const servicesCheckResult = await storage.searchServices({
            category: "Background Check",
            country: params.country,
            state: params.state,
            city: params.city,
          });

          const servicesExist = servicesCheckResult && servicesCheckResult.length > 0;

          if (servicesExist) {
            transformedHtml = injectDetectiveLocationAuthorityLink(transformedHtml, {
              countrySlug,
              stateSlug,
              citySlug,
              cityName: params.city ?? "",
              stateName: params.state ?? "",
            }, true);
            console.log(`[DEV-SEO] Injected background check services link for ${params.city}, ${params.state}`);
          }
        } catch (err) {
          console.error("[DEV-SEO] Error injecting authority link:", err);
        }
      }
      
      res.setHeader("Cache-Control", "no-store");
      return res
        .status(200)
        .set({ "Content-Type": "text/html; charset=utf-8" })
        .end(transformedHtml);
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      console.error('[DEV-SEO Location] CRITICAL ERROR:', {
        url: req.originalUrl,
        message: errorMsg,
        stack: error instanceof Error ? error.stack : undefined,
      });
      // Return 500 error instead of silently falling back
      return res.status(500).set({ "Content-Type": "text/html" }).send(
        "<html><head><title>Server Error</title></head><body><h1>500 - Server Error</h1><p>Failed to load location detectives</p></body></html>"
      );
    }
  });

  // DETECTIVE PROFILE SEO INJECTION (Development)
  app.get(/^\/detectives\/[^\/]+\/[^\/]+\/[^\/]+\/[^\/]+\/?$/, async (req: Request, res: Response) => {
    try {
      console.log("[SEO DEBUG] Profile route matched:", req.originalUrl);
      const requestPath = req.path;
      const params = extractDetectiveRouteParams(requestPath);

      if (!params) {
        console.warn("[SEO] Profile params extraction failed for:", requestPath);
        return attachViteTransform(vite, res, req, '');
      }

      console.log("[SEO] Attempting to fetch detective with params:", {
        country: params.country,
        state: params.state,
        city: params.city,
        slug: params.slug,
      });

      // Fetch detective data for SEO
      const detective = await getDetectiveBySlugForSEO(
        params.country,
        params.state,
        params.city,
        params.slug
      );

      // If detective not found, return 404
      if (!detective) {
        console.log("[SEO] Detective not found:", params);
        return res.status(404).set({ "Content-Type": "text/html" }).send(
          "<html><head><title>Detective Not Found</title></head><body><h1>404 - Detective not found</h1></body></html>"
        );
      }

      console.log("[SEO] Detective found:", {
        businessName: detective.businessName,
        avgRating: detective.avgRating,
        reviewCount: detective.reviewCount,
      });

      const clientTemplate = path.resolve(
        import.meta.dirname,
        "..",
        "client",
        "index.html",
      );

      let template = await fs.promises.readFile(clientTemplate, "utf-8");
      template = template.replace(
        `src="/src/main.tsx"`,
        `src="/src/main.tsx?v=${nanoid()}"`,
      );

      const canonicalUrl = `https://www.askdetectives.com${requestPath.replace(/\/$/, '')}/`;
      // Transform through Vite FIRST (HMR, module scripts), THEN inject SEO tags
      // This prevents Vite's HTML pipeline from stripping injected elements (H1, meta, JSON-LD)
      let page = await vite.transformIndexHtml(req.originalUrl, template);
      page = injectSeoTags(page, detective, canonicalUrl);
      console.log(`[DEV-SEO] Successfully injected meta tags for detective: ${detective.businessName || 'Unknown'}`);

      res.setHeader("Cache-Control", "no-store");
      res.set({ "Content-Type": "text/html" }).end(page);
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      console.error('[DEV-SEO] CRITICAL ERROR in profile handler:', {
        url: req.originalUrl,
        message: errorMsg,
        stack: error instanceof Error ? error.stack : undefined,
      });
      // Return 500 error instead of silently falling back
      return res.status(500).set({ "Content-Type": "text/html" }).send(
        "<html><head><title>Server Error</title></head><body><h1>500 - Server Error</h1><p>Failed to load detective profile</p></body></html>"
      );
    }
  });

  // SERVICE DETAIL PAGE ROUTE (Development)
  // Intercepts /service/:country/:state/:city/:detectiveSlug/:serviceSlug
  app.get(/^\/service\/[^\/]+\/[^\/]+\/[^\/]+\/[^\/]+\/[^\/]+\/?$/, async (req: Request, res: Response) => {
    try {
      const requestPath = req.path;
      const segments = requestPath.replace(/\/+$/, '').split('/').filter(s => s);
      
      // Validate we have exactly 6 segments (service + 5 params)
      if (segments.length !== 6 || segments[0] !== 'service') {
        return; // Fall through to other handlers
      }

      const [, country, state, city, detectiveSlug, serviceSlug] = segments;

      const clientTemplate = path.resolve(import.meta.dirname, "..", "client", "index.html");
      let template = await fs.promises.readFile(clientTemplate, "utf-8");
      template = template.replace(`src="/src/main.tsx"`, `src="/src/main.tsx?v=${nanoid()}"`);

      // Fetch service + detective data for SEO
      const seoData = await getServiceBySlugForSEO(country, state, city, detectiveSlug, serviceSlug);
      const canonicalUrl = seoData
        ? `https://www.askdetectives.com${seoData.canonicalPath}`
        : `https://www.askdetectives.com${requestPath.replace(/\/$/, "")}`;

      let page = await vite.transformIndexHtml(req.originalUrl, template);
      if (seoData) {
        page = injectServiceSeoTags(page, {
          title: seoData.meta_title,
          h1: seoData.h1,
          meta_description: seoData.meta_description,
        }, canonicalUrl);
      }

      res.setHeader("Cache-Control", "no-store");
      res.set({ "Content-Type": "text/html; charset=utf-8" }).end(page);

    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      console.error('[Service Detail Dev] Error:', {
        url: req.originalUrl,
        message: errorMsg,
      });
      return res.status(500).set({ "Content-Type": "text/html" }).send(
        "<html><head><title>Server Error</title></head><body><h1>500 - Server Error</h1></body></html>"
      );
    }
  });

  // SERVICE + LOCATION SEO INJECTION (Development)
  // Intercepts /services/background-checks/:country/:state/:city
  app.get(/^\/services\/background-checks\/[^\/]+\/[^\/]+\/[^\/]+\/?$/, async (req: Request, res: Response) => {
    try {
      console.log("[Service SEO] Request matched:", req.originalUrl);
      const requestPath = req.path;
      
      const {
        extractServiceLocationRouteParams,
        resolveServiceLocation,
        injectServiceLocationSeoTags,
      } = await import("./lib/seo-injection.js");

      const params = extractServiceLocationRouteParams(requestPath);
      if (!params) {
        console.warn("[Service SEO] Route params extraction failed for:", requestPath);
        return attachViteTransform(vite, res, req, '');
      }

      console.log("[Service SEO] Extracted params:", params);

      // Resolve location slugs to actual country/state/city
      const location = await resolveServiceLocation(params.countrySlug, params.stateSlug, params.citySlug);
      if (!location) {
        console.log("[Service SEO] Location resolution failed for:", {
          country: params.countrySlug,
          state: params.stateSlug,
          city: params.citySlug,
        });
        return res.status(404).set({ "Content-Type": "text/html" }).send(
          "<html><head><title>Location Not Found</title></head><body><h1>404 - Location not found</h1></body></html>"
        );
      }

      console.log("[Service SEO] Location resolved:", location);

      // Fetch background check services for this location
      const serviceResults = await storage.searchServices(
        {
          category: "Background Check",
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
        console.log("[Service SEO] No services found for location:", location);
        return res.status(404).set({ "Content-Type": "text/html" }).send(
          "<html><head><title>No Services Found</title></head><body><h1>404 - No background check services in this location</h1></body></html>"
        );
      }

      console.log(`[Service SEO] Found ${serviceResults.length} services for ${location.cityName}, ${location.stateName}`);

      const clientTemplate = path.resolve(
        import.meta.dirname,
        "..",
        "client",
        "index.html",
      );

      let template = await fs.promises.readFile(clientTemplate, "utf-8");
      template = template.replace(
        `src="/src/main.tsx"`,
        `src="/src/main.tsx?v=${nanoid()}"`,
      );

      const canonicalUrl = `https://www.askdetectives.com${requestPath.replace(/\/$/, '')}/`;

      // Transform through Vite FIRST, then inject SEO tags so Vite can't strip them
      let page = await vite.transformIndexHtml(req.originalUrl, template);
      page = await injectServiceLocationSeoTags(page, {
        countrySlug: params.countrySlug,
        stateSlug: params.stateSlug,
        citySlug: params.citySlug,
        countryName: location.countryName,
        stateName: location.stateName,
        cityName: location.cityName,
      }, serviceResults, canonicalUrl);

      console.log(`[Service SEO SSR] Injected ${params.categorySlug} for ${location.cityName}`);

      res.setHeader("Cache-Control", "no-store");
      res.set({ "Content-Type": "text/html" }).end(page);
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      console.error('[Service SEO] CRITICAL ERROR:', {
        url: req.originalUrl,
        message: errorMsg,
        stack: error instanceof Error ? error.stack : undefined,
      });
      return res.status(500).set({ "Content-Type": "text/html" }).send(
        "<html><head><title>Server Error</title></head><body><h1>500 - Server Error</h1><p>Failed to load services</p></body></html>"
      );
    }
  });

  // SERVICE + LOCATION SEO INJECTION (Development)
  // Intercepts /locations/:category/:country/:state/:city/
  app.get(/^\/locations\/[^\/]+\/[^\/]+(?:\/[^\/]+)?(?:\/[^\/]+)?\/?$/, async (req: Request, res: Response) => {
    try {
      const requestPath = req.path;
      const { extractServiceLocationRouteParams, resolveServiceLocation } = await import("./lib/seo-injection.js");

      const params = extractServiceLocationRouteParams(requestPath);
      if (!params) {
        return attachViteTransform(vite, res, req, '');
      }

      const location = await resolveServiceLocation(params.countrySlug, params.stateSlug, params.citySlug);
      if (!location) {
        return res.status(404).set({ "Content-Type": "text/html" }).send(
          "<html><head><title>Location Not Found</title></head><body><h1>404 - Location not found</h1></body></html>"
        );
      }

      const serviceResults = await storage.searchServices(
        { categorySlug: params.categorySlug },
        50, 0, "popular", false,
        {
          countryId: location.countryId,
          stateId: location.stateId ?? null,
          cityId: location.cityId ?? null,
          countryName: location.countryName,
          stateName: location.stateName ?? "",
          cityName: location.cityName ?? "",
        }
      );

      if (!serviceResults || serviceResults.length === 0) {
        return res.status(404).set({ "Content-Type": "text/html" }).send(
          "<html><head><title>No Services Found</title></head><body><h1>404 - No services in this location</h1></body></html>"
        );
      }

      const clientTemplate = path.resolve(import.meta.dirname, "..", "client", "index.html");
      let template = await fs.promises.readFile(clientTemplate, "utf-8");
      template = template.replace(`src="/src/main.tsx"`, `src="/src/main.tsx?v=${nanoid()}"`);

      const canonicalUrl = `https://www.askdetectives.com${requestPath.replace(/\/$/, '')}/`;

      let seoValues;
      try {
        seoValues = await getServiceLocationSeo(params.categorySlug, params.countrySlug, params.stateSlug || '', params.citySlug || '');
      } catch (e) {
        seoValues = generateServiceLocationSeo(params.categorySlug, params.countrySlug, params.citySlug || '', undefined, params.stateSlug || '');
      }

      let page = await vite.transformIndexHtml(req.originalUrl, template);
      page = injectServiceSeoTags(page, {
        title: seoValues.meta_title,
        h1: seoValues.h1,
        meta_description: seoValues.meta_description,
      }, canonicalUrl);

      res.setHeader("Cache-Control", "no-store");
      return res.status(200).set({ "Content-Type": "text/html; charset=utf-8" }).end(page);
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      console.error('[Service Location Dev SEO] Error:', { url: req.originalUrl, message: errorMsg });
      return attachViteTransform(vite, res, req, '');
    }
  });

  // STATIC CMS PAGE SEO INJECTION (Development)
  // Intercepts specific static routes and injects title/description in server HTML source.
  app.get(/^\/(about|contact|support|privacy|terms|packages|categories)\/?$/, async (req: Request, res: Response) => {
    try {
      const slug = req.path.replace(/^\/+|\/+$/g, "");
      if (!STATIC_CMS_SEO_SLUGS.has(slug)) {
        return attachViteTransform(vite, res, req, "");
      }

      const clientTemplate = path.resolve(
        import.meta.dirname,
        "..",
        "client",
        "index.html",
      );

      let template = await fs.promises.readFile(clientTemplate, "utf-8");
      template = template.replace(
        `src="/src/main.tsx"`,
        `src="/src/main.tsx?v=${nanoid()}"`,
      );

      const seo = await getPublishedCmsPageSeo(slug);
      if (seo) {
        const canonicalPath = req.path.replace(/\/$/, "") || `/${slug}`;
        const canonicalUrl = `https://www.askdetectives.com${canonicalPath}`;
        template = injectCmsPageSeoTags(template, seo, canonicalUrl);
      }

      const page = await vite.transformIndexHtml(req.originalUrl, template);
      res.setHeader("Cache-Control", "no-store");
      res.set({ "Content-Type": "text/html; charset=utf-8" }).end(page);
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      console.error("[DEV-SEO] Static CMS page SEO injection failed:", {
        url: req.originalUrl,
        message: errorMsg,
      });
      return attachViteTransform(vite, res, req, "");
    }
  });

  // ============================================================================
  // STEP 2: VITE MIDDLEWARE (NOW runs AFTER SEO route handlers)
  // ============================================================================
  // Handles CSS, JS, HMR, and Vite dev server requests
  // Only processes requests that weren't handled by SEO routes above
  // ============================================================================

  // Debug: Log all requests before Vite middleware
  app.use((req, _res, next) => {
    console.log("[SEO DEBUG] Before Vite middleware:", req.originalUrl);
    next();
  });

  app.use(vite.middlewares);

  // HOMEPAGE FLOW (DEV)
  // Serves the index.html with Vite development transforms
  app.get("/", async (req: Request, res: Response) => {
    try {
      const clientTemplate = path.resolve(
        import.meta.dirname,
        "..",
        "client",
        "index.html",
      );

      let template = await fs.promises.readFile(clientTemplate, "utf-8");

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
      template = injectCmsPageSeoTags(template, seo, "https://www.askdetectives.com/", { logoUrl });
      
      template = template.replace(
        `src="/src/main.tsx"`,
        `src="/src/main.tsx?v=${nanoid()}"`,
      );

      const page = await vite.transformIndexHtml(req.originalUrl, template);
      
      res.setHeader("Cache-Control", "no-store");
      res.set({ "Content-Type": "text/html" }).end(page);
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      console.error("[Homepage] Error:", {
        message: errorMsg,
        stack: error instanceof Error ? error.stack : undefined,
      });
      // Fallback to plain template on error
      try {
        const clientTemplate = path.resolve(
          import.meta.dirname,
          "..",
          "client",
          "index.html",
        );
        let template = await fs.promises.readFile(clientTemplate, "utf-8");
        template = template.replace(
          `src="/src/main.tsx"`,
          `src="/src/main.tsx?v=${nanoid()}"`,
        );
        const page = await vite.transformIndexHtml(req.originalUrl, template);
        res.setHeader("Cache-Control", "no-store");
        res.set({ "Content-Type": "text/html" }).end(page);
      } catch (fallbackError) {
        console.error("[Homepage] Fallback failed:", fallbackError);
        res.status(500).set({ "Content-Type": "text/html" }).send(
          "<html><head><title>Error</title></head><body><h1>Error loading page</h1></body></html>"
        );
      }
    }
  });

  // ============================================================================
  // STEP 3: SPA FALLBACK & API PASS-THROUGH
  // ============================================================================
  // Handles remaining routes - SPA navigation and API pass-through
  // ============================================================================
  app.use("*", async (req, res, next) => {
    const url = req.originalUrl;
    const requestPath = req.path;

    // Let API routes through - they're already registered via registerRoutes()
    // Only handle SPA routes here
    if (requestPath.startsWith("/api/")) {
      return next();
    }

    try {
      if (isStaticAssetPath(requestPath)) {
        return res.status(404).end();
      }

      const clientTemplate = path.resolve(
        import.meta.dirname,
        "..",
        "client",
        "index.html",
      );

      // always reload the index.html file from disk incase it changes
      let template = await fs.promises.readFile(clientTemplate, "utf-8");
      template = template.replace(
        `src="/src/main.tsx"`,
        `src="/src/main.tsx?v=${nanoid()}"`,
      );
      const page = await vite.transformIndexHtml(url, template);

      if (isKnownSpaPath(requestPath)) {
        return res.status(200).set({ "Content-Type": "text/html" }).end(page);
      }

      return serveDev404Page(res, "Page Not Found", "404 - Route not found");
    } catch (e) {
      vite.ssrFixStacktrace(e as Error);
      next(e);
    }
  });
}

/**
 * Helper to attach Vite transform to response
 */
async function attachViteTransform(
  vite: any,
  res: Response,
  req: Request,
  _additional: string
): Promise<void> {
  try {
    const clientTemplate = path.resolve(
      import.meta.dirname,
      "..",
      "client",
      "index.html",
    );
    let template = await fs.promises.readFile(clientTemplate, "utf-8");
    template = template.replace(
      `src="/src/main.tsx"`,
      `src="/src/main.tsx?v=${nanoid()}"`,
    );
    const page = await vite.transformIndexHtml(req.originalUrl, template);
    res.status(200).set({ "Content-Type": "text/html" }).end(page);
  } catch (error) {
    console.error('[DEV] Error transforming template:', error);
    res.status(500).type("text/plain").send("Error loading page");
  }
}

(async () => {
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
        const envSource = process.env.NODE_ENV === 'production' ? 'Hosting Provider' : '.env.local or .env';
        console.log(`💾 Supabase: ${isLocal ? '🟢 Local' : '☁️  Cloud'} (${supabaseHost})`);
        console.log(`   Source: ${envSource}`);
        if (!isLocal && process.env.NODE_ENV === 'development') {
          console.warn(`   ⚠️  WARNING: Development mode using CLOUD Supabase!`);
          console.warn(`   This should only happen if you explicitly set SUPABASE_URL to a cloud instance.`);
        }
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : String(err);
        console.warn(`⚠️  Supabase URL parsing failed: ${errMsg} (${supabaseUrl})`);
        console.log(`⚠️  Supabase: Not configured (storage disabled)`);
      }
    } else {
      console.log(`⚠️  Supabase: Not configured (storage disabled)`);
    }

    await loadSecretsFromDatabase();
    const { secretsLoadedSuccessfully } = await import("./lib/secretsLoader.js");
    validateConfig(secretsLoadedSuccessfully);
    await validateDatabase();
    await runApp(setupVite);
    console.log(`✅ Server fully started and listening on port ${config.server.port}`);
    
    // Keep the process alive - prevent premature exit
    process.stdin.resume();
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
})().catch((err) => {
  console.error('Fatal async error:', err);
  process.exit(1);
});

// Handle unhandled errors gracefully
process.on('unhandledRejection', (reason) => {
  console.error('Unhandled rejection:', reason);
  // Don't exit for unhandled rejections
});

process.on('uncaughtException', (error) => {
  console.error('Uncaught exception:', error);
  // Don't exit - try to keep server running
});

// Prevent premature exit
setInterval(() => {}, 1000);
