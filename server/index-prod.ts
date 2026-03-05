import "./lib/loadEnv";
import * as Sentry from "@sentry/node";
import { nodeProfilingIntegration } from "@sentry/profiling-node";
import fs from "node:fs";
import { type Server } from "node:http";
import path from "node:path";

import express from "express";
import type { Express, Request, Response } from "express";
import { renderLocationApp } from "../client/src/ssr-entry.js";

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
} from "./lib/seo-injection.js";
import { storage } from "./storage.js";

// Sentry is optional. To enable, set sentry_dsn in app_secrets and restart.

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

  // ✅ GLOBAL REQUEST LOGGER - Runs before all routes and middleware
  // Logs every incoming request to track execution flow
  app.use((req: Request, res: Response, next: Function) => {
    console.log("[REQUEST]", req.method, req.originalUrl, new Date().toISOString());
    next();
  });

  // Cache middleware for location listing pages
  app.use((req: Request, res: Response, next: Function) => {
    // Apply cache headers only to GET requests for location listing pages
    if (req.method === 'GET' && /^\/detectives\/[^\/]+(?:\/[^\/]+)?(?:\/[^\/]+)?\/?$/.test(req.path)) {
      res.setHeader('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=600');
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

      // ✅ OPTIMIZATION: Run independent database calls in parallel
      // Detectives fetch + services existence check (city pages only) run concurrently
      console.log("[SSR] Fetching detectives...", { country: params.country, state: params.state, city: params.city });
      const [locationSeoData, servicesCheckResult] = await Promise.all([
        // Always fetch detectives for location
        getLocationDetectivesForSEO(
          params.country,
          params.state,
          params.city
        ),
        // Only check services for city-level pages; no-op for state/country pages
        isCity ? storage.searchServices(
          {
            category: "Background Check",
            country: params.country,
            state: params.state,
            city: params.city,
          },
          1,  // limit = 1 (existence check only)
          0,  // offset = 0
          'recent',
          false,
          resolvedLocation  // ✅ Pass pre-resolved location IDs to skip redundant queries
        ) : Promise.resolve([])
      ]);

      console.log("[SSR] Detectives fetched", { count: locationSeoData.detectives.length });
      if (isCity) {
        console.log("[SSR] Checking services...", { hasServices: servicesCheckResult && servicesCheckResult.length > 0 });
      }

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

      if (!detectives || detectives.length === 0) {
        // No detectives found - return 404
        console.log('[SEO] No detectives found for location:', params);
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        return res.status(404).send(
          '<html><head><title>Location Not Found</title></head><body><h1>404 - No detectives in this location</h1></body></html>'
        );
      }

      console.log(`[SEO] Found ${detectives.length} detectives for location (hasMore: ${hasMore})`);

      // Generate canonical URL
      const canonicalUrl = `https://www.askdetectives.com${requestPath.replace(/\/$/, '')}/`;

      console.log(`[PROD-SEO] Before injectLocationSeoTags - template length: ${cachedIndexHtml.length}, has SSR_H1_INJECTION_POINT: ${cachedIndexHtml.includes('<!-- SSR_H1_INJECTION_POINT -->')}`);

      // Inject SEO tags (totalCount defaults to detectives.length in function)
      // ✅ Pass resolved location to avoid duplicate queries in generateLocationSeoMetaTags()
      console.log("[SSR] Generating SEO...", { detectiveCount: seoDetectives.length, hasMore });
      const seoHtml = await injectLocationSeoTags(cachedIndexHtml, params, seoDetectives, canonicalUrl, resolvedLocation);

      console.log(`[PROD-SEO] After injectLocationSeoTags - template length: ${seoHtml.length}, has SSR_H1_INJECTION_POINT: ${seoHtml.includes('<!-- SSR_H1_INJECTION_POINT -->')}`);

      // ✅ Inject detective → service authority link for city-level pages only (if services exist)
      let finalHtml = seoHtml;
      if (isCity && servicesCheckResult && servicesCheckResult.length > 0) {
        try {
          const countrySlug = segments[1];
          const stateSlug = segments[2];
          const citySlug = segments[3];

          finalHtml = injectDetectiveLocationAuthorityLink(seoHtml, {
            countrySlug,
            stateSlug,
            citySlug,
            cityName: params.city ?? "",
            stateName: params.state ?? "",
          }, true);
          console.log(`[SEO] Injected background check services link for ${params.city}, ${params.state}`);
        } catch (err) {
          console.error("[SEO] Error injecting authority link:", err);
          // Continue without authority link if error occurs
        }
      }

      // ✅ OPTIMIZATION: Stream SSR with renderToPipeableStream
      // Sends HTML to the browser as soon as the React shell is ready,
      // dramatically reducing Time to First Byte (TTFB).
      // Non-critical content (Suspense-deferred data) streams afterward.
      try {
        console.log('[SSR DEBUG] Before renderLocationApp streaming:', req.originalUrl || requestPath);
        console.log('[SSR DEBUG] Root placeholder present:', finalHtml.includes('<div id="root"></div>'));
        
        // Set response headers early for streaming
        res.setHeader("Cache-Control", "public, max-age=3600, stale-while-revalidate=86400");
        res.setHeader("Content-Type", "text/html; charset=utf-8");
        
        // Stream React component rendering directly to response
        // renderLocationApp handles onShellReady callback, streaming, and cleanup
        console.log("[SSR] Starting React render...", { url: req.originalUrl || requestPath });
        await renderLocationApp(req.originalUrl || requestPath, finalHtml, res);
        
        console.log("[SSR] SSR render completed", { url: req.originalUrl || requestPath });
      } catch (ssrError) {
        console.error('[SSR] Failed to stream location route:', ssrError);
        // Fallback: if streaming failed and headers haven't been sent, try to send the template
        if (!res.headersSent) {
          res.setHeader("Cache-Control", "public, max-age=3600, stale-while-revalidate=86400");
          res.setHeader("Content-Type", "text/html; charset=utf-8");
          return res.send(finalHtml);
        }
        // If headers already sent, just end the response
        res.end();
      }

      // Note: Response is already handled by renderLocationApp streaming
      // No need to call res.send() again
      return;

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
  app.get(/^\/detectives\/[^\/]+\/[^\/]+\/[^\/]+\/[^\/]+\/?$/, async (req: Request, res: Response) => {
    try {
      const requestPath = req.path;
      const params = extractDetectiveRouteParams(requestPath);

      if (!params) {
        // Fallback to normal SPA if params don't match
        return serveIndexHtmlWithSeo(res, indexHtmlPath, null, cachedIndexHtml);
      }

      // Fetch detective data for SEO
      const detective = await getDetectiveBySlugForSEO(
        params.country,
        params.state,
        params.city,
        params.slug
      );

      if (!detective) {
        // Detective not found - serve SPA to allow client-side 404 handling
        console.log('[SEO] Detective not found, serving SPA fallback:', params);
        if (!cachedIndexHtml) {
          cachedIndexHtml = await fs.promises.readFile(indexHtmlPath, 'utf-8');
        }
        res.setHeader("Cache-Control", "public, max-age=3600, stale-while-revalidate=86400");
        res.setHeader("Content-Type", "text/html; charset=utf-8");
        return res.send(cachedIndexHtml);
      }

      console.log('[SEO] Detective found:', { businessName: detective.businessName, avgRating: detective.avgRating, reviewCount: detective.reviewCount });

      // Generate canonical URL
      const canonicalUrl = `https://www.askdetectives.com${requestPath.replace(/\/$/, '')}/`;

      // Load and inject SEO tags
      if (!cachedIndexHtml) {
        cachedIndexHtml = await fs.promises.readFile(indexHtmlPath, 'utf-8');
      }

      const seoHtml = injectSeoTags(cachedIndexHtml, detective, canonicalUrl);

      res.setHeader("Cache-Control", "public, max-age=3600, stale-while-revalidate=86400");
      res.setHeader("Content-Type", "text/html; charset=utf-8");
      return res.send(seoHtml);

    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      console.error('[SEO Injection] CRITICAL ERROR:', {
        url: req.originalUrl,
        message: errorMsg,
        stack: error instanceof Error ? error.stack : undefined,
      });
      // Return 500 error instead of silently falling back
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      return res.status(500).send(
        '<html><head><title>Server Error</title></head><body><h1>500 - Server Error</h1><p>Failed to load detective profile</p></body></html>'
      );
    }
  });

  // CATCH-ALL ROUTE FOR UNMATCHED /detectives PATHS (6+ segments or invalid patterns)
  // Prevents hard 404s for paths like /detectives/:country/:state/:city/:agency/:something
  // Serves SPA to allow client-side routing to handle navigation
  app.get(/^\/detectives\//, async (req: Request, res: Response) => {
    try {
      const requestPath = req.path;
      const segments = requestPath.replace(/\/+$/, '').split('/').filter(s => s);
      
      // Skip if already handled by earlier routes (2-5 segments)
      if (segments.length <= 5) {
        return; // Pass through to next middleware/catch-all
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

  // SERVICE DETAIL PAGE ROUTE (Production)
  // Intercepts /service/:country/:state/:city/:detectiveSlug/:serviceSlug
  app.get(/^\/service\/[^\/]+\/[^\/]+\/[^\/]+\/[^\/]+\/[^\/]+\/?$/, async (req: Request, res: Response) => {
    try {
      const requestPath = req.path;
      const segments = requestPath.replace(/\/+$/, '').split('/').filter(s => s);
      
      // Validate we have exactly 5 segments after /service
      if (segments.length !== 6 || segments[0] !== 'service') {
        return; // Fall through to static file serving
      }

      const [, country, state, city, detectiveSlug, serviceSlug] = segments;
      
      console.log("[Service Detail] Request matched:", {
        country,
        state,
        city,
        detectiveSlug,
        serviceSlug,
      });

      // Optionally, you could fetch service + detective data for SEO injection here
      // For now, serve with generic HTML that allows client-side routing to take over
      if (!cachedIndexHtml) {
        cachedIndexHtml = await fs.promises.readFile(indexHtmlPath, 'utf-8');
      }

      const canonicalUrl = `https://www.askdetectives.com${requestPath.replace(/\/$/, '')}/`;
      
      // Inject breadcrumb and basic service page meta tags
      let seoHtml = cachedIndexHtml;
      seoHtml = seoHtml.replace(
        '</head>',
        `<link rel="canonical" href="${canonicalUrl}" />
       <script type="application/ld+json">
       {
         "@context": "https://schema.org",
         "@type": "BreadcrumbList",
         "itemListElement": [
           {
             "@type": "ListItem",
             "position": 1,
             "name": "Home",
             "item": "https://www.askdetectives.com"
           },
           {
             "@type": "ListItem",
             "position": 2,
             "name": "Service",
             "item": "${canonicalUrl}"
           }
         ]
       }
       </script></head>`
      );

      console.log(`[Service Detail] Serving service page: ${detectiveSlug}/${serviceSlug}`);

      res.setHeader("Cache-Control", "public, max-age=3600, stale-while-revalidate=86400");
      res.setHeader("Content-Type", "text/html; charset=utf-8");
      return res.send(seoHtml);

    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      console.error('[Service Detail] Error:', {
        url: req.originalUrl,
        message: errorMsg,
      });
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      return res.status(500).send(
        '<html><head><title>Server Error</title></head><body><h1>500 - Server Error</h1></body></html>'
      );
    }
  });

  // SERVICE + LOCATION SEO INJECTION (Production)
  // Intercepts /services/background-checks/:country/:state/:city
  app.get(/^\/services\/background-checks\/[^\/]+\/[^\/]+\/[^\/]+\/?$/, async (req: Request, res: Response) => {
    try {
      const requestPath = req.path;
      
      const {
        extractServiceLocationRouteParams,
        resolveServiceLocation,
        injectServiceLocationSeoTags,
      } = await import("./lib/seo-injection.js");

      const params = extractServiceLocationRouteParams(requestPath);
      if (!params) {
        console.warn("[Service SEO] Route params extraction failed for:", requestPath);
        return; // Fall through to static file serving
      }

      console.log("[Service SEO] Extracted params:", params);

      // Resolve location slugs to actual country/state/city
      const location = await resolveServiceLocation(params.countrySlug, params.stateSlug, params.citySlug);
      if (!location) {
        console.log("[Service SEO] Location resolution failed");
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        return res.status(404).send(
          '<html><head><title>Location Not Found</title></head><body><h1>404 - Location not found</h1></body></html>'
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
        console.log("[Service SEO] No services found for location");
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        return res.status(404).send(
          '<html><head><title>No Services Found</title></head><body><h1>404 - No background check services in this location</h1></body></html>'
        );
      }

      console.log(`[Service SEO] Found ${serviceResults.length} services`);

      // Generate canonical URL
      const canonicalUrl = `https://www.askdetectives.com${requestPath.replace(/\/$/, '')}/`;

      // Load and inject SEO tags
      if (!cachedIndexHtml) {
        cachedIndexHtml = await fs.promises.readFile(indexHtmlPath, 'utf-8');
      }

      const seoHtml = injectServiceLocationSeoTags(cachedIndexHtml, {
        countrySlug: params.countrySlug,
        stateSlug: params.stateSlug,
        citySlug: params.citySlug,
        countryName: location.countryName,
        stateName: location.stateName,
        cityName: location.cityName,
      }, serviceResults, canonicalUrl);

      console.log(`[Service SEO SSR] Injected background-checks for ${location.cityName}`);

      res.setHeader("Cache-Control", "public, max-age=3600, stale-while-revalidate=86400");
      res.setHeader("Content-Type", "text/html; charset=utf-8");
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

  // Homepage route - serves client index.html
  app.get("/", async (_req: Request, res: Response) => {
    try {
      // Read index.html once and cache it
      if (!cachedIndexHtml) {
        cachedIndexHtml = await fs.promises.readFile(indexHtmlPath, "utf-8");
      }

      res.setHeader("Cache-Control", "no-store");
      res.setHeader("Content-Type", "text/html; charset=utf-8");
      res.send(cachedIndexHtml);
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
  console.log('[DEBUG] Setting up express.static middleware for:', distPath);
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

process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully...');
  process.exit(0);
});

process.on('SIGINT', () => {
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
    console.log('[DEBUG] About to call runApp(serveStatic)...');
    await runApp(serveStatic);
    console.log('[DEBUG] runApp completed successfully');
    
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