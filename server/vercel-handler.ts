/**
 * Vercel Handler - Reusable initialization logic
 * 
 * Handles all one-time initialization:
 * - Environment loading
 * - Database migrations
 * - Secrets loading
 * - Express app setup with all routes
 * 
 * Wrapped with serverless-http to convert to serverless format
 */

import "./lib/loadEnv";
import * as Sentry from "@sentry/node";
import { nodeProfilingIntegration } from "@sentry/profiling-node";
import { type Server } from "node:http";

import { loadSecretsFromDatabase } from "./lib/secretsLoader";
import { config, validateConfig } from "./config";
import { validateDatabase } from "./startup";
import { initializeEnv } from "./lib/loadEnv";
import { getEnvironmentBadge } from "../db/validateDatabase";
import { ensureLocationSeoTable } from "./lib/init-location-seo-table";
import { app } from "./app";
import runApp from "./app";
import serverless from "serverless-http";

// Track initialization state
let initPromise: Promise<any> | null = null;
let cachedHandler: any = null;

export async function produceServerHandler() {
  // Return cached handler if already initialized
  if (cachedHandler) {
    return cachedHandler;
  }

  // Return existing promise if initialization is in progress
  if (initPromise) {
    await initPromise;
    return cachedHandler;
  }

  // Start initialization
  initPromise = initializeServerApp();
  await initPromise;
  
  if (!cachedHandler) {
    throw new Error('Failed to initialize server handler');
  }
  
  return cachedHandler;
}

async function initializeServerApp() {
  try {
    console.log(`\n${getEnvironmentBadge()} Environment (Vercel Serverless)`);
    
    // Load environment variables
    await initializeEnv();

    if (process.env.NODE_ENV !== "production") {
      process.env.NODE_ENV = "production";
    }

    console.log('🔐 Loading auth/secrets from database...');
    await loadSecretsFromDatabase();
    
    const { secretsLoadedSuccessfully } = await import("./lib/secretsLoader");
    
    // Run database migrations
    console.log('📊 Running database migrations...');
    try {
      const { runMigrations } = await import('../db/run-migrations');
      await runMigrations();
    } catch (migrationError) {
      console.error('❌ Migration error:', migrationError);
      // Continue - don't fail in serverless
    }
    
    // Initialize Sentry for error tracking
    if (config.env.isProd && config.sentryDsn) {
      Sentry.init({
        dsn: config.sentryDsn,
        environment: "production",
        integrations: [nodeProfilingIntegration()],
        tracesSampleRate: 0.1,
        profilesSampleRate: 0.1,
        beforeSend(event, hint) {
          if (event.request) {
            if (event.request.headers) {
              delete event.request.headers['authorization'];
              delete event.request.headers['cookie'];
              delete event.request.headers['x-api-key'];
            }
            if (event.request.data && typeof event.request.data === 'object') {
              const sensitiveKeys = ['password', 'temporaryPassword', 'token', 'apiKey', 'creditCard', 'ssn', 'passport', 'csrfToken', 'session_secret'];
              const data = event.request.data as Record<string, any>;
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

    // Validate production config
    if (config.env.isProd) {
      console.log('📋 Validating production config...');
      validateConfig(secretsLoadedSuccessfully);
    }

    console.log('🔍 Validating database connection...');
    await validateDatabase();
    await ensureLocationSeoTable();

    // Setup Express app with all middleware and routes
    console.log('⚙️  Setting up Express app...');
    await runApp(serveStaticForVercel);
    
    // Wrap the Express app with serverless-http for Vercel
    cachedHandler = serverless(app);
    
    console.log('✅ Vercel serverless function initialized and ready');
    return cachedHandler;
    
  } catch (error) {
    console.error('❌ Failed to initialize Vercel handler:', error);
    if (config.env.isProd && config.sentryDsn) {
      Sentry.captureException(error);
    }
    throw error;
  }
}

/**
 * Modified serveStatic for Vercel - same as index-prod but tailored for serverless
 * All routes are set up but no HTTP server is started (serverless-http handles that)
 */
async function serveStaticForVercel(app: any, server: Server) {
  // Import the setup function from index-prod
  const { serveStatic } = await import("./index-prod");
  
  // Call the original serveStatic (doesn't start a server, just sets up routes)
  await serveStatic(app, server);
}
