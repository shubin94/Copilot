import "./lib/loadEnv";
import * as Sentry from "@sentry/node";
import { nodeProfilingIntegration } from "@sentry/profiling-node";
import fs from "node:fs";
import { type Server } from "node:http";
import path from "node:path";

import express from "express";
import type { Express, Request, Response } from "express";
import { renderLocationApp } from "../client/src/ssr-entry.tsx";

import runApp from "./app.ts";
import { config, validateConfig } from "./config.ts";
import { loadSecretsFromDatabase } from "./lib/secretsLoader.ts";
import { validateDatabase } from "./startup.ts";
import { initializeEnv } from "./lib/loadEnv.ts";
import { getEnvironmentBadge } from "../db/validateDatabase.ts";
import { ensureLocationSeoTable } from "./lib/init-location-seo-table.ts";
import { isKnownSpaPath, isStaticAssetPath } from "./lib/spa-route-manifest.ts";
import {
  isDetectiveProfilePath,
  extractDetectiveRouteParams,
  getDetectiveBySlugForSEO,
  injectSeoTags,
  isLocationListingPath,
  extractLocationRouteParams,
  getLocationDetectivesForSEO,
  injectLocationSeoTags,
  buildHomepageAuthorityHtml,
  injectHomepageAuthorityHtml,
  injectDetectiveLocationAuthorityLink,
} from "./lib/seo-injection.ts";
import { storage } from "./storage.ts";

// Sentry is optional. To enable, set sentry_dsn in app_secrets and restart.

export async function serveStatic(app: Express, server: Server) {
  const distPath = path.resolve(import.meta.dirname, "..", "dist", "public");

  if (!fs.existsSync(distPath)) {
    throw new Error(
      `Could not find the build directory: ${distPath}, make sure to build the client first`,
    );
  }

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

  const fallback404File = path.resolve(distPath, "404.html");
  const indexHtmlPath = path.resolve(distPath, "index.html");
  let cachedIndexHtml: string | null = null;

  // LOCATION LISTING SEO INJECTION
  // Intercepts /detectives/:country, /detectives/:country/:state, /detectives/:country/:state/:city
  // and injects SEO meta tags with detective listings
  app.get(/^\/detectives\/[^\/]+(?:\/[^\/]+)?(?:\/[^\/]+)?\/?$/, async (req: Request, res: Response) => {
    try {
      const requestPath = req.path;
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

      // Fetch detective listings for this location
      const locationSeoData = await getLocationDetectivesForSEO(
        params.country,
        params.state,
        params.city
      );
      const detectives = locationSeoData.detectives;
      const totalCount = locationSeoData.totalCount;

      if (!detectives || detectives.length === 0) {
        // No detectives found - return 404
        console.log('[SEO] No detectives found for location:', params);
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        return res.status(404).send(
          '<html><head><title>Location Not Found</title></head><body><h1>404 - No detectives in this location</h1></body></html>'
        );
      }

      console.log(`[SEO] Found ${totalCount} total detectives for location (${detectives.length} rendered)`);

      // Generate canonical URL
      const canonicalUrl = `https://www.askdetectives.com${requestPath.replace(/\/$/, '')}/`;

      // Load and inject SEO tags
      if (!cachedIndexHtml) {
        cachedIndexHtml = await fs.promises.readFile(indexHtmlPath, 'utf-8');
      }

      console.log(`[PROD-SEO] Before injectLocationSeoTags - template length: ${cachedIndexHtml.length}, has SSR_H1_INJECTION_POINT: ${cachedIndexHtml.includes('<!-- SSR_H1_INJECTION_POINT -->')}`);

      const seoHtml = await injectLocationSeoTags(cachedIndexHtml, params, detectives, canonicalUrl, totalCount);

      console.log(`[PROD-SEO] After injectLocationSeoTags - template length: ${seoHtml.length}, has SSR_H1_INJECTION_POINT: ${seoHtml.includes('<!-- SSR_H1_INJECTION_POINT -->')}`);

      // CHECK IF CITY LEVEL: Inject detective → service authority link for city-level pages only
      let finalHtml = seoHtml;
      const pathSegments = requestPath.replace(/\/+$/, '').split('/').filter(s => s);
      if (pathSegments.length === 4) { // /detectives/:country/:state/:city
        try {
          const countrySlug = pathSegments[1];
          const stateSlug = pathSegments[2];
          const citySlug = pathSegments[3];

          // Lightweight check for background check services (limit = 1, just existence check)
          const servicesCheckResult = await storage.searchServices({
            category: "Background Check",
            country: params.country,
            state: params.state,
            city: params.city,
          }, limit = 1, offset = 0);

          const servicesExist = servicesCheckResult && servicesCheckResult.length > 0;
          
          if (servicesExist) {
            finalHtml = injectDetectiveLocationAuthorityLink(seoHtml, {
              countrySlug,
              stateSlug,
              citySlug,
              cityName: params.city,
              stateName: params.state,
            }, true);
            console.log(`[SEO] Injected background check services link for ${params.city}, ${params.state}`);
          }
        } catch (err) {
          console.error("[SEO] Error injecting authority link:", err);
          // Continue without authority link if error occurs
        }
      }

      // SSR render location listing route with request URL context
      try {
        console.log('[SSR DEBUG] Before renderLocationApp:', req.originalUrl || requestPath);
        console.log('[SSR DEBUG] Root placeholder present before replace:', finalHtml.includes('<div id="root"></div>'));
        const renderedHtml = renderLocationApp(req.originalUrl || requestPath);
        console.log('[SSR DEBUG] After renderLocationApp');
        console.log('[SSR DEBUG] renderedHtml length > 0:', renderedHtml.length > 0, 'length:', renderedHtml.length);
        finalHtml = finalHtml.replace('<div id="root"></div>', `<div id="root">${renderedHtml}</div>`);
      } catch (ssrError) {
        console.error('[SSR] Failed to render location route, falling back to SEO-only HTML:', ssrError);
      }

      res.setHeader("Cache-Control", "public, max-age=3600, stale-while-revalidate=86400");
      res.setHeader("Content-Type", "text/html; charset=utf-8");
      return res.send(finalHtml);

    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      console.error('[SEO Location Injection] CRITICAL ERROR:', {
        url: req.originalUrl,
        message: errorMsg,
        stack: error instanceof Error ? error.stack : undefined,
      });
      // Return 500 error instead of silently falling back
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      return res.status(500).send(
        '<html><head><title>Server Error</title></head><body><h1>500 - Server Error</h1><p>Failed to load location detectives</p></body></html>'
      );
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
        // Detective not found - return 404
        console.log('[SEO] Detective not found:', params);
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        return res.status(404).send(
          '<html><head><title>Detective Not Found</title></head><body><h1>404 - Detective not found</h1></body></html>'
        );
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

  // SERVICE + LOCATION SEO INJECTION (Production)
  // Intercepts /services/background-checks/:country/:state/:city
  app.get(/^\/services\/background-checks\/[^\/]+\/[^\/]+\/[^\/]+\/?$/, async (req: Request, res: Response) => {
    try {
      const requestPath = req.path;
      
      const {
        extractServiceLocationRouteParams,
        resolveServiceLocation,
        injectServiceLocationSeoTags,
      } = await import("./lib/seo-injection.ts");

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
      const serviceResults = await storage.searchServices({
        category: "Background Check",
        country: location.countryCode,
        state: location.stateName,
        city: location.cityName,
      }, limit = 50, offset = 0, sortBy = 'popular');

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

  // Homepage route - serves client index.html with authority injection
  app.get("/", async (req: Request, res: Response) => {
    try {
      console.log("[Homepage Injection] Running for /");
      
      // Read index.html once and cache it
      if (!cachedIndexHtml) {
        cachedIndexHtml = await fs.promises.readFile(indexHtmlPath, "utf-8");
      }

      let html = cachedIndexHtml;
      console.log("[Homepage Injection] Template loaded, size:", html.length, "bytes");
      console.log("[Homepage Injection] Marker exists:", html.includes("<!-- HOMEPAGE_AUTHORITY_INJECTION_POINT -->"));

      // Fetch top countries for homepage authority injection
      const countries = await storage.getTopCountries(8);
      console.log("[Homepage Injection] Top countries fetched:", countries.length);
      
      if (countries && countries.length > 0) {
        // Build map of states by country
        const statesByCountry: Record<string, Array<{ state: string; detectiveCount: number }>> = {};
        const citiesByCountryState: Record<string, Array<{ city: string; detectiveCount: number }>> = {};

        // Fetch states for each country
        for (const country of countries) {
          const states = await storage.getTopStates(country.country, 5);
          if (states && states.length > 0) {
            statesByCountry[country.country] = states;

            // Fetch cities for each state
            for (const state of states) {
              const cities = await storage.getTopCities(country.country, state.state, 5);
              if (cities && cities.length > 0) {
                citiesByCountryState[`${country.country}|${state.state}`] = cities;
              }
            }
          }
        }

        // Build and inject authority HTML block (TRUE SSR)
        const authorityBlockHtml = buildHomepageAuthorityHtml(
          countries,
          statesByCountry,
          citiesByCountryState
        );
        console.log("[Homepage Injection] Authority HTML built, size:", authorityBlockHtml.length, "bytes");
        
        // Inject directly into HTML body before <div id="root"> (TRUE SSR - no React dependency)
        html = html.replace(
          `<div id="root">`,
          `${authorityBlockHtml}
    <div id="root">`
        );
        
        console.log("[Homepage Injection] Authority HTML injected into body (SSR)");
      }

      res.setHeader("Cache-Control", "no-store");
      res.setHeader("Content-Type", "text/html; charset=utf-8");
      res.send(html);
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      console.error("[Homepage] Error:", {
        message: errorMsg,
        stack: error instanceof Error ? error.stack : undefined,
      });
      // Fallback to plain index.html on error
      try {
        if (!cachedIndexHtml) {
          cachedIndexHtml = await fs.promises.readFile(indexHtmlPath, "utf-8");
        }
        res.setHeader("Cache-Control", "no-store");
        res.setHeader("Content-Type", "text/html; charset=utf-8");
        res.send(cachedIndexHtml);
      } catch (fallbackError) {
        console.error("[Homepage] Fallback failed:", fallbackError);
        res.status(500).type("text/plain").send("Error loading page");
      }
    }
  });

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
    
    const { secretsLoadedSuccessfully } = await import("./lib/secretsLoader.ts");
    
    // Run database migrations
    console.log('📊 Running database migrations...');
    try {
      const { runMigrations } = await import('../db/run-migrations.ts');
      await runMigrations();
    } catch (migrationError) {
      console.error('❌ Migration error:', migrationError);
      console.error('Exiting due to migration failure in production...');
      process.exit(1);
    }
    
    if (config.env.isProd && config.sentryDsn) {
      Sentry.init({
        dsn: config.sentryDsn,
        environment: process.env.NODE_ENV || "production",
        integrations: [nodeProfilingIntegration()],
        tracesSampleRate: 0.1, // 10% of requests for performance monitoring
        profilesSampleRate: 0.1, // 10% profiling
        beforeSend(event, hint) {
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
              const sensitiveKeys = ['password', 'temporaryPassword', 'token', 'apiKey', 'creditCard', 'ssn', 'passport', 'csrfToken', 'session_secret'];
              for (const key of sensitiveKeys) {
                if (key in event.request.data) {
                  event.request.data[key] = '[REDACTED]';
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
    await ensureLocationSeoTable();

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