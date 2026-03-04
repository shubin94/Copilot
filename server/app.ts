import { type Server } from "node:http";

import express from "express";
import type { Express, Request, Response, NextFunction } from "express";
import helmet from "helmet";
import compression from "compression";
import cors from "cors";
import rateLimit from "express-rate-limit";
import session from "express-session";
import connectPgSimple from "connect-pg-simple";
import pkg from "pg";
const { Pool } = pkg;
// NOTE: registerRoutes is imported INSIDE runApp() to ensure environment is loaded first
import { config } from "./config.js";
import { handleExpiredSubscriptions } from "./services/subscriptionExpiry.js";

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

// Trust first proxy in production (Vercel, ALB, nginx) so req.secure and X-Forwarded-* are correct
if (config.env.isProd || process.env.VERCEL === "1") {
  app.set("trust proxy", 1);
}

declare module 'http' {
  interface IncomingMessage {
    rawBody: unknown
  }
}

// OPTIMIZATION: Per-route body size limits instead of global 50MB
// These are exported and applied selectively in routes.ts
export const bodyParsers = {
  // Public read-only routes: minimal body size (1MB for query params, etc.)
  public: {
    json: express.json({
      limit: '1mb',
      verify: (req, _res, buf) => { req.rawBody = buf; }
    }),
    urlencoded: express.urlencoded({ extended: false, limit: '1mb' })
  },
  
  // Authentication endpoints: small body size (10KB for login/register)
  auth: {
    json: express.json({
      limit: '10kb',
      verify: (req, _res, buf) => { req.rawBody = buf; }
    }),
    urlencoded: express.urlencoded({ extended: false, limit: '10kb' })
  },
  
  // File upload endpoints: large body size (10MB for PDFs, images, etc.)
  fileUpload: {
    json: express.json({
      limit: '10mb',
      verify: (req, _res, buf) => { req.rawBody = buf; }
    }),
    urlencoded: express.urlencoded({ extended: false, limit: '10mb' })
  }
};

// CORS/CSRF configuration - define origins once to prevent drift
const configuredOrigins = config.csrf.allowedOrigins;
const localDevOrigins = [
  "http://localhost:5173",
  "http://localhost:5000",
  "http://127.0.0.1:5173",
  "http://127.0.0.1:5000",
];

function isLocalhostOrigin(origin: string): boolean {
  try {
    const u = new URL(origin);
    return u.hostname === "localhost" || u.hostname === "127.0.0.1";
  } catch {
    return false;
  }
}

const allowedOrigins = Array.from(new Set(
  (config.env.isProd
    ? configuredOrigins.filter((origin) => !isLocalhostOrigin(origin))
    : [...configuredOrigins, ...localDevOrigins]
  ).map((origin) => origin.replace(/\/$/, ""))
));

// CORS configuration object - CRITICAL for Vercel proxy fallback support
// Must handle both Vercel rewrite proxying AND direct backend fallback requests
const corsConfig = {
  origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
    // Allow requests with no origin (mobile apps, Postman, curl, etc.)
    if (!origin) {
      console.log("[CORS] ✅ No origin header - allowing (mobile/postman/internal)");
      return callback(null, true);
    }
    
    // Normalize origin by removing trailing slashes
    const normalizedOrigin = origin.replace(/\/$/, '');
    
    // Check for exact match
    let isAllowed = false;
    
    // 1. Try exact match first
    for (const allowed of allowedOrigins) {
      const normalizedAllowed = allowed.replace(/\/$/, '');
      if (normalizedOrigin === normalizedAllowed) {
        isAllowed = true;
        console.log(`[CORS] ✅ Exact match: ${normalizedOrigin}`);
        break;
      }
    }
    
    // 2. Try hostname match (for subdomains and variants)
    if (!isAllowed) {
      try {
        const originUrl = new URL(normalizedOrigin);
        const originHostname = originUrl.hostname;
        
        for (const allowed of allowedOrigins) {
          const allowedUrl = new URL(allowed.replace(/\/$/, ''));
          const allowedHostname = allowedUrl.hostname;
          
          // Allow if hostname matches exactly or if origin hostname ends with ".{allowedHostname}"
          if (originHostname === allowedHostname || 
              originHostname.endsWith('.' + allowedHostname)) {
            isAllowed = true;
            console.log(`[CORS] ✅ Hostname match: ${originHostname} ≈ ${allowedHostname}`);
            break;
          }
        }
      } catch (e) {
        // Invalid URL, will check Vercel preview below
      }
    }

    // 3. Allow all Vercel preview deployments: askdetectives1-*.vercel.app
    if (!isAllowed) {
      const vercelPreviewRegex = /^https:\/\/askdetectives1-[a-z0-9-]+\.vercel\.app$/i;
      if (vercelPreviewRegex.test(normalizedOrigin)) {
        isAllowed = true;
        console.log(`[CORS] ✅ Vercel preview: ${normalizedOrigin}`);
      }
    }

    if (!isAllowed) {
      console.warn(`[CORS] ❌ REJECTED origin: ${normalizedOrigin}`);
      console.warn(`[CORS] Allowed: ${allowedOrigins.join(" | ")} (+ Vercel previews)`);
    }
    
    // Return true to allow (CORS headers will be sent), false to block
    callback(null, isAllowed);
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS", "HEAD"],
  allowedHeaders: [
    "Content-Type",
    "Authorization",
    "X-CSRF-Token",
    "X-Requested-With",
    "Accept",
    "Cache-Control",
    "X-API-Version",
  ],
  exposedHeaders: ["Set-Cookie", "X-CSRF-Token", "X-RateLimit-Remaining"],
  maxAge: 86400, // 24 hours - cache preflight responses
};


// ============================================================================
// ✅ OPTIMIZATION: Middleware Scoping Strategy
// ============================================================================
// Expensive middlewares are scoped to '/api' routes ONLY to minimize SSR overhead:
// 
// GLOBAL middlewares (all requests):
//   - helmet (security headers) - lightweight, always needed
//   - compression - applied early, beneficial for all responses
//   - CORS - enabled for all requests
//   - rate limiters (auth, claim endpoints) - specific paths only
//   - request logging - conditional logging only for /api
// 
// API-ONLY middlewares (bypasses SSR - /detectives/*, static assets):
//   ✅ Session middleware - avoided on SSR requests (expensive DB lookup)
//   ✅ CSRF checking - avoided on SSR requests (expensive validation logic)
//   ✅ Body parsers - applied only to /api routes in routes.ts
// 
// RESULT: SSR page requests (/detectives/:country/:state/:city/) skip:
//   - Session database lookups
//   - CSRF validation (expensive origin/token checking)
//   - Body parsing (not needed for GET requests)
// 
// PERFORMANCE IMPACT: ~50-100ms saved per SSR request
// ============================================================================

// Apply CORS middleware FIRST - before any other middleware
app.use(cors(corsConfig));


// Explicit preflight handler for OPTIONS
app.options('*', cors(corsConfig));

// Security headers - use custom CSP that allows Google Fonts and Radix UI
app.use(helmet({ 
  contentSecurityPolicy: config.env.isProd ? {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'", "https://fonts.googleapis.com", "https://fonts.gstatic.com"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com", "https://fonts.gstatic.com"],
      styleSrcElem: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com", "https://fonts.gstatic.com"],
      imgSrc: ["'self'", "data:", "https:", "https://*.supabase.co"],
      connectSrc: ["'self'", "https://api.askdetectives.com", "https://www.askdetectives.com", "https://*.supabase.co", "wss:"],
      fontSrc: ["'self'", "https://fonts.gstatic.com", "data:"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'none'"],
      frameAncestors: ["'self'"],
      formAction: ["'self'"],
      baseUri: ["'self'"],
    },
  } : false,
  crossOriginEmbedderPolicy: false,
  hsts: config.env.isProd ? {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true,
  } : false,
}));
app.use(compression());

// SECURITY: Auth endpoints must always be rate-limited to prevent brute force attacks.
// Strict limits: 10 failed attempts per 15 minutes per IP (successful requests don't count)
const authLimiter = rateLimit({
  windowMs: config.rateLimit.windowMs, // 15 minutes
  max: 10, // Strict limit: 10 failed attempts per window
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true, // Only failed auth attempts count
  skip: config.env.isProd ? undefined : () => true, // Disable auth rate limit in dev/test
  message: { error: "Too many authentication attempts. Please try again later." },
});
app.use("/api/auth/", authLimiter);

// SECURITY: Claim account endpoints are public and must be rate-limited
// These endpoints use tokens but can be brute-forced
const claimLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 15, // 15 attempts per 15 minutes per IP
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many claim attempts. Please try again later." },
});
app.use("/api/claim-account/", claimLimiter);

// SECURITY: Profile claim submissions are public and can be spammed
const claimSubmissionLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5, // 5 claim submissions per hour per IP
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many claim submissions. Please try again later." },
});
app.use("/api/claims", claimSubmissionLimiter);

// ============================================================================
// ✅ OPTIMIZATION: Global Session Store Pool
// ============================================================================
// Session store pool is created ONCE globally, not per request
// This is a separate pool from the main application pool (db/index.ts)
// because sessions need different concurrency/timeout characteristics
// 
// Sizing:
// - max: 5 (sessions are lightweight, only need fast lookup/write)
// - min: 1 (keep 1 warm for fast session checks)
// - idleTimeoutMillis: 30000 (close idle connections after 30s)
// - connectionTimeoutMillis: 5000 (fail fast if pool exhausted)
// 
// This prevents per-request pool creation overhead
let sessionStorePool: typeof Pool | null = null;

function getSessionStorePool() {
  if (sessionStorePool) {
    return sessionStorePool;  // Return existing global pool
  }

  // Determine if this is a production database by parsing the connection URL
  let isProductionDb = true;
  try {
    const dbUrl = new URL(config.db.url || "");
    const hostname = dbUrl.hostname;
    isProductionDb = hostname !== "localhost" && hostname !== "127.0.0.1";
  } catch {
    // If URL parsing fails, assume production
    isProductionDb = true;
  }

  // ✅ Create pool ONCE globally
  sessionStorePool = new Pool({
    connectionString: config.db.url,
    // Session store pool sizing - handles session read/write/cleanup only
    max: 5,                      // Smaller pool (sessions are lightweight queries)
    min: 1,                      // Keep 1 warm connection for session checks
    idleTimeoutMillis: 30000,    // Close idle connections after 30s
    connectionTimeoutMillis: 5000, // Fail fast if pool exhausted
    ssl: isProductionDb
      ? { rejectUnauthorized: false } // Accept self-signed certs from managed databases (Render, Supabase)
      : undefined,
  });

  return sessionStorePool;
}

// OPTIMIZED: Create session middleware but apply selectively to authenticated routes only
// This avoids unnecessary database lookups on public APIs
export function getSessionMiddleware() {
  const useMemorySession = config.session.useMemory;

  let sessionStore;
  if (useMemorySession) {
    // Use in-memory session store in development (no Postgres required)
    sessionStore = new (session as any).MemoryStore();
    console.log("[dev] Using in-memory session store (Postgres not required)");
  } else {
    // Use Postgres session store in production
    const PgSession = connectPgSimple(session);
    
    // ✅ Reuse global session store pool (created once, not per request)
    const pool = getSessionStorePool();
    
    sessionStore = new PgSession({
      pool: pool,
      tableName: "session",
      createTableIfMissing: true,
    });
  }

  const isDev = !config.env.isProd;
  const sessionMiddleware = session({
    store: sessionStore,
    secret: config.session.secret,
    proxy: config.env.isProd || process.env.VERCEL === "1",
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: isDev ? false : "auto",
      sameSite: isDev ? "lax" : "none",
      maxAge: config.session.ttlMs,
      domain: undefined,  // NO DOMAIN RESTRICTION
    },
  });
  
  if (process.env.NODE_ENV === "production") {
    console.log("[Session] Cookie domain set to NULL (no restriction) for cross-origin SameSite=None");
  }
  
  return sessionMiddleware;
}

// ✅ OPTIMIZATION: Apply session middleware ONLY to API routes
// Session store lookups are expensive (database queries for session data)
// SSR routes (/detectives/*) and static files don't need session data
// const globalSessionMiddleware = getSessionMiddleware();
// app.use(globalSessionMiddleware);

// ✅ Create session middleware instance (creates global session store pool once)
const sessionMiddleware = getSessionMiddleware();

// ✅ Apply session middleware ONLY to /api routes (CRITICAL OPTIMIZATION)
// - Prevents session database lookups on SSR page requests
// - SSR routes (/detectives/:country/:state/:city) bypass session overhead
// - Static assets (CSS, JS, images) don't pay session cost
app.use("/api", sessionMiddleware);

const CSRF_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);


// Public endpoints that should work without authentication (incognito mode, mobile, etc.)
const CSRF_EXEMPT_PATHS = [
  "/api/smart-search",  // Homepage AI search - must work for all public users
  "/api/metrics",       // Client perf metrics - public, no session required
];

function getCookieValue(req: Request, name: string): string | undefined {
  const header = req.headers.cookie;
  if (!header) return undefined;
  const parts = header.split(";");
  for (const part of parts) {
    const trimmed = part.trim();
    if (!trimmed) continue;
    const eqIndex = trimmed.indexOf("=");
    if (eqIndex === -1) continue;
    const key = trimmed.slice(0, eqIndex).trim();
    if (key !== name) continue;
    const value = trimmed.slice(eqIndex + 1);
    return decodeURIComponent(value);
  }
  return undefined;
}

// ✅ OPTIMIZATION: CSRF validation middleware ONLY on /api routes
// - Avoids CSRF checking overhead on SSR requests (/detectives/*)
// - Avoids CSRF checking overhead on static assets
// - Body parsers used here are already scoped to /api in routes.ts
app.use("/api", (req, res, next) => {
  if (!CSRF_METHODS.has(req.method)) return next();
  if (req.method === "OPTIONS") return next();
  
  // Skip CSRF validation for public endpoints
  if (CSRF_EXEMPT_PATHS.includes(req.path)) {
    return next();
  }

  const origin = req.headers.origin;
  const referer = req.headers.referer;
  const requestedWith = req.get("x-requested-with");
  const token = req.get("x-csrf-token");
  const sessionToken = (req.session as any)?.csrfToken;
  const cookieToken = getCookieValue(req, "csrfToken");
  const sessionId = (req.session as any)?.id || "NO_SESSION_ID";

  log(`CSRF debug: ${req.method} ${req.path} session=${sessionId.substring(0, 20)}... header=${token ? token.substring(0, 20) + "..." : "MISSING"} sessionToken=${sessionToken ? sessionToken.substring(0, 20) + "..." : "MISSING"}`, "csrf");

  if (!req.session) {
    if (CSRF_EXEMPT_PATHS.includes(req.path)) {
      return next();
    }
    if (cookieToken && token === cookieToken) {
      return next();
    }
    log(`CSRF blocked: ${req.method} ${req.path} - No session and no valid CSRF cookie`, "csrf");
    return res.status(403).json({ error: "Invalid CSRF token" });
  }

  const isAllowedOrigin = (urlValue: string | undefined): boolean => {
    if (!urlValue) return false;
    try {
      const incoming = new URL(urlValue);
      return allowedOrigins.some((allowed) => {
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
    return res.status(403).json({ error: "CSRF origin not allowed" });
  }

  if (!origin && referer && !isAllowedOrigin(referer)) {
    log(`CSRF blocked: referer not allowed (${referer}) ${req.method} ${req.path}`, "csrf");
    return res.status(403).json({ error: "CSRF referer not allowed" });
  }

  if (sessionToken) {
    if (!token || token !== sessionToken) {
      log(`CSRF blocked: ${req.method} ${req.path} - Session ${sessionId.substring(0, 20)}... - Token mismatch (header: ${token ? token.substring(0, 20) + "..." : "MISSING"}, session: ${sessionToken ? sessionToken.substring(0, 20) + "..." : "MISSING"})`, "csrf");
      return res.status(403).json({ error: "Invalid CSRF token" });
    }
  } else if (cookieToken) {
    if (!token || token !== cookieToken) {
      log(`CSRF blocked: ${req.method} ${req.path} - Session ${sessionId.substring(0, 20)}... - Cookie token mismatch (header: ${token ? token.substring(0, 20) + "..." : "MISSING"}, cookie: ${cookieToken ? cookieToken.substring(0, 20) + "..." : "MISSING"})`, "csrf");
      return res.status(403).json({ error: "Invalid CSRF token" });
    }
  } else {
    log(`CSRF blocked: ${req.method} ${req.path} - Session ${sessionId.substring(0, 20)}... - Missing CSRF token`, "csrf");
    return res.status(403).json({ error: "Invalid CSRF token" });
  }

  // CSRF token is valid for the entire session duration (no time-based expiration)
  // The token becomes invalid only when the session expires

  if (!requestedWith || requestedWith.toLowerCase() !== "xmlhttprequest") {
    log(`CSRF blocked: missing or invalid X-Requested-With header ${req.method} ${req.path}`, "csrf");
    return res.status(403).json({ error: "Missing or invalid X-Requested-With header" });
  }

  return next();
});

// ✅ OPTIMIZATION: Request logging ONLY on /api routes
// SSR routes are logged separately and infrequently (cached by short-term middleware)
// Static assets don't need individual request logging (handled by Vercel/CDN)
app.use("/api", (req, res, next) => {
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
    // SECURITY: Redact sensitive fields from logs (passwords, tokens, API keys, etc.)
    const maskKeys = new Set(["password", "temporaryPassword", "token", "csrfToken", "apiKey", "smtpPass"]);
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
    let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
    if (capturedJsonResponse && !config.env.isProd) {
      logLine += ` :: ${JSON.stringify(redact(capturedJsonResponse))}`;
    }

    if (logLine.length > 80) {
      logLine = logLine.slice(0, 79) + "…";
    }

    log(logLine);
  });

  next();
});

export default async function runApp(
  setup: (app: Express, server: Server) => Promise<void>,
): Promise<Server> {
  // Dynamic import of routes to ensure environment is loaded BEFORE routes are imported
  console.log('[DEBUG] Starting to import registerRoutes...');
  const { registerRoutes } = await import("./routes.js");
  console.log('[DEBUG] registerRoutes imported successfully');
  
  console.log('[DEBUG] Calling registerRoutes(app)...');
  const server = await registerRoutes(app);
  console.log('[DEBUG] registerRoutes completed, server ready');

  // Global error handler - SECURITY: Never leak stack traces or sensitive data in production
  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    // Capture 5xx errors in Sentry (skip 4xx user errors)
    if (status >= 500 && config.env.isProd && config.sentryDsn) {
      const Sentry = require("@sentry/node");
      Sentry.captureException(err);
    }

    // Log full error details server-side for debugging
    if (status >= 500) {
      console.error('[ERROR]', {
        status,
        message,
        stack: config.env.isProd ? undefined : err.stack,
        url: _req.originalUrl,
        method: _req.method,
      });
    }

    // SECURITY: In production, return generic error messages only (no stack traces)
    const responseMessage = config.env.isProd && status >= 500 
      ? "An internal error occurred. Please try again later."
      : message;

    res.status(status).json({ 
      message: responseMessage,
      ...(config.env.isProd ? {} : { stack: err.stack })
    });
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
