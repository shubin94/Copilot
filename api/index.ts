import "../server/lib/loadEnv.js";
import * as Sentry from "@sentry/node";
import { nodeProfilingIntegration } from "@sentry/profiling-node";

import { app } from "../server/app.js";
import { config, validateConfig } from "../server/config.js";
import { validateDatabase } from "../server/startup.js";
import { initializeEnv } from "../server/lib/loadEnv.js";
import { getEnvironmentBadge } from "../db/validateDatabase.js";
import { registerRoutes } from "../server/routes.js";
import { serveStatic } from "../server/index-prod.js";

const withTimeout = async <T>(
  promise: Promise<T>,
  ms: number,
  label: string,
): Promise<T> => {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(`${label} timeout after ${ms}ms`)), ms),
    ),
  ]);
};

let initialized = false;

async function initializeVercelExpressApp() {
  if (initialized) return;

  console.log(`\n${getEnvironmentBadge()} Environment (Vercel Native Express)`);

  await initializeEnv();

  if (process.env.NODE_ENV !== "production") {
    process.env.NODE_ENV = "production";
  }

  console.log("🔐 Loading critical secrets...");
  await withTimeout(
    (async () => {
      const { loadSecretsFromDatabase } = await import("../server/lib/secretsLoader.js");
      await loadSecretsFromDatabase();
    })(),
    8000,
    "Secrets loading",
  );

  const { secretsLoadedSuccessfully } = await import("../server/lib/secretsLoader.js");

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

  if (config.env.isProd) {
    console.log("📋 Validating production config...");
    validateConfig(secretsLoadedSuccessfully);
  }

  if (config.env.isProd) {
    console.log("🔍 Scheduling DB validation...");
    validateDatabase().catch((err) => {
      console.error("Database validation failed:", err);
      if (config.sentryDsn) Sentry.captureException(err);
    });
  }

  app.use((req, _res, next) => {
    console.log("[ROUTE MATCHING START]", req.method, req.url);
    next();
  });

  console.log("⚙️ Registering routes...");
  await withTimeout(registerRoutes(app), 8000, "Route registration");

  // ✅ Register SSR handlers for /detectives/* pages (location listings and profiles)
  console.log("⚙️ Registering SSR static handlers...");
  try {
    await serveStatic(app, null as any);
    console.log("✅ SSR static handlers registered successfully");
  } catch (error) {
    console.error("❌ Error registering SSR static handlers:", error);
    if (error instanceof Error) {
      console.error("Error details:", error.message);
    }
  }

  initialized = true;
  console.log("✅ Native Vercel Express app initialized");
}

await initializeVercelExpressApp();

export default app;
