/**
 * Vercel Handler - Reusable initialization logic
 * 
 * Handles all one-time initialization:
 * - Environment loading
 * - Database migrations
 * - Secrets loading
 * - Express app setup with all routes (lazy loaded)
 * 
 * OPTIMIZATION: Uses lazy loading & deferred imports to reduce cold start memory
 * Wrapped with serverless-http to convert to serverless format
 */

import "../server/lib/loadEnv";
import * as Sentry from "@sentry/node";
import { nodeProfilingIntegration } from "@sentry/profiling-node";
import { type Server } from "node:http";

import { loadSecretsFromDatabase } from "../server/lib/secretsLoader";
import { config, validateConfig } from "../server/config";
import { validateDatabase } from "../server/startup";
import { initializeEnv } from "../server/lib/loadEnv";
import { getEnvironmentBadge } from "../db/validateDatabase";
import { ensureLocationSeoTable } from "../server/lib/init-location-seo-table";
import serverless from "serverless-http";

// Track initialization state
let initPromise: Promise<any> | null = null;
let cachedHandler: any = null;
let appInstance: any = null;

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
    console.log(`\n${getEnvironmentBadge()} Environment (Vercel Serverless - Optimized)`);
    
    // Load environment variables
    await initializeEnv();

    if (process.env.NODE_ENV !== "production") {
      process.env.NODE_ENV = "production";
    }

    console.log('🔐 Loading auth/secrets from database...');
    await loadSecretsFromDatabase();
    
    const { secretsLoadedSuccessfully } = await import("../server/lib/secretsLoader");
    
    // OPTIMIZATION: Defer database migrations to reduce startup time
    console.log('📊 Scheduling database migrations...');
    const migrateInBackground = async () => {
      try {
        const { runMigrations } = await import('../db/run-migrations');
        await runMigrations();
      } catch (migrationError) {
        console.error('❌ Migration error (background):', migrationError);
      }
    };
    
    // Initialize Sentry for error tracking
    if (config.env.isProd && config.sentryDsn) {
      console.log('📍 Initializing Sentry...');
      Sentry.init({
        dsn: config.sentryDsn,
        environment: "production",
        integrations: [nodeProfilingIntegration()],
        tracesSampleRate: 0.1,
        profilesSampleRate: 0.05, // Reduced from 0.1 to save memory
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

    // OPTIMIZATION: Lazy load Express app and routes
    // Import app.ts which sets up middleware but NOT routes yet
    const { app } = await import("../server/app");
    appInstance = app;
    
    console.log('⚙️  Registering routes (this may take a moment)...');
    const { registerRoutes } = await import("../server/routes");
    const httpServer = await registerRoutes(app);
    
    // Wrap the Express app with serverless-http for Vercel
    console.log('🚀 Wrapping with serverless-http...');
    cachedHandler = serverless(app);
    
    console.log('✅ Vercel serverless function initialized and ready');
    
    // Run migrations in background (don't block cold start)
    if (config.env.isProd) {
      migrateInBackground().catch(err => {
        console.error('Background migration error:', err);
        if (config.sentryDsn) {
          Sentry.captureException(err);
        }
      });
    }
    
    return cachedHandler;
    
  } catch (error) {
    console.error('❌ Failed to initialize Vercel handler:', error);
    if (config.env.isProd && config.sentryDsn) {
      Sentry.captureException(error);
    }
    throw error;
  }
}
