import "dotenv/config";
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

// Sentry is optional. To enable, set sentry_dsn in app_secrets and restart.

export async function serveStatic(app: Express, server: Server) {
  const distPath = path.resolve(import.meta.dirname, "..", "dist", "public");

  if (!fs.existsSync(distPath)) {
    throw new Error(
      `Could not find the build directory: ${distPath}, make sure to build the client first`,
    );
  }

  app.use(express.static(distPath, {
    maxAge: "1y",
    immutable: true,
    setHeaders: (res, filePath) => {
      if (filePath.endsWith("index.html")) {
        res.setHeader("Cache-Control", "no-store");
      }
    }
  }));

  // fall through to index.html if the file doesn't exist
  app.use("*", (_req, res) => {
    res.setHeader("Cache-Control", "no-store");
    res.sendFile(path.resolve(distPath, "index.html"));
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
    console.log('🚀 Starting server initialization...');

    if (process.env.NODE_ENV !== "production") {
      throw new Error("NODE_ENV must be production for production boot. Set NODE_ENV=production.");
    }

    console.log('🔐 Loading auth/secrets from database...');
    await loadSecretsFromDatabase();  const { secretsLoadedSuccessfully } = await import("./lib/secretsLoader.ts");
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
