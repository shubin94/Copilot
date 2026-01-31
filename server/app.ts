import { type Server } from "node:http";

import express from "express";
import type { Express, Request, Response, NextFunction } from "express";
import helmet from "helmet";
import compression from "compression";
import rateLimit from "express-rate-limit";
import { randomBytes } from "node:crypto";
import session from "express-session";
import connectPgSimple from "connect-pg-simple";
import pkg from "pg";
const { Pool } = pkg;
import { registerRoutes } from "./routes.ts";
import { config } from "./config.ts";
import { handleExpiredSubscriptions } from "./services/subscriptionExpiry.ts";

const PgSession = connectPgSimple(session);

export function log(message: string, source = "express") {
  const formattedTime = new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });

  console.log(`${formattedTime} [${source}] ${message}`);
}

export const app = express();

declare module 'http' {
  interface IncomingMessage {
    rawBody: unknown
  }
}
app.use(express.json({
  limit: '50mb',
  verify: (req, _res, buf) => {
    req.rawBody = buf;
  }
}));
app.use(express.urlencoded({ extended: false, limit: '50mb' }));

app.use(helmet({ contentSecurityPolicy: false, crossOriginEmbedderPolicy: false }));
app.use(compression());

const authLimiter = rateLimit({
  windowMs: config.rateLimit.windowMs,
  max: config.rateLimit.max,
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true,
});
if (config.env.isProd) {
  app.use("/api/auth/", authLimiter);
}

const useMemorySession = config.session.useMemory;
const sessionStore = useMemorySession
  ? new (session as any).MemoryStore()
  : new PgSession({
      pool: new Pool({
        connectionString: config.db.url,
        // Session store pool sizing - handles session read/write/cleanup only
        max: 5,                      // Smaller pool (sessions are lightweight queries)
        min: 1,                      // Keep 1 warm connection for session checks
        idleTimeoutMillis: 30000,    // Close idle connections after 30s
        connectionTimeoutMillis: 5000, // Fail fast if pool exhausted
        ssl: config.env.isProd
          ? { rejectUnauthorized: true }
          : (process.env.DB_ALLOW_INSECURE_DEV === "true" ? { rejectUnauthorized: false } : undefined),
      }),
      tableName: "session",
      createTableIfMissing: true,
    });

app.use(
  session({
    store: sessionStore,
    secret: config.session.secret,
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: config.session.secureCookies,
      httpOnly: true,
      sameSite: "lax",
      maxAge: config.session.ttlMs,
    },
  })
);

const CSRF_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

app.use((req, res, next) => {
  if (!CSRF_METHODS.has(req.method)) return next();
  if (req.method === "OPTIONS") return next();

  const origin = req.headers.origin;
  const referer = req.headers.referer;

  const isAllowedOrigin = (urlValue: string | undefined): boolean => {
    if (!urlValue) return false;
    try {
      const incoming = new URL(urlValue);
      return config.csrf.allowedOrigins.some((allowed) => {
        try {
          const allowUrl = new URL(allowed);
          return allowUrl.protocol === incoming.protocol && allowUrl.host === incoming.host;
        } catch {
          return false;
        }
      });
    } catch {
      return false;
    }
  };

  if (origin && !isAllowedOrigin(origin)) {
    log(`CSRF blocked: origin not allowed (${origin})`, "csrf");
    return res.status(403).json({ message: "Forbidden" });
  }

  if (!origin && referer && !isAllowedOrigin(referer)) {
    log(`CSRF blocked: referer not allowed (${referer})`, "csrf");
    return res.status(403).json({ message: "Forbidden" });
  }

  const requestedWith = req.get("x-requested-with");
  if (!requestedWith || requestedWith.toLowerCase() !== "xmlhttprequest") {
    log("CSRF blocked: missing or invalid X-Requested-With header", "csrf");
    return res.status(403).json({ message: "Forbidden" });
  }

  return next();
});

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  const redact = (obj: any): any => {
    if (!obj || typeof obj !== 'object') return obj;
    const maskKeys = new Set(["password", "temporaryPassword", "token", "apiKey", "smtpPass"]);
    if (Array.isArray(obj)) return obj.map(redact);
    const out: any = {};
    for (const k of Object.keys(obj)) {
      const v = (obj as any)[k];
      out[k] = maskKeys.has(k) ? "***redacted***" : (typeof v === 'object' ? redact(v) : v);
    }
    return out;
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse && !config.env.isProd) {
        logLine += ` :: ${JSON.stringify(redact(capturedJsonResponse))}`;
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      log(logLine);
    }
  });

  next();
});

export default async function runApp(
  setup: (app: Express, server: Server) => Promise<void>,
): Promise<Server> {
  const server = await registerRoutes(app);

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    // Capture 5xx errors in Sentry (skip 4xx user errors)
    if (status >= 500 && process.env.SENTRY_DSN) {
      const Sentry = require("@sentry/node");
      Sentry.captureException(err);
    }

    res.status(status).json({ message });
    return;
  });

  // importantly run the final setup after setting up all the other routes so
  // the catch-all route doesn't interfere with the other routes
  await setup(app, server);

  // ALWAYS serve the app on the port specified in the environment variable PORT
  // Other ports are firewalled. Default to 5000 if not specified.
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = config.server.port;
  const host = config.server.host;

  // Configure keep-alive and header timeouts to prevent 502 errors with load balancers
  // ALB/NLB typically use 60s idle timeout, so we set keep-alive to 65s to ensure
  // the Node server closes connections before the LB does (preventing race conditions)
  server.keepAliveTimeout = 65000; // 65 seconds
  server.headersTimeout = 66000;   // Must be greater than keepAliveTimeout

  return new Promise((resolve, reject) => {
    try {
      server.listen({
        port,
        host,
      }, () => {
        log(`serving on port ${port}`);
        
        // Start subscription expiry scheduler (runs daily at 2 AM)
        try {
          scheduleSubscriptionExpiry();
        } catch (e) {
          console.error('Failed to schedule subscription expiry:', e);
        }
        
        // Wait a tick to ensure socket is truly bound before resolving
        process.nextTick(() => {
          resolve(server);
        });
      });

      server.on('error', (error: any) => {
        console.error('Server error:', error);
        reject(error);
      });
    } catch (error) {
      console.error('Failed to start server:', error);
      reject(error);
    }
  });
}

/**
 * Schedule daily subscription expiry checks
 * Runs at 2 AM every day to downgrade expired paid plans to FREE
 */
function scheduleSubscriptionExpiry() {
  const DAILY_CHECK_INTERVAL = 24 * 60 * 60 * 1000; // 24 hours
  
  const runExpiryCheck = async () => {
    try {
      log('Running subscription expiry check', 'subscription');
      const result = await handleExpiredSubscriptions();
      log(`Expiry check complete: ${result.downgraded} downgraded, ${result.errors.length} errors`, 'subscription');
      
      if (result.errors.length > 0) {
        console.error('[SUBSCRIPTION_EXPIRY] Errors:', result.errors);
      }
    } catch (err: any) {
      console.error('[SUBSCRIPTION_EXPIRY] Failed:', err.message);
    }
  };
  
  // Calculate time until next 2 AM
  const now = new Date();
  const next2AM = new Date();
  next2AM.setHours(2, 0, 0, 0);
  
  if (now > next2AM) {
    // If past 2 AM today, schedule for tomorrow
    next2AM.setDate(next2AM.getDate() + 1);
  }
  
  const msUntil2AM = next2AM.getTime() - now.getTime();
  
  log(`Subscription expiry check scheduled for ${next2AM.toLocaleString()}`, 'subscription');
  
  // Run first check at 2 AM
  setTimeout(() => {
    runExpiryCheck();
    // Then run every 24 hours
    setInterval(runExpiryCheck, DAILY_CHECK_INTERVAL);
  }, msUntil2AM);
}
