/**
 * Vercel Handler - Reusable initialization logic
 * Optimized for cold start performance (prevents 504 timeouts)
 */

import "./lib/loadEnv.js";
import * as Sentry from "@sentry/node";
import { nodeProfilingIntegration } from "@sentry/profiling-node";

import { config, validateConfig } from "./config.js";
import { validateDatabase } from "./startup.js";
import { initializeEnv } from "./lib/loadEnv.js";
import { getEnvironmentBadge } from "../db/validateDatabase.js";
import serverless from "serverless-http";

// --------------------------------------------------
// Timeout Utility (TOP LEVEL - accessible everywhere)
// --------------------------------------------------

const withTimeout = async <T>(
  promise: Promise<T>,
  ms: number,
  label: string
): Promise<T> => {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(`${label} timeout after ${ms}ms`)), ms)
    ),
  ]);
};

// --------------------------------------------------
// Initialization State
// --------------------------------------------------

let initPromise: Promise<any> | null = null;
let cachedHandler: any = null;

// --------------------------------------------------
// Public Entry Point
// --------------------------------------------------

export async function produceServerHandler() {
  if (cachedHandler) {
    return cachedHandler;
  }

  if (initPromise) {
    await initPromise;
    return cachedHandler;
  }

  initPromise = initializeServerApp();
  await initPromise;

  if (!cachedHandler) {
    throw new Error("Failed to initialize server handler");
  }

  return cachedHandler;
}

// --------------------------------------------------
// Core Initialization
// --------------------------------------------------

async function initializeServerApp() {
  try {
    console.log(
      `\n${getEnvironmentBadge()} Environment (Vercel Serverless Optimized)`
    );

    // 1️⃣ Load environment
    await initializeEnv();

    if (process.env.NODE_ENV !== "production") {
      process.env.NODE_ENV = "production";
    }

    // 2️⃣ Load secrets (required for session middleware and validation)
    // SESSION_SECRET needed immediately for session middleware on all requests
    // Other secrets (payment, email) remain in DB and are loaded on first use
    console.log("🔐 Loading critical secrets...");
    await withTimeout(
      (async () => {
        const { loadSecretsFromDatabase } = await import("./lib/secretsLoader.js");
        await loadSecretsFromDatabase();
      })(),
      8000,
      "Secrets loading"
    );

    const { secretsLoadedSuccessfully } = await import(
      "./lib/secretsLoader.js"
    );

    // 3️⃣ Initialize Sentry
    if (config.env.isProd && config.sentryDsn) {
      console.log("📍 Initializing Sentry...");
      Sentry.init({
        dsn: config.sentryDsn,
        environment: "production",
        integrations: [nodeProfilingIntegration()],
        tracesSampleRate: 0.1,
        profilesSampleRate: 0.05,
      });
    }

    // 4️⃣ Validate config (fast check only)
    if (config.env.isProd) {
      console.log("📋 Validating production config...");
      validateConfig(secretsLoadedSuccessfully);
    }

    // 5️⃣ NON-BLOCKING DB validation (do NOT await)
    if (config.env.isProd) {
      console.log("🔍 Scheduling DB validation...");

      validateDatabase().catch((err) => {
        console.error("Database validation failed:", err);
        if (config.sentryDsn) Sentry.captureException(err);
      });
    }

    // 6️⃣ Load Express app
    const { app } = await import("./app.js");

    // 7️⃣ Register routes (timeout protected)
    console.log("⚙️ Registering routes...");
    const { registerRoutes } = await import("./routes.js");
    await withTimeout(
      registerRoutes(app),
      8000,
      "Route registration"
    );

    // 8️⃣ Wrap with serverless
    console.log("🚀 Wrapping Express with serverless-http...");
    const wrapStart = Date.now();
    
    console.log("[HANDLER] Before serverless() call");
    cachedHandler = serverless(app);
    console.log("[HANDLER] After serverless() call");
    
    const wrapDuration = Date.now() - wrapStart;
    console.log(`[HANDLER] serverless-http wrapping took ${wrapDuration}ms`);
    console.log("[HANDLER] Verifying handler type:", typeof cachedHandler);
    console.log("[HANDLER] Handler is callable:", typeof cachedHandler === 'function');

    console.log("✅ Serverless function initialized");

    // 9️⃣ Migrations DISABLED on serverless (run manually via scripts/run-migration-once.ts)
    // CRITICAL: DO NOT enable AUTO_MIGRATE on Vercel! CREATE INDEX CONCURRENTLY takes
    //           30-120+ seconds to build indexes, causing 504 timeouts on cold starts.
    // To run migrations: npm run migrate:vercel (one-time via Vercel CLI)
    if (config.env.isProd) {
      const autoMigrate = process.env.AUTO_MIGRATE;
      if (autoMigrate === 'true') {
        console.error("❌ CRITICAL: AUTO_MIGRATE is enabled on Vercel!");
        console.error("   This WILL cause 504 timeouts during cold starts.");
        console.error("   Migrations are BLOCKED. Run manually: npm run migrate:vercel");
        console.error("   Then remove AUTO_MIGRATE environment variable from Vercel.");
        // DO NOT run migrations - they block serverless for 30-120+ seconds
      } else {
        console.log("✅ Auto-migrations disabled (correct for Vercel serverless)");
      }
    }

    return cachedHandler;
  } catch (error) {
    console.error("❌ Failed to initialize Vercel handler:", error);

    if (config.env.isProd && config.sentryDsn) {
      Sentry.captureException(error);
    }

    throw error;
  }
}