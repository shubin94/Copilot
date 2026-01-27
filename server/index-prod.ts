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
import { validateDatabase } from "./startup.ts";

// Initialize Sentry error tracking (kill-switch: set SENTRY_DSN="" to disable)
if (process.env.SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
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
          const sensitiveKeys = ['password', 'temporaryPassword', 'token', 'apiKey', 'creditCard', 'ssn', 'passport'];
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
  if (process.env.SENTRY_DSN) {
    Sentry.captureException(error);
  }
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
  if (process.env.SENTRY_DSN) {
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
    
    if (config.env.isProd) {
      console.log('📋 Validating production config...');
      validateConfig();
    }
    
    console.log('🔍 Validating database connection...');
    await validateDatabase();
    
    console.log('⚙️  Starting Express app...');
    await runApp(serveStatic);
    
    console.log('✅ Server started successfully');
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    if (process.env.SENTRY_DSN) {
      Sentry.captureException(error);
    }
    process.exit(1);
  }
}

// Start the server
main();
