import "./lib/loadEnv";
import * as Sentry from "@sentry/node";
import { nodeProfilingIntegration } from "@sentry/profiling-node";
import fs from "node:fs";
import { type Server } from "node:http";
import path from "node:path";

import express from "express";
import type { Express, Request } from "express";

import runApp from "./app.ts";
import { config, validateConfig } from "./config.ts";
import { loadSecretsFromDatabase } from "./lib/secretsLoader.ts";
import { validateDatabase } from "./startup.ts";
import { initializeEnv } from "./lib/loadEnv.ts";
import { getEnvironmentBadge } from "../db/validateDatabase.ts";
import { isKnownSpaPath, isStaticAssetPath } from "./lib/spa-route-manifest.ts";

// Sentry is optional. To enable, set sentry_dsn in app_secrets and restart.

export async function serveStatic(app: Express, server: Server) {
  const distPath = path.resolve(import.meta.dirname, "..", "dist", "public");

  if (!fs.existsSync(distPath)) {
    throw new Error(
      `Could not find the build directory: ${distPath}, make sure to build the client first`,
    );
  }

  console.log('[DEBUG] Setting up express.static middleware for:', distPath);
    maxAge: "1y",
    immutable: true,
    setHeaders: (res, filePath) => {
      if (filePath.endsWith("index.html")) {
        res.setHeader("Cache-Control", "no-store");
      }
    }
  }));

  const fallback404File = path.resolve(distPath, "404.html");

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
