import type { Express, Request, Response, NextFunction } from "express";
import { createHash, randomBytes } from "node:crypto";
import crypto from "crypto";
import { createServer, type Server } from "http";
import Razorpay from "razorpay";
import rateLimit from "express-rate-limit";
import { storage, generateSlug } from "./storage.js";
import { sendClaimApprovedEmail } from "./email.js";
import { smtpEmailService, EMAIL_TEMPLATE_KEYS } from "./services/smtpEmailService.js";
import { generateClaimToken, calculateTokenExpiry, buildClaimUrl } from "./services/claimTokenService.js";
import bcrypt from "bcrypt";
import { db, pool } from "../db/index.js";
import { eq, and, or, desc, avg, count, ilike, sql, isNotNull } from "drizzle-orm";
import {
  detectives,
  countries,
  states,
  cities,
  detectiveVisibility,
  users,
  claimTokens,
  passwordResetTokens,
  detectiveSnippets,
  appSecrets,
  services,
  reviews,
  caseStudies,
  insertUserSchema, 
  insertDetectiveSchema, 
  insertServiceSchema, 
  insertReviewSchema,
  insertOrderSchema,
  insertFavoriteSchema,
  insertDetectiveApplicationSchema,
  insertProfileClaimSchema,
  insertServiceCategorySchema,
  updateDetectiveSchema,
  updateServiceSchema,
  updateReviewSchema,
  updateOrderSchema,
  updateServiceCategorySchema,
  updateSiteSettingsSchema,
  type Detective
} from "../shared/schema.js";
import { z } from "zod";
import { fromZodError } from "zod-validation-error";
import { config } from "./config.js";
import { bodyParsers } from "./app.js";
import * as LocationService from "./services/locationService.js";
import * as cache from "./lib/cache.js";
import { getLocationDetectivesForSEO } from "./lib/seo-injection.js";
import { runSmartSearch } from "./lib/smart-search.js";
import { getCurrencyForCountry, getEffectiveCurrency } from "../client/src/lib/country-currency-map.js";
// import pkg from "pg"; // Unused
import { requirePolicy } from "./policy.js";
import { requireAuth, requireRole } from "./authMiddleware.js";
import { paymentGatewayRoutes } from "./routes/paymentGateways.js";
import { registerLocationRoutes } from "./routes/locationRoutes.js";
import { registerPaymentRoutes } from "./routes/paymentRoutes.js";
import { clearFreePlanCache, getFreePlanId } from "./services/freePlan.js";
import { getPaymentGateway } from "./services/paymentGateway.js";
import { createPayPalOrder, capturePayPalOrder, verifyPayPalCapture } from "./services/paypal.js";
import { applyPackageEntitlements, computeEffectiveBadges } from "./services/entitlements.js";
import { uploadDataUrl, deletePublicUrl, parsePublicUrl } from "./supabase.js";
import adminCmsRouter from "./routes/admin-cms.js";
import adminFinanceRouter from "./routes/admin-finance.js";
import adminEmployeesRouter from "./routes/admin/employees.js";
import publicPagesRouter from "./routes/public-pages.js";
import publicCategoriesRouter from "./routes/public-categories.js";
import publicTagsRouter from "./routes/public-tags.js";
// import sitemapRouter from "./routes/sitemap.js"; // Unused
// import rssRouter from "./routes/rss.js"; // Unused
import llmsTxtRouter from "./routes/llms-txt.js";
import featuredHomeServicesRouter from "./routes/featured-home-services.js";
import { buildServiceCardDTO } from "../utils/buildServiceCardDTO.js";
import type { DetectiveListDTO } from "../interfaces/DetectiveListDTO.js";
import { googleIndexing } from "./services/google-indexing-service.js";

// Utility function to generate URL-safe slugs from text

// Country code to name mapping for URL handling
const COUNTRY_CODE_MAP: Record<string, string> = {
  'IN': 'India',
  'US': 'United States',
  'UK': 'United Kingdom',
  'GB': 'United Kingdom',
  'CA': 'Canada',
  'AU': 'Australia',
  'DE': 'Germany',
  'FR': 'France',
  'IT': 'Italy',
  'ES': 'Spain',
  'NZ': 'New Zealand',
  'IE': 'Ireland',
  'SG': 'Singapore',
  'MY': 'Malaysia',
  'PH': 'Philippines',
  'TH': 'Thailand',
  'VN': 'Vietnam',
  'PK': 'Pakistan',
  'BD': 'Bangladesh',
  'ZA': 'South Africa',
  'AE': 'United Arab Emirates',
  'KW': 'Kuwait',
  'SA': 'Saudi Arabia',
  'QA': 'Qatar',
  'OM': 'Oman',
  'JP': 'Japan',
  'CN': 'China',
  'HK': 'Hong Kong',
  'MX': 'Mexico',
  'BR': 'Brazil',
  'AR': 'Argentina',
  'CL': 'Chile',
};

/**
 * Convert country name or slug back to country code
 * Handles: "India" -> "IN", "india" -> "IN", "united-states" -> "US"
 */
function getCountryCode(countryNameOrSlug: string): string {
  if (!countryNameOrSlug) return '';
  
  // Normalize: convert slug to title case (e.g., "united-states" -> "United States")
  const normalized = countryNameOrSlug
    .toLowerCase()
    .split('-')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
  
  // Find the country code by looking up the value
  for (const [code, name] of Object.entries(COUNTRY_CODE_MAP)) {
    if (name.toLowerCase() === normalized.toLowerCase()) {
      return code;
    }
  }
  
  // If not found, assume it's already a country code
  return countryNameOrSlug.toUpperCase();
}

// Razorpay client initialization has been moved to server/routes/paymentRoutes.ts

let razorpayClient = new Razorpay({
  key_id: config.razorpay.keyId || "dummy",
  key_secret: config.razorpay.keySecret || "dummy",
});

async function getRazorpayClient() {
  const gateway = await getPaymentGateway("razorpay");
  if (!gateway) {
    return razorpayClient;
  }

  return new Razorpay({
    key_id: gateway.config.keyId || config.razorpay.keyId,
    key_secret: gateway.config.keySecret || config.razorpay.keySecret,
  });
}

async function assertBlueTickNotAlreadyActive(detectiveId: string, provider: string): Promise<void> {
  const detective = await storage.getDetective(detectiveId);
  if (!detective) {
    throw new Error(`Detective not found: ${detectiveId}`);
  }

  if (detective.blueTickAddon || detective.hasBlueTick) {
    const conflictError = new Error("Blue Tick already active");
    Object.assign(conflictError, { statusCode: 409, provider });
    throw conflictError;
  }
}

// Helper: Rotate CSRF token after sensitive operations
function rotateCsrfToken(req: Request): string {
  const newToken = randomBytes(32).toString("hex");
  req.session.csrfToken = newToken;
  req.session.csrfTokenGeneratedAt = Date.now();
  return newToken;
}

function getEmployeeAccessKeyFromAdminPath(path: string): string | null {
  const normalized = (path || "").toLowerCase();

  if (normalized === "/" || normalized.startsWith("/dashboard")) return "dashboard";
  if (normalized.startsWith("/employees")) return "employees";
  if (normalized.startsWith("/detectives") || normalized.startsWith("/detective")) return "detectives";
  if (normalized.startsWith("/services") || normalized.startsWith("/service-categories")) return "services";
  if (normalized.startsWith("/finance") || normalized.startsWith("/payment-gateways") || normalized.startsWith("/subscriptions")) return "payments";
  if (normalized.startsWith("/settings")) return "settings";
  if (normalized.startsWith("/cms") || normalized.startsWith("/categories") || normalized.startsWith("/tags") || normalized.startsWith("/pages")) return "cms";
  if (normalized.startsWith("/users")) return "users";
  if (normalized.startsWith("/reports")) return "reports";

  // Unmapped admin paths are admin-only by default
  return null;
}

// Helper to calculate subscription expiry date
function calculateExpiryDate(activatedAt: Date | null | undefined, billingCycle: string | null | undefined): Date | null {
  if (!activatedAt || !billingCycle) return null;
  const baseDate = new Date(activatedAt);
  if (billingCycle === "yearly") {
    baseDate.setFullYear(baseDate.getFullYear() + 1);
  } else {
    baseDate.setDate(baseDate.getDate() + 30);
  }
  return baseDate;
}

// Helper to apply pending downgrades if expiry has passed
async function applyPendingDowngrades(detective: any): Promise<any> {
  if (!detective.pendingPackageId || !detective.subscriptionExpiresAt) {
    return detective;
  }
  
  const now = new Date();
  if (now >= new Date(detective.subscriptionExpiresAt)) {
    console.log(`[downgrade] Applying pending downgrade for detective ${detective.id}`);
    
    const newExpiryDate = calculateExpiryDate(now, detective.pendingBillingCycle);
    
    await storage.updateDetectiveAdmin(detective.id, {
      subscriptionPackageId: detective.pendingPackageId,
      billingCycle: detective.pendingBillingCycle,
      subscriptionActivatedAt: now,
      subscriptionExpiresAt: newExpiryDate,
      pendingPackageId: null,
      pendingBillingCycle: null,
    } as any);
    
    // Fetch updated detective
    return await storage.getDetective(detective.id);
  }
  
  return detective;
}

// Blue Tick validation helper has been moved to server/routes/paymentRoutes.ts

export async function registerRoutes(app: Express): Promise<Server> {
  console.log('[DEBUG] registerRoutes() called');
  
  const setNoStore = (res: Response) => {
    // Private, no-store, no-cache for authenticated/sensitive user data
    res.set("Cache-Control", "private, no-store, no-cache, must-revalidate");
    res.set("Pragma", "no-cache");
    res.set("Expires", "0");
    res.set("Surrogate-Control", "no-store");
  };

  // Session middleware is now applied globally in app.ts
  
  // OPTIMIZED: Apply body parsers with per-route size limits
  // This prevents DoS attacks on public endpoints and reduces memory overhead
  // Public routes (1MB limit), Auth routes (10KB limit), File upload routes (10MB limit)
  
  /**
   * SUBSCRIPTION SYSTEM - CRITICAL RULES
   * 
   * ALL paid feature checks MUST use:
   *   - detectives.subscriptionPackageId (presence check)
   *   - detectives.subscriptionPackage (joined package data)
   * 
   * NEVER use for access control:
   *   - detectives.subscriptionPlan (LEGACY field, display only)
   *   - Plan name string comparisons ("free", "pro", "agency")
   * 
   * SAFETY:
   *   - Missing package → treat as FREE (restricted)
   *   - Inactive package → treat as FREE (restricted)
   *   - Error fetching package → treat as FREE (restricted)
   *   - subscriptionPackageId = NULL → FREE user
   * 
   * Payment verification is the ONLY place that sets subscriptionPackageId.
   */
  
  // Helper to get service limit from package ID
  // SAFETY: Always checks subscriptionPackageId, never plan names
  async function getServiceLimit(detective: any): Promise<number> {
    // TODO: Remove in v3.0 - This is a legacy plan name check that will be removed
    // Runtime assertion: Detect legacy plan name usage
    if (!detective.subscriptionPackageId && detective.subscriptionPlan && detective.subscriptionPlan !== "free") {
      console.warn("[SAFETY] Detective has subscriptionPlan set but no subscriptionPackageId. Treating as FREE.", {
        detectiveId: detective.id,
        legacyPlan: detective.subscriptionPlan
      });
    }
    
    // If detective has a paid package, use its limit
    if (detective.subscriptionPackageId) {
      if (detective.subscriptionPackage) {
        // Use already-fetched package data
        const pkg = detective.subscriptionPackage;
        
        // SAFETY: Check package is active
        if (pkg.isActive === false) {
          console.warn("[SAFETY] Detective has inactive package. Treating as FREE.", {
            detectiveId: detective.id,
            packageId: detective.subscriptionPackageId,
            packageName: pkg.name
          });
          return 2; // Default free limit
        }
        
        return Number(pkg.serviceLimit ?? 2);
      }
      
      // Fallback: fetch package by ID
      try {
        const pkg = await storage.getSubscriptionPlanById(detective.subscriptionPackageId);
        if (!pkg) {
          console.warn("[SAFETY] Package not found for subscriptionPackageId. Treating as FREE.", {
            detectiveId: detective.id,
            packageId: detective.subscriptionPackageId
          });
          return 2; // Default free limit
        }
        
        if (pkg.isActive === false) {
          console.warn("[SAFETY] Package is inactive. Treating as FREE.", {
            detectiveId: detective.id,
            packageId: detective.subscriptionPackageId,
            packageName: pkg.name
          });
          return 2; // Default free limit
        }
        
        return Number(pkg.serviceLimit ?? 2);
      } catch (error) {
        console.error("[SAFETY] Error fetching package. Treating as FREE.", {
          detectiveId: detective.id,
          packageId: detective.subscriptionPackageId,
          error: error instanceof Error ? error.message : String(error)
        });
        return 2; // Default free limit on error
      }
    }
    
    // Default to 2 for free/unknown packages
    return 2;
  }

  async function maskDetectiveContactsPublic(d: any, _planCache?: { get: (name: string) => Promise<any> }): Promise<any> {
    try {
      // TODO: Remove in v3.0 - This is a legacy plan name check that will be removed
      // Runtime assertion: Detect legacy plan name usage
      if (!d.subscriptionPackageId && d.subscriptionPlan && d.subscriptionPlan !== "free") {
        console.warn("[SAFETY] maskDetectiveContactsPublic: Detective has subscriptionPlan set but no subscriptionPackageId. Masking all contacts.", {
          detectiveId: d.id,
          legacyPlan: d.subscriptionPlan
        });
      }
      
      // Check if detective has a paid subscription package
      // CRITICAL: This is the ONLY check for paid features
      const hasPaidPackage = !!d.subscriptionPackageId;
      
      // If detective has a paid package, check its features
      let hasEmail = false;
      let hasPhone = false;
      let hasWhatsApp = false;
      let hasWebsite = false;

      const applyFeatures = (features: string[]) => {
        hasEmail = features.includes("contact_email");
        hasPhone = features.includes("contact_phone");
        hasWhatsApp = features.includes("contact_whatsapp");
        hasWebsite = features.includes("contact_website");
      };

      // Default to FREE plan features (email-only) so public cards can show Email
      try {
        const freePlanId = await getFreePlanId();
        const freePlan = await storage.getSubscriptionPlanById(freePlanId);
        const freeFeatures = Array.isArray(freePlan?.features) ? (freePlan?.features as string[]) : [];
        applyFeatures(freeFeatures);
      } catch (error) {
        console.warn("[SAFETY] Failed to load FREE plan features, defaulting to no contacts.", {
          detectiveId: d.id,
          error: error instanceof Error ? error.message : String(error)
        });
      }
      
      if (hasPaidPackage && d.subscriptionPackage) {
        // SAFETY: Check package is active before granting features
        if (d.subscriptionPackage.isActive === false) {
          console.warn("[SAFETY] Detective has inactive package. Masking all contacts.", {
            detectiveId: d.id,
            packageId: d.subscriptionPackageId,
            packageName: d.subscriptionPackage.name
          });
          // Fall through to mask all contacts
        } else {
          // Use the already-fetched package data
          const features = Array.isArray(d.subscriptionPackage?.features) ? (d.subscriptionPackage.features as string[]) : [];
          applyFeatures(features);
        }
      } else if (hasPaidPackage && !d.subscriptionPackage) {
        // Fallback: fetch package by ID if not already loaded
        try {
          const pkg = await storage.getSubscriptionPlanById(d.subscriptionPackageId);
          if (!pkg) {
            console.warn("[SAFETY] Package not found for subscriptionPackageId. Masking all contacts.", {
              detectiveId: d.id,
              packageId: d.subscriptionPackageId
            });
          } else if (pkg.isActive === false) {
            console.warn("[SAFETY] Package is inactive. Masking all contacts.", {
              detectiveId: d.id,
              packageId: d.subscriptionPackageId,
              packageName: pkg.name
            });
          } else {
            const features = Array.isArray(pkg.features) ? (pkg.features as string[]) : [];
            applyFeatures(features);
          }
        } catch (error) {
          console.error("[SAFETY] Error fetching package for contact masking. Masking all contacts.", {
            detectiveId: d.id,
            packageId: d.subscriptionPackageId,
            error: error instanceof Error ? error.message : String(error)
          });
        }
      }
      
      // Mask contacts based on permissions
      const copy: any = { ...d };
      if (!hasEmail) {
        copy.contactEmail = undefined;
        copy.email = undefined;
      }
      if (!hasPhone) {
        copy.phone = undefined;
      }
      if (!hasWhatsApp) {
        copy.whatsapp = undefined;
      }
      if (!hasWebsite) {
        copy.businessWebsite = undefined;
      }
      return copy;
    } catch (error) {
      console.error("[SAFETY] Unexpected error in maskDetectiveContactsPublic. Masking all contacts.", {
        detectiveId: d?.id,
        error: error instanceof Error ? error.message : String(error)
      });
      // On error, mask all contacts for safety
      const copy: any = { ...d };
      copy.contactEmail = undefined;
      copy.email = undefined;
      copy.phone = undefined;
      copy.whatsapp = undefined;
      copy.businessWebsite = undefined;
      return copy;
    }
  }
  
  // Seed a sample subscription plan if none exist
  try {
    const existingPlans = await storage.getAllSubscriptionPlans(false);
    if (!Array.isArray(existingPlans) || existingPlans.length === 0) {
      await storage.createSubscriptionPlan({
        name: "pro",
        displayName: "Pro",
        monthlyPrice: "29",
        yearlyPrice: "290",
        description: "Enhanced tools and contact visibility.",
        features: ["contact_email", "contact_phone", "contact_whatsapp"],
        badges: { pro: true },
        serviceLimit: 4,
        isActive: true,
      });
      console.log("[seed] Created sample subscription plan: pro");
    }
  } catch (e) {
    console.error("[seed] Failed to seed subscription plan:", e);
  }
  
  // ============== BODY PARSER APPLICATION - APPLIED PER-ROUTE ==============
  // Body parsers are applied selectively to routes that need them:
  // - authLimit (10KB) for /api/auth/* endpoints
  // - publicLimit (1MB) for public/read-only endpoints  
  // - fileUpload (10MB) attached directly to file upload routes ONLY
  // This prevents global overrides that would bypass per-route limits
  // NOTE: Routes using authentication should explicitly apply authLimit middleware

  // ============== BODY PARSER FOR AUTH ENDPOINTS ==============
  // Apply auth-specific body parser (10KB limit) to all /api/auth routes
  app.use("/api/auth", bodyParsers.auth.json, bodyParsers.auth.urlencoded);

  // Disable caching for all auth endpoints (admin/employee/detective login)
  app.use("/api/auth", (_req, res, next) => {
    setNoStore(res);
    next();
  });

  // ============== BODY PARSER FOR PUBLIC AND GENERAL ROUTES ==============
  // Apply public body parser (1MB limit) to all /api routes by default
  // This handles contact forms, searches, and other general endpoints
  app.use("/api", bodyParsers.public.json, bodyParsers.public.urlencoded);
  
  // ============== CSRF TOKEN (must be before auth; no token required for GET) ==============
  // SECURITY: CSRF tokens must be generated using cryptographically secure randomness.
  // Using crypto.randomBytes(32) provides 256 bits of entropy.
  // NOTE: CORS headers are handled by middleware in app.ts
  // CRITICAL: This endpoint MUST NEVER throw - wraps all logic in try-catch
  
  // Rate limiter for CSRF token endpoint: 30 requests per minute per IP
  const csrfTokenLimiter = rateLimit({
    windowMs: 60000, // 1 minute
    max: 30,
    standardHeaders: true,
    legacyHeaders: false,
    handler: (_req: Request, res: Response) => {
      res.status(429).json({ error: "Too many token requests" });
    },
  });
  
  app.get("/api/csrf-token", csrfTokenLimiter, (req: Request, res: Response) => {
    try {
      const sessionId = (req.session as any)?.id || "UNKNOWN";
      console.log(`[CSRF-TOKEN] Request - Origin: ${req.headers.origin}, Method: ${req.method}, SessionID: ${sessionId.substring(0, 20)}...`);
      
      // DEBUG: Show config domain and env variable
      console.log(`[CSRF-TOKEN] DEBUG - COOKIE_DOMAIN env: ${process.env.COOKIE_DOMAIN}`);
      console.log(`[CSRF-TOKEN] DEBUG - config.session.cookieDomain: ${config.session.cookieDomain}`);
      res.setHeader("X-Debug-Cookie-Domain", process.env.COOKIE_DOMAIN || "undefined");

      // Express-session creates req.session automatically; if missing, middleware failed
      if (!req.session) {
        const fallbackToken = randomBytes(32).toString("hex");
        const isProd = config.env.isProd || process.env.VERCEL === "1";
        setNoStore(res);
        res.cookie("csrfToken", fallbackToken, {
          httpOnly: true,
          secure: isProd,
          sameSite: isProd ? "none" : "lax",
          maxAge: config.session.ttlMs,
          domain: config.session.cookieDomain || undefined,
          path: "/",
        });
        console.warn("[CSRF-TOKEN] Session unavailable - using cookie fallback token");
        return res.status(200).json({ csrfToken: fallbackToken, session: false });
      }
      
      // Generate or reuse CSRF token
      if (!req.session.csrfToken) {
        req.session.csrfToken = randomBytes(32).toString("hex");
        req.session.csrfTokenGeneratedAt = Date.now();
        console.log(`[CSRF-TOKEN] Generated new token: ${req.session.csrfToken.substring(0, 16)}... for session ${sessionId.substring(0, 20)}...`);
      } else {
        console.log(`[CSRF-TOKEN] Reusing existing token: ${req.session.csrfToken.substring(0, 16)}... for session ${sessionId.substring(0, 20)}...`);
      }
      
      // Explicitly save session (required when saveUninitialized: false)
      // This ensures the session cookie is sent even on first request
      req.session.save((err: any) => {
        if (err) {
          console.error("[CSRF-TOKEN] Failed to save session:", err);
          // Prevent double response if headers already sent
          if (!res.headersSent) {
            return res.status(403).json({ error: "Session persistence failed" });
          }
          return;
        }
        
        // Prevent caching/ETag revalidation which can return 304 without a body
        setNoStore(res);
        
        console.log(`[CSRF-TOKEN] Saved session ${sessionId.substring(0, 20)}... with token ${req.session.csrfToken?.substring(0, 16)}...`);

        // Set CSRF token cookie for double-submit validation (fallback when session token is missing)
        const isProd = config.env.isProd || process.env.VERCEL === "1";
        res.cookie("csrfToken", req.session.csrfToken, {
          httpOnly: true,
          secure: isProd,
          sameSite: isProd ? "none" : "lax",
          maxAge: config.session.ttlMs,
          domain: config.session.cookieDomain || undefined,
          path: "/",
        });
        
        // Final response - only if headers not sent
        if (!res.headersSent) {
          return res.json({ csrfToken: req.session.csrfToken });
        }
      });
    } catch (error) {
      console.error("[CSRF-TOKEN] Unexpected error:", error);
      // Prevent double response if headers already sent (e.g., if save callback already responded)
      if (!res.headersSent) {
        return res.status(403).json({ error: "CSRF token generation failed" });
      }
    }
  });

  // Health check for proxy validation and uptime monitors
  app.get("/api/health", (_req: Request, res: Response) => {
    res.status(200).json({ ok: true });
  });

  app.post("/api/contact", async (req: Request, res: Response) => {
    try {
      const contactSchema = z.object({
        firstName: z.string().trim().min(1).max(100),
        lastName: z.string().trim().min(1).max(100),
        email: z.string().trim().email().max(254),
        message: z.string().trim().min(1).max(2000),
      });

      const parsed = contactSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: "Invalid contact form data" });
      }

      const { firstName, lastName, email, message } = parsed.data;
      const result = await smtpEmailService.sendTransactionalEmail(
        "contact@askdetectives.com",
        EMAIL_TEMPLATE_KEYS.CONTACT_FORM,
        { firstName, lastName, email, message }
      );

      if (!result.success) {
        return res.status(500).json({ error: "Failed to send message" });
      }

      return res.json({ success: true });
    } catch (error) {
      console.error("[Contact Form Error]", error instanceof Error ? error.message : String(error));
      return res.status(500).json({ error: "Internal server error" });
    }
  });

  // ============== AUTHENTICATION ROUTES ==============
  
  // Forgot password - generate reset token and send email (public)
  app.post("/api/auth/forgot-password", async (req: Request, res: Response) => {
    try {
      const { email } = req.body as { email: string };
      if (!email) return res.status(400).json({ error: "Email is required" });

      const user = await storage.getUserByEmail((email || "").toLowerCase().trim());

      // Always respond success to avoid user enumeration
      if (!user) {
        return res.json({ success: true });
      }

      const token = randomBytes(32).toString("hex");
      const tokenHash = createHash("sha256").update(token).digest("hex");
      const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

      await db.insert(passwordResetTokens).values({
        userId: user.id,
        tokenHash: tokenHash,
        expiresAt: expiresAt,
      }).returning();

      const resetLink = `${config.baseUrl || "http://localhost:5000"}/auth/reset-password?token=${token}`;

      smtpEmailService.sendTransactionalEmail(
        user.email,
        EMAIL_TEMPLATE_KEYS.PASSWORD_RESET,
        {
          userName: user.name,
          resetLink,
        }
      ).catch(e => console.error("[Email] Failed to send password reset email:", e));

      return res.json({ success: true });
    } catch (error) {
      console.error("[auth] Forgot password error:", error);
      return res.status(500).json({ error: "Failed to process request" });
    }
  });

  // Reset password - consume token and set new password
  app.post("/api/auth/reset-password", async (req: Request, res: Response) => {
    try {
      const { token, newPassword } = req.body as { token: string; newPassword: string };
      if (!token || !newPassword) return res.status(400).json({ error: "Token and newPassword are required" });
      if (newPassword.length < 8) return res.status(400).json({ error: "Password must be at least 8 characters" });

      const tokenHash = createHash("sha256").update(token).digest("hex");

      const rows = await db.select().from(passwordResetTokens).where(eq(passwordResetTokens.tokenHash, tokenHash)).limit(1);
      if (rows.length === 0) return res.status(400).json({ error: "Invalid or expired token" });

      const pr = rows[0] as any;
      if (pr.usedAt) return res.status(400).json({ error: "Token already used" });
      if (new Date(pr.expiresAt) < new Date()) return res.status(400).json({ error: "Token expired" });

      // Update user password
      await storage.setUserPassword(pr.userId, newPassword, false);

      // Mark token used
      await db.update(passwordResetTokens).set({ usedAt: new Date(), updatedAt: new Date() }).where(eq(passwordResetTokens.id, pr.id));

      return res.json({ success: true });
    } catch (error) {
      console.error("[auth] Reset password error:", error);
      return res.status(500).json({ error: "Failed to reset password" });
    }
  });
  
  // Register new user
  app.post("/api/auth/register", async (req: Request, res: Response) => {
    try {
      setNoStore(res);
      const validatedData = insertUserSchema.parse(req.body);
      
      // Check if user already exists
      const existingUser = await storage.getUserByEmail(validatedData.email);
      if (existingUser) {
        return res.status(400).json({ error: "Registration failed" });
      }

      const user = await storage.createUser(validatedData);

      // Session fixation prevention: regenerate session before setting auth data
      // Generate fresh CSRF token for new session (don't preserve old token)
      req.session.regenerate((err) => {
        if (err) {
          console.warn("[auth] Session error during registration");
          return res.status(500).json({ error: "Failed to register user" });
        }
        
        // ✅ Generate fresh CSRF token for new session (CSRF cache is cleared on frontend after registration)
        req.session.csrfToken = randomBytes(32).toString("hex");
        req.session.csrfTokenGeneratedAt = Date.now();
        
        req.session.userId = user.id;
        req.session.userRole = user.role;

        // Explicitly save session to ensure CSRF token is persisted
        req.session.save((saveErr) => {
          if (saveErr) {
            console.error("[auth] Failed to save session during registration", saveErr);
            return res.status(500).json({ error: "Failed to register user" });
          }

          // Send welcome email (non-blocking)
          smtpEmailService.sendTransactionalEmail(
            user.email,
            EMAIL_TEMPLATE_KEYS.WELCOME_USER,
            {
              userName: user.name,
              email: user.email,
              loginUrl: "https://askdetectives.com/login",
              supportEmail: "support@askdetectives.com",
            }
          ).catch(e => console.error("[Email] Failed to send welcome email:", e));

          const { password: _p, ...userWithoutPassword } = user;
          res.status(201).json({ user: userWithoutPassword });
        });
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: fromZodError(error).message });
      }
      console.warn("[auth] Registration failed");
      res.status(500).json({ error: "Failed to register user" });
    }
  });

  // Check email/phone uniqueness (public endpoint)
  app.get("/api/check-unique", async (req: Request, res: Response) => {
    try {
      const { email, phone } = req.query;
      let emailExists = false;
      let phoneExists = false;

      if (email) {
        const emailStr = String(email).toLowerCase().trim();
        const user = await storage.getUserByEmail(emailStr);
        emailExists = !!user;
        
        // Also check pending detective applications
        if (!emailExists) {
          const application = await storage.getDetectiveApplicationByEmail(emailStr);
          emailExists = !!application;
        }
      }

      if (phone) {
        const phoneStr = String(phone).trim();
        const detective = await db
          .select()
          .from(detectives)
          .where(eq(detectives.phone, phoneStr))
          .limit(1);
        phoneExists = detective.length > 0;
      }

      res.json({ emailExists, phoneExists });
    } catch (error) {
      console.error("[check-unique] Error:", error);
      res.status(500).json({ error: "Failed to check uniqueness" });
    }
  });

  // Dev endpoint removed - Trial Inactive plan cannot be auto-recreated

  // Login
  // SECURITY: Admin credentials must NEVER be hardcoded. Admin access is DB-driven only.
  // Admin status is determined solely by user.role === "admin" from the database.
  app.post("/api/auth/login", async (req: Request, res: Response) => {
    try {
      setNoStore(res);
      let { email, password } = req.body as { email: string; password: string };
      email = (email || "").toLowerCase().trim();

      if (!email || !password) {
        return res.status(400).json({ error: "Email and password are required" });
      }

      // Only database-backed credentials are allowed

      let user = await storage.getUserByEmail(email);
      if (!user) {
        // Try detective contactEmail (case-insensitive) to find linked user
        const detectiveUser = await db
          .select({ user: users, detective: detectives })
          .from(users)
          .innerJoin(detectives, eq(detectives.userId, users.id))
          .where(ilike(detectives.contactEmail, email))
          .limit(1);
        if (detectiveUser.length > 0) {
          user = detectiveUser[0].user;
          console.info("[auth] Login matched detective contactEmail", { email, userId: user.id, detectiveId: detectiveUser[0].detective.id });
        }
      }
      if (!user) {
        // Check pending detective application
        const application = await storage.getDetectiveApplicationByEmail(email);
        if (application) {
          const match = await bcrypt.compare(password, application.password);
          if (match) {
            return res.json({ applicant: { email: application.email, status: application.status } });
          }
        }
        console.warn("[auth] Login failed: email not found", { email });
        return res.status(401).json({ error: "Invalid email or password" });
      }

      if (user.isActive === false) {
        console.warn("[auth] Login blocked: inactive account", { userId: user.id, email });
        return res.status(401).json({ error: "Invalid email or password" });
      }

      let validPassword = false;
      try {
        if (typeof user.password === "string" && user.password.startsWith("$2")) {
          validPassword = await bcrypt.compare(password, user.password);
        } else {
          // Legacy/plain password stored - compare directly
          validPassword = user.password === password;
          if (validPassword) {
            // Rehash and store securely
            await storage.setUserPassword(user.id, password, false);
            console.info("[auth] Legacy password upgraded to bcrypt", { userId: user.id, email });
          }
        }
      } catch (_e) {
        console.warn("[auth] Login failed: password compare error", { email });
        return res.status(401).json({ error: "Invalid email or password" });
      }
      if (!validPassword) {
        console.warn("[auth] Login failed: password mismatch", { email, userId: user.id });
        return res.status(401).json({ error: "Invalid email or password" });
      }

      // Log detective status for troubleshooting (do not block login)
      try {
        const detective = await storage.getDetectiveByUserId(user.id);
        if (detective) {
          console.info("[auth] Detective login", { userId: user.id, email, status: detective.status, isClaimed: detective.isClaimed });
        }
      } catch (e) {
        console.warn("[auth] Detective lookup failed", { userId: user.id, email });
      }

      // Session fixation prevention: regenerate session before setting auth data
      // Generate fresh CSRF token for new session (don't preserve old token)
      
      if (!user.id) {
        console.error("[auth] User object missing id after validation", { email });
        return res.status(500).json({ error: "Failed to log in" });
      }
      
      req.session.regenerate((err) => {
        if (err) {
          console.error("[auth] Session regenerate error during login", { userId: user.id, email, err: err?.message });
          return res.status(500).json({ error: "Failed to log in" });
        }
        
        // ✅ Generate fresh CSRF token for new session (CSRF cache is cleared on frontend after login)
        req.session.csrfToken = randomBytes(32).toString("hex");
        req.session.csrfTokenGeneratedAt = Date.now();
        
        req.session.userId = user.id;
        req.session.userRole = user.role;

        // Explicitly save session to ensure CSRF token and user data are persisted
        req.session.save((saveErr) => {
          if (saveErr) {
            console.error("[auth] Failed to save session during login", { userId: user.id, err: saveErr?.message });
            return res.status(500).json({ error: "Failed to log in" });
          }

          try {
            const { password: _p, ...userWithoutPassword } = user;
            console.info("[auth] Login successful", { userId: user.id, email, role: user.role });
            return res.json({ user: userWithoutPassword });
          } catch (resErr) {
            console.error("[auth] Error sending login response", { userId: user.id, err: (resErr instanceof Error ? resErr.message : String(resErr)) });
            return res.status(500).json({ error: "Failed to log in" });
          }
        });
      });
    } catch (_error) {
      console.error("[auth] Login failed with exception:", _error);
      res.status(500).json({ error: "Failed to log in" });
    }
  });

  // Google OAuth: redirect to Google
  app.get("/api/auth/google", (req: Request, res: Response) => {
    const { clientId } = config.google;
    const baseUrl = (config.baseUrl || "").replace(/\/$/, "");
    if (!clientId || !baseUrl) {
      return res.status(503).json({ error: "Google sign-in is not configured" });
    }
    const oauthState = randomBytes(32).toString("hex");
    req.session.oauthState = oauthState;
    req.session.oauthStateGeneratedAt = Date.now();

    const redirectUri = `${baseUrl}/api/auth/google/callback`;
    const scope = "openid email profile";
    const url = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${encodeURIComponent(clientId)}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=${encodeURIComponent(scope)}&state=${encodeURIComponent(oauthState)}`;
    req.session.save((err) => {
      if (err) {
        console.warn("[auth] Failed to persist OAuth state");
        return res.status(500).json({ error: "Failed to start Google sign-in" });
      }
      res.redirect(302, url);
    });
  });

  // Google OAuth: callback — exchange code, get user, create/link session, redirect
  app.get("/api/auth/google/callback", async (req: Request, res: Response) => {
    const { clientId, clientSecret } = config.google;
    const baseUrl = (config.baseUrl || "").replace(/\/$/, "");
    const redirectUri = `${baseUrl}/api/auth/google/callback`;
    const frontOrigin = baseUrl; // redirect to same origin after login
    if (!clientId || !clientSecret || !baseUrl) {
      return res.redirect(`${frontOrigin}/login?error=google_not_configured`);
    }

    const state = req.query.state as string | undefined;
    const sessionState = req.session.oauthState;
    const sessionStateGeneratedAt = req.session.oauthStateGeneratedAt;
    req.session.oauthState = undefined;
    req.session.oauthStateGeneratedAt = undefined;

    if (!state || !sessionState || state !== sessionState) {
      return res.redirect(`${frontOrigin}/login?error=google_state_invalid`);
    }

    if (
      sessionStateGeneratedAt &&
      Date.now() - sessionStateGeneratedAt > 10 * 60 * 1000
    ) {
      return res.redirect(`${frontOrigin}/login?error=google_state_expired`);
    }

    const code = req.query.code as string | undefined;
    if (!code) {
      return res.redirect(`${frontOrigin}/login?error=google_no_code`);
    }
    try {
      const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          code,
          client_id: clientId,
          client_secret: clientSecret,
          redirect_uri: redirectUri,
          grant_type: "authorization_code",
        }),
      });
      if (!tokenRes.ok) {
        console.warn("[auth] Google token exchange failed:", tokenRes.status);
        return res.redirect(`${frontOrigin}/login?error=google_token_failed`);
      }
      const tokens = (await tokenRes.json()) as { access_token?: string };
      const accessToken = tokens.access_token;
      if (!accessToken) {
        return res.redirect(`${frontOrigin}/login?error=google_no_token`);
      }
      const userInfoRes = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (!userInfoRes.ok) {
        console.warn("[auth] Google userinfo failed:", userInfoRes.status);
        return res.redirect(`${frontOrigin}/login?error=google_userinfo_failed`);
      }
      const profile = (await userInfoRes.json()) as { id: string; email?: string; name?: string; picture?: string };
      const googleId = profile.id;
      const email = (profile.email || "").toLowerCase().trim();
      const name = (profile.name || email.split("@")[0] || "User").trim();
      const avatar = profile.picture || null;
      if (!email) {
        return res.redirect(`${frontOrigin}/login?error=google_no_email`);
      }
      let user = await storage.getUserByGoogleId(googleId);
      if (!user) {
        const existingByEmail = await storage.getUserByEmail(email);
        if (existingByEmail) {
          user = await storage.setUserGoogleId(existingByEmail.id, googleId, avatar) ?? existingByEmail;
        } else {
          user = await storage.createUserWithGoogle({ googleId, email, name, avatar });
        }
      }
      if (!user) {
        return res.redirect(`${frontOrigin}/login?error=google_login_failed`);
      }
      if (user.isActive === false) {
        return res.redirect(`${frontOrigin}/login?error=account_disabled`);
      }
      req.session.regenerate((err) => {
        if (err) {
          console.warn("[auth] Session error during Google login");
          return res.redirect(`${frontOrigin}/login?error=session_failed`);
        }
        req.session.userId = user!.id;
        req.session.userRole = user!.role;
        res.redirect(302, frontOrigin + "/");
      });
    } catch (e) {
      console.warn("[auth] Google callback error:", e instanceof Error ? e.message : "Unknown error");
      res.redirect(`${frontOrigin}/login?error=google_login_failed`);
    }
  });

  // Change password (authenticated users)
  app.post("/api/auth/change-password", requireAuth, async (req: Request, res: Response) => {
    try {
      setNoStore(res);
      const { currentPassword, newPassword } = req.body as { currentPassword: string; newPassword: string };
      if (!currentPassword || !newPassword) {
        return res.status(400).json({ error: "Current and new password are required" });
      }
      if (newPassword.length < 8) {
        return res.status(400).json({ error: "New password must be at least 8 characters" });
      }

      const user = await storage.getUser(req.session.userId!);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }

      const validPassword = await bcrypt.compare(currentPassword, user.password);
      if (!validPassword) {
        return res.status(400).json({ error: "Current password is incorrect" });
      }

      await storage.setUserPassword(user.id, newPassword, false);
      
      // Rotate CSRF token after password change
      const newToken = rotateCsrfToken(req);
      await new Promise<void>((resolve, reject) => {
        req.session.save((err) => {
          if (err) reject(err);
          else resolve();
        });
      });
      
      res.json({ message: "Password updated successfully", newToken });
    } catch (_error) {
      console.warn("[auth] Change password failed");
      res.status(500).json({ error: "Failed to change password" });
    }
  });

  // ============== ADMIN ROUTES ==============

  // Admin: verify a user's password
  app.post("/api/admin/users/check-password", requireRole("admin"), async (req: Request, res: Response) => {
    try {
      const { email, password } = req.body as { email?: string; password?: string };
      if (!email || !password) return res.status(400).json({ error: "Email and password required" });
      const user = await storage.getUserByEmail(email.toLowerCase().trim());
      if (!user) return res.status(404).json({ error: "User not found" });
      const match = await bcrypt.compare(password, user.password);
      res.json({ match, userId: user.id, role: user.role, mustChangePassword: (user as any).mustChangePassword === true });
    } catch (_error) {
      console.warn("[auth] Admin check password failed");
      res.status(500).json({ error: "Failed to check password" });
    }
  });

  // Set password without current (requires mustChangePassword flag)
  app.post("/api/auth/set-password", requireAuth, async (req: Request, res: Response) => {
    try {
      setNoStore(res);
      const { newPassword } = req.body as { newPassword: string };
      if (!newPassword) {
        return res.status(400).json({ error: "New password is required" });
      }
      if (newPassword.length < 8) {
        return res.status(400).json({ error: "New password must be at least 8 characters" });
      }

      const user = await storage.getUser(req.session.userId!);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }

      if (!user.mustChangePassword) {
        return res.status(400).json({ error: "Password change not required" });
      }

      await storage.setUserPassword(user.id, newPassword, false);
      res.json({ message: "Password set successfully" });
    } catch (_error) {
      console.warn("[auth] Set password failed");
      res.status(500).json({ error: "Failed to set password" });
    }
  });

  // Logout
  app.post("/api/auth/logout", (req: Request, res: Response) => {
      setNoStore(res);
      req.session.destroy((err) => {
      if (err) {
        return res.status(500).json({ error: "Failed to log out" });
      }
      res.clearCookie("connect.sid", { path: "/", httpOnly: true, secure: config.session.secureCookies || !config.env.isDev, sameSite: "none", domain: config.env.isDev ? ".localhost" : undefined });
      res.json({ message: "Logged out successfully" });
    });
  });

  // Get current user (return null when unauthenticated)
  app.get("/api/auth/me", async (req: Request, res: Response) => {
    try {
      setNoStore(res);
      if (!req.session || !req.session.userId) {
        return res.json({ user: null });
      }
      // Only database-backed credentials are allowed
      const user = await storage.getUser(req.session.userId!);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }

      const { password, ...userWithoutPassword } = user;
      res.json({ user: userWithoutPassword });
    } catch (error) {
      console.error("Get user error:", error);
      res.status(500).json({ error: "Failed to get user" });
    }
  });

  // Dev-only session debug: confirms if session is saved and readable
  app.get("/api/auth/session-debug", (req: Request, res: Response) => {
    if (config.env.isProd) {
      return res.status(404).json({ error: "Not Found" });
    }
    setNoStore(res);
    const sessionId = (req.session as any)?.id || null;
    return res.json({
      hasSession: !!req.session,
      userId: req.session?.userId || null,
      userRole: req.session?.userRole || null,
      sessionId,
    });
  });

  // Alias for admin pages: same response shape as /api/auth/me (single source of truth)
  app.get("/api/user", requireAuth, async (req: Request, res: Response) => {
    try {
      setNoStore(res);
      const user = await storage.getUser(req.session.userId!);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }
      const { password, ...userWithoutPassword } = user;
      res.json({ user: userWithoutPassword });
    } catch (error) {
      console.error("Get user error:", error);
      res.status(500).json({ error: "Failed to get user" });
    }
  });

  // Employee allowed pages (admin sees all active pages)
  app.get("/api/employee/pages", requireAuth, async (req: Request, res: Response) => {
    try {
      setNoStore(res);
      const role = req.session.userRole;

      if (role === "admin") {
        const allPages = await pool.query(
          "SELECT id, key, name, is_active FROM access_pages WHERE is_active = true ORDER BY name ASC"
        );
        return res.status(200).json({
          pages: allPages.rows.map((row) => ({
            id: row.id,
            key: row.key,
            name: row.name,
            is_active: row.is_active,
          })),
        });
      }

      if (role !== "employee") {
        return res.status(403).json({ error: "Forbidden - Insufficient permissions" });
      }

      const result = await pool.query(
        `SELECT p.id, p.key, p.name, p.is_active
         FROM user_pages up
         JOIN access_pages p ON p.id = up.page_id
         WHERE up.user_id = $1 AND p.is_active = true
         ORDER BY p.name ASC`,
        [req.session.userId]
      );

      return res.status(200).json({
        pages: result.rows.map((row) => ({
          id: row.id,
          key: row.key,
          name: row.name,
          is_active: row.is_active,
        })),
      });
    } catch (error) {
      console.error("[employee-pages] Error:", error);
      res.status(500).json({ error: "Failed to fetch employee pages" });
    }
  });

  // Employee access guard for admin APIs
  app.use("/api/admin", (_req, res, next) => {
    setNoStore(res);
    next();
  });

  app.use("/api/admin", requireAuth, async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (req.session.userRole === "admin") return next();

      if (req.session.userRole !== "employee") {
        return res.status(403).json({ error: "Forbidden - Insufficient permissions" });
      }

      const accessKey = getEmployeeAccessKeyFromAdminPath(req.path);
      if (!accessKey) {
        return res.status(403).json({ error: "Forbidden - Insufficient permissions" });
      }

      const allowed = await pool.query(
        `SELECT 1
         FROM user_pages up
         JOIN access_pages p ON p.id = up.page_id
         WHERE up.user_id = $1 AND p.key = $2 AND p.is_active = true
         LIMIT 1`,
        [req.session.userId, accessKey]
      );

      if (allowed.rows.length === 0) {
        return res.status(403).json({ error: "Forbidden - Insufficient permissions" });
      }

      // Flag this request so requireRole("admin") can allow employee access
      (req as any).employeeAdminAllowed = true;
      return next();
    } catch (error) {
      console.error("[admin-employee-guard] Error:", error);
      return res.status(500).json({ error: "Access check failed" });
    }
  });

  // Update user country/currency preferences
  app.patch("/api/users/preferences", requireAuth, async (req: Request, res: Response) => {
    try {
      setNoStore(res);
      const { preferredCountry, preferredCurrency } = req.body;

      if (!preferredCountry || !preferredCurrency) {
        return res.status(400).json({ error: "preferredCountry and preferredCurrency are required" });
      }

      // Update user preferences in database
      await db.update(users)
        .set({
          preferredCountry,
          preferredCurrency,
          updatedAt: new Date(),
        })
        .where(eq(users.id, req.session.userId!));

      res.json({ success: true, preferredCountry, preferredCurrency });
    } catch (error) {
      console.error("Update user preferences error:", error);
      res.status(500).json({ error: "Failed to update preferences" });
    }
  });

  // Admin: lookup user by email
  app.get("/api/admin/users", requireRole("admin"), async (req: Request, res: Response) => {
    try {
      const { email } = req.query as { email?: string };
      if (!email) return res.status(400).json({ error: "Email is required" });
      const user = await storage.getUserByEmail((email || "").toLowerCase().trim());
      if (!user) return res.status(404).json({ error: "User not found" });
      const { password, ...userWithoutPassword } = user;
      res.json({ user: userWithoutPassword });
    } catch (error) {
      console.error("Admin user lookup error:", error);
      res.status(500).json({ error: "Failed to lookup user" });
    }
  });

  // ============== CURRENCY & RATES ROUTES ==============

  // Cache for exchange rates
  interface RatesCache {
    rates: Record<string, number>;
    timestamp: number;
  }
  let ratesCache: RatesCache = {
    rates: {
      USD: 1,
      GBP: 0.79,
      INR: 83.5,
      CAD: 1.35,
      AUD: 1.52,
      EUR: 0.92,
    },
    timestamp: Date.now(),
  };
  const RATES_UPDATE_INTERVAL = 30 * 60 * 1000; // Update every 30 minutes
  const MIN_BASE_PRICE_INR = 1000; // Minimum base price in INR (applies to all countries)

  function convertCurrency(amount: number, from: string, to: string): number {
    if (from === to) return amount;
    const fromRate = from === "USD" ? 1 : ratesCache.rates[from];
    const toRate = to === "USD" ? 1 : ratesCache.rates[to];
    if (!fromRate || !toRate) return amount;
    const usd = amount / fromRate;
    return usd * toRate;
  }

  function getMinimumBasePriceForCountry(countryCode?: string) {
    const code = (countryCode || "US").toUpperCase();
    const currency = getCurrencyForCountry(code);
    const effectiveCurrency = getEffectiveCurrency(currency.currencyCode);
    const min = code === "IN"
      ? MIN_BASE_PRICE_INR
      : Math.ceil(convertCurrency(MIN_BASE_PRICE_INR, "INR", effectiveCurrency));
    const display = code === "IN"
      ? `₹${MIN_BASE_PRICE_INR}`
      : `${currency.currencySymbol || "$"}${min} (₹${MIN_BASE_PRICE_INR} equivalent)`;
    return { min, display };
  }

  // Helper function to fetch live rates from Frankfurter API (non-blocking)
  async function updateExchangeRatesInBackground() {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 8000); // 8 second timeout
      
      const response = await fetch("https://api.frankfurter.app/latest?base=USD&symbols=GBP,INR,CAD,AUD,EUR", {
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      
      if (response.ok) {
        const data = await response.json() as { rates: Record<string, number> };
        ratesCache = {
          rates: { USD: 1, ...data.rates },
          timestamp: Date.now(),
        };
        console.log("[currency] Updated exchange rates from Frankfurter API");
      }
    } catch (error) {
      console.warn("[currency] Background rate update failed, keeping cached rates:", error instanceof Error ? error.message : error);
    }
  }

  // Start background rate updates
  updateExchangeRatesInBackground();
  setInterval(updateExchangeRatesInBackground, RATES_UPDATE_INTERVAL);

  // Get live exchange rates endpoint (serves cached rates immediately)
  app.get("/api/currency-rates", (_req: Request, res: Response) => {
    res.set("Cache-Control", "public, max-age=3600").json({
      base: "USD",
      rates: ratesCache.rates,
      cached: true,
      cacheAge: Math.floor((Date.now() - ratesCache.timestamp) / 1000),
      lastUpdated: new Date(ratesCache.timestamp).toISOString(),
    });
  });

  // ============== 301 REDIRECT BRIDGE: Old UUID Profile URLs → New Slug URLs ==============
  // Redirect /p/:uuid to /detectives/{countrySlug}/{stateSlug}/{businessNameSlug}/
  app.get("/p/:detectiveId", async (req: Request, res: Response) => {
    try {
      const { detectiveId } = req.params;

      // Look up detective by UUID
      const detectiveRows = await db
        .select()
        .from(detectives)
        .where(eq(detectives.id, detectiveId))
        .limit(1);

      if (detectiveRows.length === 0) {
        return res.status(404).json({ error: "Detective not found" });
      }

      const detective = detectiveRows[0];

      // Helper function to generate URL-safe slugs
      const createSlug = (text: string): string => {
        return text
          .toLowerCase()
          .trim()
          .replace(/[^a-z0-9\s-]/g, "")
          .replace(/\s+/g, "-")
          .replace(/-+/g, "-")
          .replace(/^-+|-+$/g, "");
      };

      // Convert country code (e.g., "IN" → "india") to slug format
      const countryCodeMap: Record<string, string> = {
        IN: "india",
        US: "united-states",
        GB: "united-kingdom",
        CA: "canada",
        AU: "australia",
        NZ: "new-zealand",
        SG: "singapore",
        AE: "united-arab-emirates",
      };

      const countrySlug = countryCodeMap[detective.country?.toUpperCase() || ""] || createSlug(detective.country || "");
      const stateSlug = detective.state ? createSlug(detective.state) : "";
      const citySlug = detective.city ? createSlug(detective.city) : "";
      const businessSlug = detective.slug || createSlug(`${detective.businessName || "detective"} ${detective.city || ""}`);

      // Build new canonical URL with slug: /detectives/{country}/{state}/{city}/{business-slug}/
      const newUrl = `/detectives/${countrySlug}/${stateSlug}/${citySlug}/${businessSlug}/`;

      console.log(`[✅ SEO 301-redirect] /p/${detectiveId} → ${newUrl}`);
      return res.redirect(301, newUrl);
    } catch (error) {
      console.error("[❌ SEO 301-redirect Error] Failed to redirect:", error);
      res.status(404).json({ error: "Detective not found" });
    }
  });

  // ============== DETECTIVE ROUTES ==============

  // Get all detectives (public)
  app.get("/api/detectives", async (req: Request, res: Response) => {
    try {
      const requestStart = Date.now();
      let cacheStatus: "HIT" | "MISS" = "MISS";
      const { country, status, plan, search } = req.query;
      const policyLimit = await requirePolicy<{ value: number }>("pagination_default_limit");
      const policyOffset = await requirePolicy<{ value: number }>("pagination_default_offset");
      const limit = String((req.query as any).limit ?? policyLimit?.value ?? 20);
      const offset = String((req.query as any).offset ?? policyOffset?.value ?? 0);
      
      // ✅ CACHE KEY: Include all filter parameters + pagination for uniqueness
      // Format: detectives:{country}:{status}:{plan}:{search}:{limit}:{offset}
      const normalizedSearch = (search || "").toString().toLowerCase().trim();
      const normalizedCountry = (country || "").toString().toLowerCase().trim();
      const normalizedStatus = (status || "").toString().toLowerCase().trim();
      const normalizedPlan = (plan || "").toString().toLowerCase().trim();
      const cacheKey = `detectives:${normalizedCountry}:${normalizedStatus}:${normalizedPlan}:${normalizedSearch}:${limit}:${offset}`;
      
      // ✅ CHECK CACHE FIRST (60-second TTL)
      try {
        const cached = cache.get<{ detectives: any[]; total: number }>(cacheKey);
        if (cached != null && cached.detectives != null && cached.total != null) {
          cacheStatus = "HIT";
          console.debug("[cache HIT]", cacheKey);
          console.info("[api /api/detectives]", {
            durationMs: Date.now() - requestStart,
            cacheStatus,
            cacheKey,
          });
          res.set("Cache-Control", "public, max-age=60");
          return res.json(cached);
        }
      } catch (_) {
        // Cache failure must not break the request
      }
      console.debug("[cache MISS]", cacheKey);
      
      if (typeof search === 'string' && search.trim()) {
        await storage.recordSearch(search as string);
      }

      // Use ranking system for detective visibility and ordering
      const { getRankedDetectives } = await import("./ranking.js");
      const statusValue = status && status !== "all" ? (status as string) : undefined;
      const limitNum = parseInt(limit);
      const offsetNum = parseInt(offset);
      
      const result = await getRankedDetectives({
        country: country as string,
        status: statusValue, // Only filter if status is specific (not "all")
        plan: plan as string,
        searchQuery: search as string,
        limit: limitNum,
        offset: offsetNum,
      });

      // ✅ getRankedDetectives returns { detectives, total }
      // All filtering is done in SQL inside getRankedDetectives
      const { detectives, total } = typeof result === 'object' && 'detectives' in result
        ? result
        : { detectives: Array.isArray(result) ? result : [], total: Array.isArray(result) ? result.length : 0 };

      const listDetectives: DetectiveListDTO[] = detectives.map((d: any) => {
        const rawBio = typeof d.bio === "string" ? d.bio.trim() : "";
        const shortBio = rawBio.length > 150 ? rawBio.slice(0, 150) : rawBio;
        return {
          id: String(d.id ?? ""),
          businessName: d.businessName ?? null,
          slug: d.slug ?? null,
          logo: d.logo ?? null,
          city: d.city ?? null,
          state: d.state ?? null,
          country: d.country ?? null,
          level: d.level ?? null,
          hasBlueTick: Boolean(d.hasBlueTick),
          avgRating: Number(d.avgRating ?? 0),
          reviewCount: Number(d.reviewCount ?? 0),
          shortBio,
          visibilityScore: typeof d.visibilityScore === "number" ? d.visibilityScore : Number(d.visibilityScore ?? 0),
        };
      });

      const payload = { detectives: listDetectives, total };
      
      // ✅ STORE IN CACHE (60-second TTL)
      try {
        cache.set(cacheKey, payload, 60);
        console.debug("[cache SET]", cacheKey, `ttl: 60s (${payload.detectives.length} detectives)`);
      } catch (_) {
        // Cache failure must not break the request
      }

      // Set cache header to allow 60-second client-side caching (aligns with server TTL)
      res.set("Cache-Control", "public, max-age=60");
      console.info("[api /api/detectives]", {
        durationMs: Date.now() - requestStart,
        cacheStatus,
        cacheKey,
      });
      res.json(payload);
    } catch (error) {
      console.error("Get detectives error:", error);
      if (config.env.isProd) {
        res.status(500).json({ error: "Failed to get detectives" });
      } else {
        const total = await storage.countDetectives().catch(() => 0);
        res.json({ detectives: [], total });
      }
    }
  });

  // Payment routes have been moved to server/routes/paymentRoutes.ts
  // Includes: /api/subscription-limits, /api/subscription-plans and all variants

  app.get("/api/admin/db-check", requireRole("admin"), async (_req: Request, res: Response) => {
    try {
      // OPTIMIZED: Single database query instead of 5 sequential COUNT queries
      const counts = await storage.getAllCounts();
      res.json(counts);
    } catch (error) {
      console.error("DB check error:", error);
      res.status(500).json({ error: "DB check failed" });
    }
  });

  // Admin Location SEO routes have been moved to server/routes/locationRoutes.ts
  // Includes:
  // - /api/admin/location-seo/countries
  // - /api/admin/location-seo/states
  // - /api/admin/location-seo/cities
  // - /api/admin/location-seo/override
  // - /api/admin/debug/countries-check (debug utility)

  // OPTIMIZED: Admin Dashboard Summary - single query with conditional aggregation
  // Returns only summary statistics (no full records, <100ms execution target)
  app.get("/api/admin/dashboard/summary", requireRole("admin"), async (_req: Request, res: Response) => {
    try {
      setNoStore(res);
      const summary = await storage.getAdminDashboardSummary();
      res.json(summary);
    } catch (error) {
      console.error("Admin dashboard summary error:", error);
      res.status(500).json({ error: "Failed to get dashboard summary" });
    }
  });

  app.get("/api/admin/detectives/raw", requireRole("admin"), async (req: Request, res: Response) => {
    try {
      // OPTIMIZED: Support pagination parameters with safe limits
      const limit = Math.min(Math.max(1, parseInt(String(req.query.limit) || "50")), 100); // Default 50, max 100
      const offset = Math.max(0, parseInt(String(req.query.offset) || "0"));
      
      const detectives = await storage.getAllDetectives(limit, offset);
      res.json({ detectives });
    } catch (error) {
      console.error("Admin detectives raw error:", error);
      res.status(500).json({ error: "Failed to get detectives" });
    }
  });

  app.get("/api/admin/env", requireRole("admin"), async (_req: Request, res: Response) => {
    try {
      const url = process.env.DATABASE_URL || "";
      const parsed = (() => {
        try {
          const u = new URL(url);
          return {
            protocol: u.protocol.replace(":", ""),
            host: u.hostname,
            port: u.port,
            database: u.pathname.replace("/", ""),
            hasPassword: !!u.password,
            hasUser: !!u.username,
          };
        } catch {
          return null;
        }
      })();
      res.json({ databaseUrlPresent: !!url, parsed });
    } catch (error) {
      res.status(500).json({ error: "Env check failed" });
    }
  });

  // App secrets (auth, Google OAuth, etc.) - stored in DB, never in git
  // Infrastructure secrets that must NEVER be exposed or editable via UI
  const INFRASTRUCTURE_SECRETS = [
    "DATABASE_URL",
    "supabase_url",
    "supabase_service_role_key",
  ];

  const SECRET_KEYS = [
    "host", "google_client_id", "google_client_secret", "session_secret", "base_url",
    // Supabase credentials removed - must be set via environment variables only
    "smtp_host", "smtp_port", "smtp_secure", "smtp_user", "smtp_pass", "smtp_from_email",
    "razorpay_key_id", "razorpay_key_secret", "paypal_client_id", "paypal_client_secret", "paypal_mode",
    "gemini_api_key", "deepseek_api_key",
  ];
  const maskValue = (v: string) => (v && v.length > 4 ? v.slice(0, 2) + "****" + v.slice(-2) : "****");

  app.get("/api/admin/app-secrets", requireRole("admin"), async (_req: Request, res: Response) => {
    try {
      const rows = await db.select().from(appSecrets);
      // Filter out infrastructure secrets - they must never be exposed via API
      const byKey = Object.fromEntries(
        rows
          .filter(r => !INFRASTRUCTURE_SECRETS.includes(r.key))
          .map(r => [r.key, r])
      );
      const secrets = SECRET_KEYS.map(key => ({
        key,
        value: byKey[key]?.value ? maskValue(byKey[key].value) : "",
        hasValue: !!(byKey[key]?.value),
      }));
      res.json({ secrets });
    } catch (error) {
      console.error("Error fetching app secrets:", error);
      res.status(500).json({ error: "Failed to fetch app secrets" });
    }
  });

  app.put("/api/admin/app-secrets/:key", requireRole("admin"), async (req: Request, res: Response) => {
    try {
      const key = req.params.key;
      // Explicitly reject infrastructure secrets
      if (INFRASTRUCTURE_SECRETS.includes(key)) {
        return res.status(403).json({ error: "Infrastructure secrets cannot be modified via API. Use environment variables." });
      }
      if (!SECRET_KEYS.includes(key)) {
        return res.status(400).json({ error: `Invalid key. Allowed: ${SECRET_KEYS.join(", ")}` });
      }
      const { value } = req.body as { value?: string };
      if (typeof value !== "string") {
        return res.status(400).json({ error: "Body must have value: string" });
      }
      await db.insert(appSecrets).values({
        key,
        value: value.trim(),
        updatedAt: new Date(),
      }).onConflictDoUpdate({
        target: appSecrets.key,
        set: { value: value.trim(), updatedAt: new Date() },
      });
      res.json({ success: true, key, message: "Secret updated. Restart server to apply." });
    } catch (error) {
      console.error("Error updating app secret:", error);
      res.status(500).json({ error: "Failed to update app secret" });
    }
  });

  app.get("/api/subscription-plans", async (req: Request, res: Response) => {
    try {
      const includeInactive = (req.query.all === '1' || req.query.includeInactive === '1' || req.query.activeOnly === '0');
      const plans = await storage.getAllSubscriptionPlans(!includeInactive);
      res.set("Cache-Control", "no-store"); // Admin/list must always reflect current DB (subscription_plans table)
      res.json({ plans, total: plans.length });
    } catch {
      res.set("Cache-Control", "no-store");
      res.json({ plans: [], total: 0 });
    }
  });

  // Get single subscription plan by ID
  app.get("/api/subscription-plans/:id", async (req: Request, res: Response) => {
    console.log("🔍 [GET subscription-plans/:id] Request received");
    console.log("🔍 [GET subscription-plans/:id] ID:", req.params.id);
    try {
      const plan = await storage.getSubscriptionPlanById(req.params.id);
      console.log("🔍 [GET subscription-plans/:id] Plan found:", !!plan);
      if (!plan) {
        return res.status(404).json({ error: "Subscription plan not found" });
      }
      res.set("Cache-Control", "no-store");
      res.json({ plan });
    } catch (error) {
      console.error("❌ [GET subscription-plans/:id] Error:", error);
      res.status(500).json({ error: "Failed to fetch subscription plan" });
    }
  });

  // ============== PAYMENT (RAZORPAY) ROUTES ==============

  // Upgrade to free or paid plan (price === 0 goes directly, price > 0 requires payment)
  app.post("/api/payments/upgrade-plan", requireRole("detective"), async (req: Request, res: Response) => {
    res.setHeader('Content-Type', 'application/json');
    
    try {
      const detective = await storage.getDetectiveByUserId(req.session.userId!);
      if (!detective) {
        console.error("[upgrade-plan] Detective not found");
        return res.status(400).json({ error: "Detective profile not found" });
      }

      // Validate request body
      const { packageId, billingCycle } = z.object({ 
        packageId: z.string().min(1, "Package ID is required"),
        billingCycle: z.enum(["monthly", "yearly"], { errorMap: () => ({ message: "Billing cycle must be 'monthly' or 'yearly'" }) })
      }).parse(req.body);
      
      console.log(`[upgrade-plan] Fetching package ID: ${packageId}`);
      
      // Fetch package from database
      const packageRecord = await storage.getSubscriptionPlanById(packageId);
      if (!packageRecord) {
        console.error(`[upgrade-plan] Package not found: ${packageId}`);
        return res.status(400).json({ error: "Package not found" });
      }
      
      // Validate package is active
      if (packageRecord.isActive === false) {
        console.error(`[upgrade-plan] Package is inactive: ${packageId}`);
        return res.status(400).json({ error: "Package is not active" });
      }

      const price = billingCycle === "yearly" 
        ? parseFloat(String(packageRecord.yearlyPrice ?? 0))
        : parseFloat(String(packageRecord.monthlyPrice ?? 0));

      // FREE PLAN HANDLING: Price === 0 → Direct activation
      if (price === 0) {
        console.log(`[upgrade-plan] FREE plan detected (price=${price}), activating directly`);
        
        await storage.updateDetectiveAdmin(detective.id, {
          subscriptionPackageId: packageId,
          billingCycle: billingCycle,
          subscriptionActivatedAt: new Date(),
          subscriptionExpiresAt: null,
          pendingPackageId: null,
          pendingBillingCycle: null,
        } as any);

        const updatedDetective = await storage.getDetective(detective.id);
        console.log(`[upgrade-plan] Detective upgraded to FREE plan ${packageId}`);
        
        return res.json({ 
          success: true, 
          packageId: packageId,
          billingCycle: billingCycle,
          isFree: true,
          detective: updatedDetective
        });
      }

      // PAID PLAN HANDLING: Requires payment gateway
      console.log(`[upgrade-plan] PAID plan detected (price=${price}), returning order creation instructions`);
      return res.status(400).json({ 
        error: "Paid plans must use /api/payments/create-order endpoint",
        message: "Use the standard payment flow for paid subscriptions"
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        console.error("[upgrade-plan] Validation error:", fromZodError(error).message);
        return res.status(400).json({ error: fromZodError(error).message });
      }
      console.error("[upgrade-plan] Unexpected error:", error);
      res.status(500).json({ error: error instanceof Error ? error.message : "Failed to upgrade plan" });
    }
  });

  // Schedule a downgrade to apply after current package expires
  app.post("/api/payments/schedule-downgrade", requireRole("detective"), async (req: Request, res: Response) => {
    res.setHeader('Content-Type', 'application/json');
    
    try {
      const detective = await storage.getDetectiveByUserId(req.session.userId!);
      if (!detective) {
        return res.status(400).json({ error: "Detective profile not found" });
      }

      // Validate request body
      const { packageId, billingCycle } = z.object({ 
        packageId: z.string().min(1, "Package ID is required"),
        billingCycle: z.enum(["monthly", "yearly"])
      }).parse(req.body);
      
      // Fetch current and new packages
      const currentPackage = detective.subscriptionPackageId 
        ? await storage.getSubscriptionPlanById(detective.subscriptionPackageId)
        : null;
      const newPackage = await storage.getSubscriptionPlanById(packageId);
      
      if (!newPackage) {
        return res.status(400).json({ error: "Package not found" });
      }
      
      if (newPackage.isActive === false) {
        return res.status(400).json({ error: "Package is not active" });
      }

      // Check if this is actually a downgrade
      const currentPrice = currentPackage 
        ? (billingCycle === "yearly" ? parseFloat(String(currentPackage.yearlyPrice ?? 0)) : parseFloat(String(currentPackage.monthlyPrice ?? 0)))
        : 0;
      const newPrice = billingCycle === "yearly" 
        ? parseFloat(String(newPackage.yearlyPrice ?? 0))
        : parseFloat(String(newPackage.monthlyPrice ?? 0));

      console.log(`[schedule-downgrade] Detective ${detective.id}: ${currentPrice} -> ${newPrice}`);

      // Calculate expiry date based on current subscription
      let expiryDate = detective.subscriptionExpiresAt 
        ? new Date(detective.subscriptionExpiresAt)
        : calculateExpiryDate(detective.subscriptionActivatedAt, detective.billingCycle);

      if (!expiryDate) {
        // No active subscription, apply immediately
        const newExpiryDate = calculateExpiryDate(new Date(), billingCycle);
        await storage.updateDetectiveAdmin(detective.id, {
          subscriptionPackageId: packageId,
          billingCycle: billingCycle,
          subscriptionActivatedAt: new Date(),
          subscriptionExpiresAt: newExpiryDate,
          pendingPackageId: null,
          pendingBillingCycle: null,
        } as any);
        
        // Updated detective has been fetched (but variable not needed for response)
        await storage.getDetective(detective.id);
        return res.json({ 
          scheduled: false,
          applied: true,
          packageId,
          billingCycle,
          expiresAt: newExpiryDate
        });
      }

      // Schedule downgrade (store pending fields)
      await storage.updateDetectiveAdmin(detective.id, {
        pendingPackageId: packageId,
        pendingBillingCycle: billingCycle,
        subscriptionExpiresAt: expiryDate,
      } as any);

      console.log(`[schedule-downgrade] Scheduled downgrade for detective ${detective.id} at ${expiryDate}`);
      
      return res.json({ 
        scheduled: true,
        effectiveAt: expiryDate,
        packageId,
        billingCycle
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        console.error("[schedule-downgrade] Validation error:", fromZodError(error).message);
        return res.status(400).json({ error: fromZodError(error).message });
      }
      console.error("[schedule-downgrade] Unexpected error:", error);
      res.status(500).json({ error: error instanceof Error ? error.message : "Failed to schedule downgrade" });
    }
  });

  // ============== PAYMENT (RAZORPAY) ROUTES ==============

  app.post("/api/payments/create-order", requireRole("detective"), async (req: Request, res: Response) => {
    try {
      const gateway = await getPaymentGateway('razorpay');
      if (!gateway) {
        console.error("[create-order] Razorpay not configured or not enabled");
        return res.status(500).json({ error: "Payments not configured" });
      }

      // Reject requests with old field names
      if (req.body.plan || req.body.subscriptionPlan) {
        console.error("[create-order] Rejected: Request contains deprecated field (plan or subscriptionPlan)");
        return res.status(400).json({ error: "Invalid request. Use packageId and billingCycle instead." });
      }

      const detective = await storage.getDetectiveByUserId(req.session.userId!);
      if (!detective) {
        console.error("[create-order] Detective not found");
        return res.status(400).json({ error: "Detective profile not found" });
      }

      // Validate request body
      const parsed = z.object({ 
        packageId: z.string().min(1, "Package ID is required"),
        billingCycle: z.enum(["monthly", "yearly"], { errorMap: () => ({ message: "Billing cycle must be 'monthly' or 'yearly'" }) })
      }).parse(req.body);
      
      const packageId: string = parsed.packageId;
      const billingCycle: "monthly" | "yearly" = parsed.billingCycle;
      
      console.log(`[create-order] Fetching package ID: ${packageId}, billing: ${billingCycle}`);
      
      // Fetch package from database
      const packageRecord = await storage.getSubscriptionPlanById(packageId);
      if (!packageRecord) {
        console.error(`[create-order] Package not found: ${packageId}`);
        return res.status(400).json({ error: "Package not found" });
      }
      
      // Validate package is active
      if (packageRecord.isActive === false) {
        console.error(`[create-order] Package is inactive: ${packageId}`);
        return res.status(400).json({ error: "Package is not active" });
      }

      // Select price based on billing cycle (prices are in USD)
      const priceUSDString = billingCycle === "monthly" ? packageRecord.monthlyPrice : packageRecord.yearlyPrice;
      const priceUSD = Number(priceUSDString || 0);
      
      // Validate price
      if (!priceUSD || Number.isNaN(priceUSD) || priceUSD <= 0) {
        console.error(`[create-order] Invalid ${billingCycle} price for package ${packageId}: ${priceUSDString}`);
        return res.status(400).json({ error: `Package has no valid ${billingCycle} price` });
      }

      // Fetch live exchange rate USD to INR
      let exchangeRate = 83.5; // Fallback rate
      try {
        const rateResponse = await fetch('https://api.frankfurter.app/latest?from=USD&to=INR');
        const rateData = await rateResponse.json();
        if (rateData.rates?.INR) {
          exchangeRate = rateData.rates.INR;
        }
      } catch (error) {
        console.warn('[create-order] Failed to fetch live rate, using fallback 83.5');
      }

      // Convert USD to INR
      const priceINR = priceUSD * exchangeRate;
      const amountPaise = Math.round(priceINR * 100);
      
      console.log(`[create-order] Creating Razorpay order for $${priceUSD} USD = ₹${priceINR.toFixed(2)} INR (${amountPaise} paise) - ${billingCycle} - Rate: ${exchangeRate}`);
      
      // Get Razorpay client from database config
      const rzpClient = await getRazorpayClient();
      
      // Create Razorpay order (receipt max 40 chars)
      const orderResult = await rzpClient.orders.create({
        amount: amountPaise,
        currency: "INR",
        receipt: `sub_${Date.now()}`.substring(0, 40),
        notes: { 
          packageId, 
          packageName: packageRecord.name,
          billingCycle,
          detectiveId: detective.id, 
          userId: req.session.userId!
        },
      });
      
      const order = orderResult as unknown as { id: string };
      console.log(`[create-order] Razorpay order created: ${order.id}`);

      // Save payment order to database
      await storage.createPaymentOrder({
        userId: req.session.userId!,
        detectiveId: detective.id,
        plan: packageRecord.name as any,
        packageId: packageId,
        billingCycle: billingCycle as unknown as string,
        amount: String(priceINR.toFixed(2)),
        currency: "INR",
        provider: "razorpay",
        razorpayOrderId: order.id,
        status: "created",
      } as any);

      console.log(`[create-order] Payment order saved to DB - USD: $${priceUSD}, INR: ₹${priceINR.toFixed(2)}, billing cycle: ${billingCycle}`);
      
      // Return response with key from database
      res.json({ 
        orderId: order.id, 
        amount: amountPaise,
        key: gateway.config.keyId || config.razorpay.keyId 
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        console.error("[create-order] Validation error:", fromZodError(error).message);
        return res.status(400).json({ error: fromZodError(error).message });
      }
      console.error("[create-order] Unexpected error:", error);
      res.status(500).json({ error: error instanceof Error ? error.message : "Failed to create payment order" });
    }
  });

  app.post("/api/payments/verify", requireRole("detective"), async (req: Request, res: Response) => {
    console.log("[verify] === PAYMENT VERIFICATION START ===");
    try {
      const gateway = await getPaymentGateway('razorpay');
      if (!gateway) {
        console.error("[verify] Razorpay not configured or not enabled");
        return res.status(500).json({ error: "Payments not configured" });
      }

      // Validate request body
      const body = z.object({
        razorpay_payment_id: z.string().min(1, "Payment ID is required"),
        razorpay_order_id: z.string().min(1, "Order ID is required"),
        razorpay_signature: z.string().min(1, "Signature is required"),
      }).parse(req.body);

      console.log(`[verify] Verifying payment for order: ${body.razorpay_order_id}`);

      // Fetch payment order from database
      const paymentOrder = await storage.getPaymentOrderByRazorpayOrderId(body.razorpay_order_id);
      if (!paymentOrder) {
        console.error(`[verify] Payment order not found: ${body.razorpay_order_id}`);
        return res.status(404).json({ error: "Payment order not found" });
      }

      // Verify ownership
      if (paymentOrder.userId !== req.session.userId) {
        console.error("[verify] Forbidden: user does not own order");
        return res.status(403).json({ error: "Forbidden" });
      }

      // Verify Razorpay signature
      const expected = crypto
        .createHmac("sha256", gateway.config.keySecret || config.razorpay.keySecret)
        .update(`${body.razorpay_order_id}|${body.razorpay_payment_id}`)
        .digest("hex");

      if (expected !== body.razorpay_signature) {
        console.error(`[verify] Invalid signature for order ${body.razorpay_order_id}`);
        return res.status(400).json({ error: "Invalid signature" });
      }

      console.log(`[verify] Signature verified for order ${body.razorpay_order_id}`);

      // Read packageId and billingCycle from payment_order
      const packageId = (paymentOrder as any).packageId;
      const billingCycle = (paymentOrder as any).billingCycle;

      if (!packageId) {
        console.error(`[verify] Payment order missing packageId: ${body.razorpay_order_id}`);
        return res.status(400).json({ error: "Payment order missing package information" });
      }

      if (!billingCycle || (billingCycle !== "monthly" && billingCycle !== "yearly")) {
        console.error(`[verify] Invalid billing cycle in payment order: ${billingCycle}`);
        return res.status(400).json({ error: "Invalid billing cycle in payment order" });
      }

      // Idempotency: already processed — return success without re-running upgrade (prevents replay)
      const orderStatus = (paymentOrder as any).status;
      if (orderStatus === "paid") {
        console.log(`[verify] Order already paid (replay), returning success: ${body.razorpay_order_id}`);
        const updatedDetective = await storage.getDetective(paymentOrder.detectiveId);
        if (!updatedDetective) {
          console.error(`[verify] Could not fetch detective for idempotent response: ${paymentOrder.detectiveId}`);
          return res.status(500).json({ error: "Failed to fetch updated detective" });
        }
        return res.json({
          success: true,
          packageId: packageId,
          billingCycle: billingCycle,
          detective: updatedDetective,
        });
      }

      console.log(`[verify] Upgrading detective to package ${packageId} with ${billingCycle} billing`);

      // Mark payment order as paid
      await storage.markPaymentOrderPaid(paymentOrder.id, {
        paymentId: body.razorpay_payment_id,
        signature: body.razorpay_signature,
      });

      console.log(`[verify] Payment order marked as paid`);

      // SAFETY: Verify package exists and is active before upgrading
      const packageToActivate = await storage.getSubscriptionPlanById(packageId);
      if (!packageToActivate) {
        console.error(`[verify] CRITICAL: Package not found during activation: ${packageId}`);
        return res.status(400).json({ error: "Package no longer exists" });
      }
      if (packageToActivate.isActive === false) {
        console.error(`[verify] CRITICAL: Attempting to activate inactive package: ${packageId}`);
        return res.status(400).json({ error: "Package is no longer active" });
      }

      console.log(`[verify] Activating package ${packageId} for detective ${paymentOrder.detectiveId}`);

      const newExpiryDate = calculateExpiryDate(new Date(), billingCycle);

      // Update subscription (NON-ENTITLEMENT fields only)
      await storage.updateDetectiveAdmin(paymentOrder.detectiveId, {
        subscriptionPackageId: packageId,
        billingCycle: billingCycle,
        subscriptionActivatedAt: new Date(),
        subscriptionExpiresAt: newExpiryDate,
        // Note: subscriptionPlan and planActivatedAt are LEGACY fields - not updated during payment
      } as any);

      console.log(`[verify] Subscription activated for detective ${paymentOrder.detectiveId}`);

      // APPLY ENTITLEMENTS: Use centralized entitlement system
      // This function reads package.badges and applies/removes entitlements (Blue Tick, Pro, etc.)
      await applyPackageEntitlements(paymentOrder.detectiveId, 'activation');

      console.log(`[verify] Entitlements applied`);


      // Fetch updated detective to return to client
      const updatedDetective = await storage.getDetective(paymentOrder.detectiveId);
      
      if (!updatedDetective) {
        console.error(`[verify] Could not fetch updated detective: ${paymentOrder.detectiveId}`);
        return res.status(500).json({ error: "Failed to fetch updated detective" });
      }

      console.log(`[verify] Successfully updated detective: subscriptionPackageId=${updatedDetective.subscriptionPackageId}, billingCycle=${updatedDetective.billingCycle}, activatedAt=${updatedDetective.subscriptionActivatedAt}`);
      console.log("[verify] === PAYMENT VERIFICATION COMPLETE ===");
      // Rotate CSRF token after payment verification
      const newToken = rotateCsrfToken(req);
      await new Promise<void>((resolve, reject) => {
        req.session.save((err) => {
          if (err) reject(err);
          else resolve();
        });
      });
      

      // Send payment success email (non-blocking)
      const user = await storage.getUser(req.session.userId!);
      if (user && packageToActivate) {
        const expiryDate = calculateExpiryDate(new Date(), billingCycle);
        smtpEmailService.sendTransactionalEmail(
          user.email,
          EMAIL_TEMPLATE_KEYS.PAYMENT_SUCCESS,
          {
            detectiveName: updatedDetective.businessName || user.name,
            email: user.email,
            packageName: packageToActivate.name,
            billingCycle: billingCycle,
            amount: String(paymentOrder.amount || ""),
            currency: paymentOrder.currency || "INR",
            subscriptionExpiryDate: expiryDate ? new Date(expiryDate).toLocaleDateString() : "N/A",
            supportEmail: "support@askdetectives.com",
          }
        ).catch(err => console.error("[Email] Failed to send payment success email:", err));

        // Send admin notification (non-blocking)
        smtpEmailService.sendAdminEmail(
          EMAIL_TEMPLATE_KEYS.ADMIN_NEW_PAYMENT,
          {
            detectiveName: updatedDetective.businessName || user.name,
            email: user.email,
            packageName: packageToActivate.name,
            amount: String(paymentOrder.amount || ""),
            currency: paymentOrder.currency || "INR",
            supportEmail: "support@askdetectives.com",
          }
        ).catch(err => console.error("[Email] Failed to send admin payment notification:", err));
      }

      res.json({ 
        success: true, 
        packageId: packageId,
        billingCycle: billingCycle,
        detective: updatedDetective,
        newToken
      });
    } catch (error) {
      console.log("[verify] === PAYMENT VERIFICATION FAILED ===");
      if (error instanceof z.ZodError) {
        console.error("[verify] Validation error:", fromZodError(error).message);
        return res.status(400).json({ error: fromZodError(error).message });
      }
      console.error("[verify] Unexpected error:", error);
      res.status(500).json({ error: error instanceof Error ? error.message : "Verification failed" });
    }
  });

  // PayPal: Create order endpoint
  app.post("/api/payments/paypal/create-order", requireRole("detective"), async (req: Request, res: Response) => {
    try {
      const gateway = await getPaymentGateway('paypal');
      if (!gateway || !gateway.is_enabled) {
        console.error("[paypal-create-order] PayPal not configured or not enabled");
        return res.status(500).json({ error: "PayPal payments not configured" });
      }

      // Reject requests with old field names
      if (req.body.plan || req.body.subscriptionPlan) {
        console.error("[paypal-create-order] Rejected: Request contains deprecated field (plan or subscriptionPlan)");
        return res.status(400).json({ error: "Invalid request. Use packageId and billingCycle instead." });
      }

      const detective = await storage.getDetectiveByUserId(req.session.userId!);
      if (!detective) {
        console.error("[paypal-create-order] Detective not found");
        return res.status(400).json({ error: "Detective profile not found" });
      }

      // Validate request body
      const { packageId, billingCycle } = z.object({ 
        packageId: z.string().min(1, "Package ID is required"),
        billingCycle: z.enum(["monthly", "yearly"], { errorMap: () => ({ message: "Billing cycle must be 'monthly' or 'yearly'" }) })
      }).parse(req.body);
      
      console.log(`[paypal-create-order] Fetching package ID: ${packageId}, billing: ${billingCycle}`);
      
      // GUARD: Block duplicate Blue Tick purchases (HARD RULE) - check BEFORE fetching package
      if (packageId === 'blue-tick' || packageId === 'blue_tick_addon') {
        try {
          await assertBlueTickNotAlreadyActive(detective.id, 'paypal');
        } catch (guardError: any) {
          if (guardError.statusCode === 409) {
            console.warn(`[paypal-create-order] Duplicate Blue Tick attempt rejected:`, guardError.message);
            return res.status(409).json({ error: guardError.message });
          }
          throw guardError;
        }
      }
      
      // Fetch package from database
      const packageRecord = await storage.getSubscriptionPlanById(packageId);
      if (!packageRecord) {
        console.error(`[paypal-create-order] Package not found: ${packageId}`);
        return res.status(400).json({ error: "Package not found" });
      }
      
      // Validate package is active
      if (packageRecord.isActive === false) {
        console.error(`[paypal-create-order] Package is inactive: ${packageId}`);
        return res.status(400).json({ error: "Package is not active" });
      }

      // Select price based on billing cycle
      const priceString = billingCycle === "monthly" ? packageRecord.monthlyPrice : packageRecord.yearlyPrice;
      const amount = Number(priceString || 0);
      
      // Validate price
      if (!amount || Number.isNaN(amount) || amount <= 0) {
        console.error(`[paypal-create-order] Invalid ${billingCycle} price for package ${packageId}: ${priceString}`);
        return res.status(400).json({ error: `Package has no valid ${billingCycle} price` });
      }

      console.log(`[paypal-create-order] Creating PayPal order for $${amount} (${billingCycle} billing)`);
      
      // Create PayPal order
      const order = await createPayPalOrder({
        amount: Number(amount),
        currency: "USD", // PayPal uses USD by default
        packageId,
        packageName: packageRecord.name,
        billingCycle,
        detectiveId: detective.id,
        userId: req.session.userId!,
      });

      console.log(`[paypal-create-order] PayPal order created: ${order.id}`);

      // Save payment order to database
      await storage.createPaymentOrder({
        userId: req.session.userId!,
        detectiveId: detective.id,
        plan: packageRecord.name as any,
        packageId: packageId,
        billingCycle: billingCycle,
        amount: String(amount),
        currency: "USD",
        provider: "paypal",
        paypalOrderId: order.id, // Store PayPal order ID
        status: "created",
      } as any);

      console.log(`[paypal-create-order] Payment order saved to DB with billing cycle: ${billingCycle}`);
      
      // Return response with clientId from database
      res.json({ 
        orderId: order.id,
        clientId: gateway.config.clientId || config.paypal.clientId
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        console.error("[paypal-create-order] Validation error:", fromZodError(error).message);
        return res.status(400).json({ error: fromZodError(error).message });
      }
      console.error("[paypal-create-order] Unexpected error:", error);
      res.status(500).json({ error: error instanceof Error ? error.message : "Failed to create PayPal order" });
    }
  });

  // PayPal: Capture order endpoint
  app.post("/api/payments/paypal/capture", requireRole("detective"), async (req: Request, res: Response) => {
    console.log("[paypal-capture] === PAYPAL CAPTURE START ===");
    try {
      const gateway = await getPaymentGateway('paypal');
      if (!gateway || !gateway.is_enabled) {
        console.error("[paypal-capture] PayPal not configured or not enabled");
        return res.status(500).json({ error: "PayPal payments not configured" });
      }

      // Validate request body
      const body = z.object({
        paypalOrderId: z.string().min(1, "PayPal Order ID is required"),
      }).parse(req.body);

      console.log(`[paypal-capture] Capturing PayPal order: ${body.paypalOrderId}`);

      // Fetch payment order from database using paypalOrderId
      const paymentOrder = await storage.getPaymentOrderByPaypalOrderId(body.paypalOrderId);

      if (!paymentOrder) {
        console.error(`[paypal-capture] Payment order not found: ${body.paypalOrderId}`);
        return res.status(404).json({ error: "Payment order not found" });
      }

      // Verify ownership
      if (paymentOrder.userId !== req.session.userId) {
        console.error("[paypal-capture] Forbidden: user does not own order");
        return res.status(403).json({ error: "Forbidden" });
      }

      // Capture the PayPal order
      const captureResponse = await capturePayPalOrder(body.paypalOrderId);

      // Verify capture was successful
      if (!verifyPayPalCapture(captureResponse)) {
        console.error(`[paypal-capture] PayPal capture not completed: ${body.paypalOrderId}`);
        return res.status(400).json({ error: "Payment capture failed" });
      }

      console.log(`[paypal-capture] PayPal order captured: ${body.paypalOrderId}`);

      // Read packageId and billingCycle from payment_order
      const packageId = paymentOrder.packageId;
      const billingCycle = paymentOrder.billingCycle;

      if (!packageId) {
        console.error(`[paypal-capture] Payment order missing packageId: ${body.paypalOrderId}`);
        return res.status(400).json({ error: "Payment order missing package information" });
      }

      if (!billingCycle || (billingCycle !== "monthly" && billingCycle !== "yearly")) {
        console.error(`[paypal-capture] Invalid billing cycle in payment order: ${billingCycle}`);
        return res.status(400).json({ error: "Invalid billing cycle in payment order" });
      }

      console.log(`[paypal-capture] Upgrading detective to package ${packageId} with ${billingCycle} billing`);

      // Mark payment order as paid
      await storage.markPaymentOrderPaid(paymentOrder.id, {
        paymentId: captureResponse.id || body.paypalOrderId,
        transactionId: captureResponse.purchase_units?.[0]?.payments?.captures?.[0]?.id,
      });

      console.log(`[paypal-capture] Payment order marked as paid`);

      // GUARD: Block duplicate Blue Tick (check BEFORE any update)
      if (packageId === 'blue-tick' || packageId === 'blue_tick_addon') {
        try {
          await assertBlueTickNotAlreadyActive(paymentOrder.detectiveId, 'paypal');
        } catch (guardError: any) {
          if (guardError.statusCode === 409) {
            console.warn(`[paypal-capture] Duplicate Blue Tick attempt rejected:`, guardError.message);
            return res.status(409).json({ error: guardError.message });
          }
          throw guardError;
        }
      }

      // SAFETY: Verify package exists and is active before upgrading
      const packageToActivate = await storage.getSubscriptionPlanById(packageId);
      if (!packageToActivate) {
        console.error(`[paypal-capture] CRITICAL: Package not found during activation: ${packageId}`);
        return res.status(400).json({ error: "Package no longer exists" });
      }
      if (packageToActivate.isActive === false) {
        console.error(`[paypal-capture] CRITICAL: Attempting to activate inactive package: ${packageId}`);
        return res.status(400).json({ error: "Package is no longer active" });
      }

      console.log(`[paypal-capture] Activating package ${packageId} for detective ${paymentOrder.detectiveId}`);

      // Handle Blue Tick addon vs regular subscription
      if (packageId === 'blue-tick' || packageId === 'blue_tick_addon') {
        // Blue Tick add-on: set add-on flag only (subscription-granted Blue Tick stays in hasBlueTick via applyPackageEntitlements)
        await storage.updateDetectiveAdmin(paymentOrder.detectiveId, {
          blueTickAddon: true,
          blueTickActivatedAt: new Date(),
        } as any);
        
        console.log(`[paypal-capture] Blue Tick add-on activated for detective ${paymentOrder.detectiveId}`);
      } else {
        // Regular subscription: update subscription fields only
        await storage.updateDetectiveAdmin(paymentOrder.detectiveId, {
          subscriptionPackageId: packageId,
          billingCycle: billingCycle,
          subscriptionActivatedAt: new Date(),
          subscriptionExpiresAt: calculateExpiryDate(new Date(), billingCycle),
          // Note: subscriptionPlan and planActivatedAt are LEGACY fields - not updated during payment
        } as any);
        
        console.log(`[paypal-capture] Subscription activated for detective ${paymentOrder.detectiveId}`);

        // APPLY ENTITLEMENTS: Use centralized entitlement system
        // This function reads package.badges and applies/removes entitlements (Blue Tick, Pro, etc.)
        await applyPackageEntitlements(paymentOrder.detectiveId, 'activation');
        
        console.log(`[paypal-capture] Entitlements applied`);
      }

      // Fetch updated detective to return to client
      const updatedDetective = await storage.getDetective(paymentOrder.detectiveId);
      
      if (!updatedDetective) {
        console.error(`[paypal-capture] Could not fetch updated detective: ${paymentOrder.detectiveId}`);
        return res.status(500).json({ error: "Failed to fetch updated detective" });
      }

      console.log(`[paypal-capture] Successfully updated detective: subscriptionPackageId=${updatedDetective.subscriptionPackageId}, billingCycle=${updatedDetective.billingCycle}, activatedAt=${updatedDetective.subscriptionActivatedAt}`);
      console.log("[paypal-capture] === PAYPAL CAPTURE COMPLETE ===");
      // Rotate CSRF token after PayPal payment capture
      const newToken = rotateCsrfToken(req);
      await new Promise<void>((resolve, reject) => {
        req.session.save((err) => {
          if (err) reject(err);
          else resolve();
        });
      });
      

      // Send payment success email (non-blocking)
      const user = await storage.getUser(req.session.userId!);
      if (user && packageToActivate) {
        if (packageId === 'blue-tick' || packageId === 'blue_tick_addon') {
          // Send Blue Tick success email
          smtpEmailService.sendTransactionalEmail(
            user.email,
            EMAIL_TEMPLATE_KEYS.BLUE_TICK_PURCHASE_SUCCESS,
            {
              detectiveName: updatedDetective.businessName || user.name,
              email: user.email,
              supportEmail: "support@askdetectives.com",
            }
          ).catch(err => console.error("[Email] Failed to send Blue Tick success email:", err));
        } else {
          // Send regular subscription success email
          const expiryDate = calculateExpiryDate(new Date(), billingCycle);
          const paymentOrderFull = paymentOrder as any;
          smtpEmailService.sendTransactionalEmail(
            user.email,
            EMAIL_TEMPLATE_KEYS.PAYMENT_SUCCESS,
            {
              detectiveName: updatedDetective.businessName || user.name,
              email: user.email,
              packageName: packageToActivate.name,
              billingCycle: billingCycle,
              amount: String(paymentOrderFull.amount || ""),
              currency: paymentOrderFull.currency || "USD",
              subscriptionExpiryDate: expiryDate ? new Date(expiryDate).toLocaleDateString() : "N/A",
              supportEmail: "support@askdetectives.com",
            }
          ).catch(err => console.error("[Email] Failed to send payment success email:", err));

          // Send admin notification (non-blocking)
          smtpEmailService.sendAdminEmail(
            EMAIL_TEMPLATE_KEYS.ADMIN_NEW_PAYMENT,
            {
              detectiveName: updatedDetective.businessName || user.name,
              email: user.email,
              packageName: packageToActivate.name,
              amount: String(paymentOrderFull.amount || ""),
              currency: paymentOrderFull.currency || "USD",
              supportEmail: "support@askdetectives.com",
            }
          ).catch(err => console.error("[Email] Failed to send admin payment notification:", err));
        }
      }

      // Build response based on package type
      const response: any = { 
        success: true, 
        detective: updatedDetective,
        newToken
      };
      
      if (packageId === 'blue-tick' || packageId === 'blue_tick_addon') {
        response.hasBlueTick = true;
      } else {
        response.packageId = packageId;
        response.billingCycle = billingCycle;
      }
      
      res.json(response);
    } catch (error) {
      console.log("[paypal-capture] === PAYPAL CAPTURE FAILED ===");
      if (error instanceof z.ZodError) {
        console.error("[paypal-capture] Validation error:", fromZodError(error).message);
        return res.status(400).json({ error: fromZodError(error).message });
      }
      console.error("[paypal-capture] Unexpected error:", error);
      res.status(500).json({ error: error instanceof Error ? error.message : "Payment capture failed" });
    }
  });

  // Payment Gateway Routes (public endpoint for checking enabled gateways)
  app.use("/api/payment-gateways", paymentGatewayRoutes);

  // Location Routes - geographic hierarchy and top locations aggregation
  registerLocationRoutes(app);

  // Payment Routes - subscription plans, Razorpay, PayPal, Blue Tick, admin payment management
  // All payment-related endpoints are now registered via registerPaymentRoutes() function
  registerPaymentRoutes(app);

  // Public Pages Routes (read-only access to published pages)
  app.use("/api/public/pages", publicPagesRouter);
  app.use("/api/public/categories", publicCategoriesRouter);
  app.use("/api/public/tags", publicTagsRouter);

  // Sitemap Routes - dynamic generation from database with multiple XML files
  // Import the service functions
  const {
    generateSitemapIndex,
    generateStaticSitemap,
    generateCountriesSitemap,
    generateStatesSitemap,
    generateCitiesSitemap,
    generateDetectivesSitemap,
    generateServicesSitemap,
    getServiceSitemapCount,
    CACHE_MAX_AGE,
  } = await import("./services/sitemapService.js");
  const { gzipSync } = await import("zlib");

  // Helper to send XML with proper headers and compression
  const sendSitemap = async (
    res: Response,
    xmlGenerator: () => Promise<string>
  ) => {
    try {
      const xml = await xmlGenerator();
      const compressed = gzipSync(xml);

      res.header("Content-Type", "application/xml");
      res.header("Content-Encoding", "gzip");
      res.header("Cache-Control", `public, max-age=${CACHE_MAX_AGE}`);
      res.header(
        "ETag",
        `"${Buffer.from(xml).toString("base64").slice(0, 32)}"`
      );

      res.send(compressed);
      console.log(
        `[Sitemap] Served ${compressed.length} bytes (gzipped) for ${xml.length} bytes (uncompressed)`
      );
    } catch (error) {
      console.error("[Sitemap] Error generating sitemap:", error);
      res.status(500).json({ error: "Failed to generate sitemap" });
    }
  };

  // Main sitemap index - /sitemap.xml
  app.get(/\/sitemap\.xml$/, async (_req: Request, res: Response) => {
    console.log(`[Sitemap] Handling sitemap index request`);
    await sendSitemap(res, generateSitemapIndex);
  });

  // Static pages sitemap - /sitemap-static.xml
  app.get(/\/sitemap-static\.xml$/, async (_req: Request, res: Response) => {
    console.log(`[Sitemap] Serving static sitemap`);
    await sendSitemap(res, generateStaticSitemap);
  });

  // Countries sitemap - /sitemap-countries.xml
  app.get(/\/sitemap-countries\.xml$/, async (_req: Request, res: Response) => {
    console.log(`[Sitemap] Serving countries sitemap`);
    await sendSitemap(res, generateCountriesSitemap);
  });

  // States sitemap - /sitemap-states.xml
  app.get(/\/sitemap-states\.xml$/, async (_req: Request, res: Response) => {
    console.log(`[Sitemap] Serving states sitemap`);
    await sendSitemap(res, generateStatesSitemap);
  });

  // Cities sitemap - /sitemap-cities.xml
  app.get(/\/sitemap-cities\.xml$/, async (_req: Request, res: Response) => {
    console.log(`[Sitemap] Serving cities sitemap`);
    await sendSitemap(res, generateCitiesSitemap);
  });

  // Detectives sitemap - /sitemap-detectives.xml
  app.get(/\/sitemap-detectives\.xml$/, async (_req: Request, res: Response) => {
    console.log(`[Sitemap] Serving detectives sitemap`);
    await sendSitemap(res, generateDetectivesSitemap);
  });

  // Services sitemaps (paginated) - /sitemap-services-1.xml, /sitemap-services-2.xml, etc.
  app.get(/\/sitemap-services-(\d+)\.xml$/, async (req: Request, res: Response) => {
    const match = req.path.match(/\/sitemap-services-(\d+)\.xml$/);
    const page = match ? parseInt(match[1]) : 1;

    console.log(`[Sitemap] Serving services sitemap page ${page}`);

    if (page < 1 || page > 1000) {
      return res.status(400).json({ error: "Invalid page number" });
    }

    try {
      const totalPages = await getServiceSitemapCount();
      if (page > totalPages) {
        return res
          .status(404)
          .json({ error: `Page ${page} does not exist` });
      }

      await sendSitemap(res, () => generateServicesSitemap(page));
    } catch (error) {
      console.error("[Sitemap] Error with services page:", error);
      res.status(500).json({ error: "Failed to generate services sitemap" });
    }
  });

  // Status endpoint - /sitemap-status.json
  app.get(/\/sitemap-status\.json$/, async (_req: Request, res: Response) => {
    try {
      const r = await pool.query(`
        SELECT COUNT(*) as count FROM services s
        INNER JOIN detectives d ON s.detective_id = d.id
        WHERE s.is_active = true AND d.status = 'active'
      `);
      const totalServices = r.rows[0].count;
      const servicePages = Math.ceil(totalServices / 5000);

      res.json({
        status: "ok",
        cache: {
          maxAge: CACHE_MAX_AGE,
          maxAgeHours: Math.round(CACHE_MAX_AGE / 3600),
        },
        sitemaps: {
          index: "/sitemap.xml",
          static: "/sitemap-static.xml",
          countries: "/sitemap-countries.xml",
          states: "/sitemap-states.xml",
          cities: "/sitemap-cities.xml",
          detectives: "/sitemap-detectives.xml",
          services: `${servicePages} pages at /sitemap-services-:page.xml`,
        },
        stats: {
          totalServices,
          servicePages,
          totalSitemaps: 6 + servicePages,
        },
      });
    } catch (error) {
      console.error("[Sitemap] Error getting status:", error);
      res.status(500).json({ error: "Failed to get sitemap status" });
    }
  });

  // Keep the router mounted at /sitemap/ for backward compatibility if needed, but routes are handled above
  // app.use("/sitemap", sitemapRouter);

  // llms.txt - AI agent discovery guide
  app.use("/llms.txt", llmsTxtRouter);

  // Homepage Featured Services - Database-driven featured list
  app.get("/api/home/featured", async (req: Request, res: Response) => {
    try {
      const country = req.query.country
        ? String(req.query.country)
        : undefined;

      if (!country) {
        return res.status(400).json({ error: "country parameter is required" });
      }

      // Resolve country slug/name to country_id (FK-based filtering)
      let countryId: number | null = null;
      const countryLookup = await pool.query(
        `SELECT id FROM countries WHERE slug = $1 OR LOWER(name) = LOWER($2) OR code = $3 LIMIT 1`,
        [country.toLowerCase(), country, country.toUpperCase()]
      );
      if (countryLookup.rows.length > 0) {
        countryId = countryLookup.rows[0].id;
        console.log(`[HOME_FEATURED] Resolved country "${country}" to country_id=${countryId}`);
      } else {
        console.log(`[HOME_FEATURED] Country "${country}" not found in normalized table, will use text fallback`);
      }

      const countryParam = countryId || country.toUpperCase();

      const query = `
        SELECT s.*
        FROM homepage_featured_services h
        JOIN services s ON s.id = h.service_id
        WHERE h.country = $1
          AND s.is_active = true
        ORDER BY h.position ASC
        LIMIT 8;
      `;

      const result = await pool.query(query, [countryParam]);

      let finalResult = result.rows;

      // Fallback: If no results from homepage_featured_services, query services by country (FK-based only)
      if (finalResult.length === 0) {
        console.log(`[HOME_FEATURED] No results from homepage_featured_services for country=${country}, using FK-based fallback`);
        
        // Require country_id to be resolved - no text fallback
        if (!countryId) {
          console.log(`[HOME_FEATURED] Country "${country}" could not be resolved to country_id, returning empty results`);
          finalResult = [];
        } else {
          const fallbackQuery = `
            SELECT s.*
            FROM services s
            JOIN detectives d ON s.detective_id = d.id
            WHERE d.country_id = $1
              AND s.is_active = true
            ORDER BY s.view_count DESC
            LIMIT 8;
          `;

          const fallbackResult = await pool.query(fallbackQuery, [countryId]);
          finalResult = fallbackResult.rows;
          
          console.log(`[HOME_FEATURED] FK-based fallback returned ${finalResult.length} services for country_id=${countryId}`);
        }
      }

      res.setHeader(
        "Cache-Control",
        "public, s-maxage=14400, stale-while-revalidate=600"
      );

      return res.json({ services: finalResult });

    } catch (error) {
      console.error("[HOME_FEATURED] Error:", error);
      return res.status(500).json({ error: "Failed to fetch featured services" });
    }
  });

  // Featured home services (8 services, 1 per detective - optimized for home page loading)
  app.use("/api/services/featured/home", featuredHomeServicesRouter);

  // Admin Employee Routes
  app.use("/api/admin/employees", adminEmployeesRouter);

  // Admin CMS Routes - allow employees, access is enforced by admin guard
  app.use("/api/admin", requireRole("admin", "employee"), adminCmsRouter);

  // Admin Finance Routes
  app.use("/api/admin/finance", requireRole("admin", "employee"), adminFinanceRouter);

  // DEBUG Image Routes - Check image URLs and storage issues
  app.get("/api/debug/images/services", async (_req: Request, res: Response) => {
    try {
      const result = await db.select({
        id: services.id,
        title: services.title,
        images: services.images,
        detectiveId: services.detectiveId,
      })
        .from(services)
        .where(
          and(
            isNotNull(services.images),
            sql`array_length(${services.images}, 1) > 0`
          )
        )
        .limit(5);

      const servicesData = result.map(s => ({
        id: s.id,
        title: s.title,
        imageCount: Array.isArray(s.images) ? s.images.length : 0,
        images: Array.isArray(s.images) ? s.images.slice(0, 2) : [],
      }));

      return res.json({
        success: true,
        count: servicesData.length,
        services: servicesData,
      });
    } catch (error) {
      console.error("[DEBUG] Error fetching service images:", error);
      return res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  });

  app.get("/api/debug/images/detectives", async (_req: Request, res: Response) => {
    try {
      const result = await db.select({
        id: detectives.id,
        businessName: detectives.businessName,
        logo: detectives.logo,
      })
        .from(detectives)
        .where(isNotNull(detectives.logo))
        .limit(5);

      const detectivesData = result.map(d => ({
        id: d.id,
        businessName: d.businessName,
        logo: d.logo ? d.logo.substring(0, 100) : null,
        isSupabase: d.logo?.includes('.supabase.co') ?? false,
        isBase64: d.logo?.startsWith('data:') ?? false,
      }));

      return res.json({
        success: true,
        count: detectivesData.length,
        detectives: detectivesData,
      });
    } catch (error) {
      console.error("[DEBUG] Error fetching detective logos:", error);
      return res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  });

  // IMAGE PROXY - Fetch images from Supabase with timeout and error handling
  app.get("/api/proxy/image", async (req: Request, res: Response) => {
    try {
      const { url } = req.query;
      
      if (!url || typeof url !== 'string') {
        return res.status(400).json({ error: "URL parameter required" });
      }

      // Security: Only allow Supabase URLs
      if (!url.includes('.supabase.co')) {
        return res.status(403).json({ error: "Only Supabase URLs allowed" });
      }

      console.log(`[IMAGE_PROXY] Fetching: ${url.substring(0, 80)}...`);

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10000); // 10 second timeout

      try {
        const response = await fetch(url, {
          signal: controller.signal,
          headers: {
            'User-Agent': 'Ask Detectives Bot/1.0',
          }
        });
        
        clearTimeout(timeout);

        if (!response.ok) {
          console.error(`[IMAGE_PROXY] HTTP ${response.status}: ${url.substring(0, 80)}`);
          return res.status(response.status).json({ error: `Supabase returned ${response.status}` });
        }

        // Get content type and size
        const contentType = response.headers.get('content-type') || 'application/octet-stream';
        const contentLength = response.headers.get('content-length');

        // Set response headers
        res.setHeader('Content-Type', contentType);
        res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
        if (contentLength) {
          res.setHeader('Content-Length', contentLength);
        }

        // Stream the image
        const buffer = await response.arrayBuffer();
        res.send(Buffer.from(buffer));

        console.log(`[IMAGE_PROXY] Success: ${url.substring(0, 80)}... (${buffer.byteLength} bytes)`);
      } catch (fetchError: any) {
        clearTimeout(timeout);
        
        if (fetchError.name === 'AbortError') {
          console.error(`[IMAGE_PROXY] TIMEOUT: ${url.substring(0, 80)}`);
          return res.status(504).json({ error: "Supabase timeout" });
        }
        
        console.error(`[IMAGE_PROXY] FETCH ERROR: ${fetchError.message}`);
        return res.status(503).json({ error: "Failed to fetch image from Supabase" });
      }
    } catch (error) {
      console.error("[IMAGE_PROXY] Error:", error);
      return res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  });

  // DIAGNOSTIC - Test Supabase connectivity and image availability
  app.get("/api/diagnostic/supabase", async (_req: Request, res: Response) => {
    try {
      console.log("[DIAGNOSTICS] Starting Supabase connectivity test...");

      // Step 1: Get sample image URLs from database
      const sampleService = await db.select({
        id: services.id,
        title: services.title,
        images: services.images,
      })
        .from(services)
        .where(and(isNotNull(services.images), sql`array_length(${services.images}, 1) > 0`))
        .limit(1);

      const diagnostics: any = {
        timestamp: new Date().toISOString(),
        supabaseUrl: process.env.SUPABASE_URL || "NOT SET",
        tests: []
      };

      // Test 1: Check if Supabase URL is configured
      if (!process.env.SUPABASE_URL) {
        diagnostics.tests.push({
          name: "Supabase URL Configuration",
          status: "FAILED",
          message: "SUPABASE_URL environment variable not set"
        });
        return res.json(diagnostics);
      }

      diagnostics.tests.push({
        name: "Supabase URL Configuration",
        status: "OK",
        url: process.env.SUPABASE_URL
      });

      // Test 2: Check if we have sample images
      if (!sampleService || sampleService.length === 0 || !sampleService[0].images) {
        diagnostics.tests.push({
          name: "Sample Image Availability",
          status: "FAILED",
          message: "No images found in database"
        });
        return res.json(diagnostics);
      }

      const imageUrl = Array.isArray(sampleService[0].images) 
        ? sampleService[0].images[0] 
        : sampleService[0].images;

      diagnostics.tests.push({
        name: "Sample Image Availability",
        status: "OK",
        imageUrl: imageUrl.substring(0, 100),
        isSupabase: imageUrl.includes('.supabase.co'),
        isBase64: imageUrl.startsWith('data:'),
      });

      // Test 3: Try to fetch the image from Supabase
      console.log(`[DIAGNOSTICS] Testing image fetch: ${imageUrl.substring(0, 80)}...`);
      
      const controller = new AbortController();
      const fetchTimeout = setTimeout(() => controller.abort(), 15000); // 15 second timeout
      
      try {
        const fetchStart = Date.now();
        const response = await fetch(imageUrl, {
          signal: controller.signal,
          method: 'HEAD', // Only get headers, not the full image
        });
        const fetchDuration = Date.now() - fetchStart;
        clearTimeout(fetchTimeout);

        diagnostics.tests.push({
          name: "Supabase Image Fetch (HEAD)",
          status: response.ok ? "OK" : "FAILED",
          httpStatus: response.status,
          duration: `${fetchDuration}ms`,
          headers: {
            'content-type': response.headers.get('content-type'),
            'content-length': response.headers.get('content-length'),
            'access-control-allow-origin': response.headers.get('access-control-allow-origin'),
            'cache-control': response.headers.get('cache-control'),
          }
        });
      } catch (fetchErr: any) {
        clearTimeout(fetchTimeout);
        
        diagnostics.tests.push({
          name: "Supabase Image Fetch (HEAD)",
          status: "FAILED",
          error: fetchErr.name === 'AbortError' ? "TIMEOUT (15s+)" : fetchErr.message,
          errorType: fetchErr.name,
        });
      }

      // Test 4: Try GET request (full download)
      console.log(`[DIAGNOSTICS] Testing full image download...`);
      
      const getController = new AbortController();
      const getTimeout = setTimeout(() => getController.abort(), 15000);
      
      try {
        const getStart = Date.now();
        const getResponse = await fetch(imageUrl, {
          signal: getController.signal,
          method: 'GET',
        });
        const getDuration = Date.now() - getStart;
        clearTimeout(getTimeout);

        if (getResponse.ok) {
          const buffer = await getResponse.arrayBuffer();
          diagnostics.tests.push({
            name: "Supabase Image Fetch (GET)",
            status: "OK",
            httpStatus: 200,
            duration: `${getDuration}ms`,
            size: `${buffer.byteLength} bytes`,
          });
        } else {
          diagnostics.tests.push({
            name: "Supabase Image Fetch (GET)",
            status: "FAILED",
            httpStatus: getResponse.status,
            duration: `${getDuration}ms`,
          });
        }
      } catch (getErr: any) {
        clearTimeout(getTimeout);
        
        diagnostics.tests.push({
          name: "Supabase Image Fetch (GET)",
          status: "FAILED",
          error: getErr.name === 'AbortError' ? "TIMEOUT (15s+)" : getErr.message,
          errorType: getErr.name,
        });
      }

      // Test 5: Check network from Render
      console.log("[DIAGNOSTICS] Testing DNS resolution...");
      try {
        const hostname = new URL(imageUrl).hostname;
        const { lookup } = require('dns').promises;
        const address = await lookup(hostname);
        
        diagnostics.tests.push({
          name: "DNS Resolution",
          status: "OK",
          hostname,
          address: address.address,
        });
      } catch (dnsErr: any) {
        diagnostics.tests.push({
          name: "DNS Resolution",
          status: "FAILED",
          error: dnsErr.message,
        });
      }

      console.log("[DIAGNOSTICS] Tests complete:", JSON.stringify(diagnostics, null, 2));
      return res.json(diagnostics);
    } catch (error) {
      console.error("[DIAGNOSTICS] Error:", error);
      return res.status(500).json({
        status: "ERROR",
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  });

  // Get payment history for current detective
  app.get("/api/payments/history", requireRole("detective"), async (req: Request, res: Response) => {
    try {
      const detective = await storage.getDetectiveByUserId(req.session.userId!);
      if (!detective) {
        return res.status(400).json({ error: "Detective profile not found" });
      }

      const paymentHistory = await storage.getPaymentOrdersByDetectiveId(detective.id);
      
      // Return payment history with minimal enrichment
      const formattedHistory = paymentHistory.map((order: any) => ({
        id: order.id,
        packageName: order.plan || "Unknown",
        billingCycle: order.billingCycle || "monthly",
        amount: String(order.amount),
        currency: order.currency || "INR",
        status: order.status,
        razorpayOrderId: order.razorpayOrderId,
        createdAt: order.createdAt,
        updatedAt: order.updatedAt,
      }));

      res.json({ paymentHistory: formattedHistory });
    } catch (error) {
      console.error("[payments/history] Error:", error);
      res.status(500).json({ error: error instanceof Error ? error.message : "Failed to fetch payment history" });
    }
  });

  // Admin endpoint to manually sync/recover payment subscriptions
  // Use this if verify endpoint fails but payment is marked as paid
  app.post("/api/admin/payments/sync-detective", requireRole("admin"), async (req: Request, res: Response) => {
    try {
      const body = req.body;
      if (body == null || typeof body !== "object") {
        return res.status(400).json({ error: "Invalid request" });
      }
      const detectiveId = typeof body.detectiveId === "string" ? body.detectiveId.trim() : "";
      if (!detectiveId) {
        return res.status(400).json({ error: "detectiveId is required" });
      }

      console.log("[admin-sync] Starting payment sync recovery");

      // Fetch detective to check current state
      const detective = await storage.getDetective(detectiveId);
      if (!detective) {
        console.error("[admin-sync] Detective not found");
        return res.status(404).json({ error: "Detective not found" });
      }

      // Check if already synced
      if (detective.subscriptionPackageId) {
        console.log(`[admin-sync] Detective already has package: ${detective.subscriptionPackageId}`);
        return res.json({
          success: true,
          message: "Detective already synced",
          detective,
          alreadySynced: true,
        });
      }

      console.log(`[admin-sync] Detective not synced, looking for paid payment orders...`);

      // Get all payment orders for this detective to find paid ones
      // We'll use a workaround by fetching through the detective profile if available
      // For now, we need to access the database directly or add a method to storage
      // Using storage pattern: we check recent applications or orders
      
      // Alternative: create a simple getPaymentOrdersByDetective method
      // For now, we'll inform the admin to provide order details or check database
      return res.json({
        success: false,
        message: "Please use the diagnostic script to find paid payment orders, then provide detectiveId and paymentOrderId",
        detective: {
          id: detective.id,
          businessName: detective.businessName,
          currentPackageId: detective.subscriptionPackageId,
          billingCycle: detective.billingCycle,
        },
      });
    } catch (error) {
      console.error("[admin-sync] Error:", error);
      res.status(500).json({ error: error instanceof Error ? error.message : "Sync failed" });
    }
  });

  // ============== BLUE TICK ADD-ON PAYMENT ROUTES ==============
  
  app.post("/api/payments/create-blue-tick-order", requireRole("detective"), async (req: Request, res: Response) => {
    try {
      if (!config.razorpay.keyId || !config.razorpay.keySecret) {
        console.error("[blue-tick-order] Razorpay not configured");
        return res.status(500).json({ error: "Payments not configured" });
      }

      const detective = await storage.getDetectiveByUserId(req.session.userId!);
      if (!detective) {
        console.error("[blue-tick-order] Detective not found");
        return res.status(400).json({ error: "Detective profile not found" });
      }

      // GUARD: Block duplicate Blue Tick purchases (HARD RULE)
      try {
        await assertBlueTickNotAlreadyActive(detective.id, 'razorpay');
      } catch (guardError: any) {
        if (guardError.statusCode === 409) {
          console.warn(`[blue-tick-order] Duplicate Blue Tick attempt rejected:`, guardError.message);
          return res.status(409).json({ error: guardError.message });
        }
        throw guardError;
      }

      // REQUIREMENT: Detective must have active package subscription
      if (!detective.subscriptionPackageId) {
        console.error("[blue-tick-order] Detective has no active package subscription");
        return res.status(400).json({ error: "You must have an active subscription to add Blue Tick" });
      }

      // Validate request body
      const parsed = z.object({ 
        billingCycle: z.enum(["monthly", "yearly"], { errorMap: () => ({ message: "Billing cycle must be 'monthly' or 'yearly'" }) })
      }).parse(req.body);
      
      const billingCycle: "monthly" | "yearly" = parsed.billingCycle;
      
      console.log(`[blue-tick-order] Creating Blue Tick order for detective: ${detective.id}, cycle: ${billingCycle}`);

      // Blue Tick pricing in USD: $15/month or $150/year
      const priceUSD = billingCycle === "yearly" ? 150 : 15;
      
      // Fetch live exchange rate USD to INR
      let exchangeRate = 83.5; // Fallback rate
      try {
        const rateResponse = await fetch('https://api.frankfurter.app/latest?from=USD&to=INR');
        const rateData = await rateResponse.json();
        if (rateData.rates?.INR) {
          exchangeRate = rateData.rates.INR;
        }
      } catch (error) {
        console.warn('[blue-tick-order] Failed to fetch live rate, using fallback 83.5');
      }

      // Convert USD to INR
      const priceINR = priceUSD * exchangeRate;
      const amountPaise = Math.round(priceINR * 100);
      
      console.log(`[blue-tick-order] Blue Tick pricing: $${priceUSD} USD = ₹${priceINR.toFixed(2)} INR (${amountPaise} paise) - Rate: ${exchangeRate}`);
      
      // Get Razorpay client from database config
      const rzpClient = await getRazorpayClient();
      const gateway = await getPaymentGateway('razorpay');
      
      if (!gateway) {
        return res.status(503).json({ error: "Razorpay payment gateway is not configured" });
      }
      
      // Create Razorpay order
      const orderResult = await rzpClient.orders.create({
        amount: amountPaise,
        currency: "INR",
        receipt: `bluetick_${Date.now()}`.substring(0, 40),
        notes: { 
          type: "blue_tick_addon",
          billingCycle,
          detectiveId: detective.id, 
          userId: req.session.userId!
        },
      });
      
      const order = orderResult as unknown as { id: string };
      console.log(`[blue-tick-order] Razorpay order created: ${order.id}`);

      // Save to a tracking table or note field
      // For now, we'll just return the order to client
      
      res.json({ 
        orderId: order.id, 
        amount: amountPaise,
        key: gateway.config.keyId || config.razorpay.keyId,
        type: "blue_tick"
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        console.error("[blue-tick-order] Validation error:", fromZodError(error).message);
        return res.status(400).json({ error: fromZodError(error).message });
      }
      console.error("[blue-tick-order] Unexpected error:", error);
      res.status(500).json({ error: error instanceof Error ? error.message : "Failed to create payment order" });
    }
  });

  app.post("/api/payments/verify-blue-tick", requireRole("detective"), async (req: Request, res: Response) => {
    console.log("[verify-blue-tick] === BLUE TICK VERIFICATION START ===");
    try {
      const gateway = await getPaymentGateway('razorpay');
      if (!gateway) {
        console.error("[verify-blue-tick] Razorpay not configured or not enabled");
        return res.status(500).json({ error: "Payments not configured" });
      }

      // Validate request body
      const body = z.object({
        razorpay_payment_id: z.string().min(1, "Payment ID is required"),
        razorpay_order_id: z.string().min(1, "Order ID is required"),
        razorpay_signature: z.string().min(1, "Signature is required"),
      }).parse(req.body);

      console.log(`[verify-blue-tick] Verifying payment for order: ${body.razorpay_order_id}`);

      // Verify Razorpay signature
      const expected = crypto
        .createHmac("sha256", gateway.config.keySecret || config.razorpay.keySecret)
        .update(`${body.razorpay_order_id}|${body.razorpay_payment_id}`)
        .digest("hex");

      if (expected !== body.razorpay_signature) {
        console.error(`[verify-blue-tick] Invalid signature for order ${body.razorpay_order_id}`);
        return res.status(400).json({ error: "Invalid signature" });
      }

      console.log(`[verify-blue-tick] Signature verified for order ${body.razorpay_order_id}`);

      // Get detective and verify ownership
      const detective = await storage.getDetectiveByUserId(req.session.userId!);
      if (!detective) {
        console.error("[verify-blue-tick] Detective not found");
        return res.status(400).json({ error: "Detective not found" });
      }

      // Idempotency: already processed (replay) — return success if add-on OR subscription Blue Tick
      const hasAddon = (detective as any).blueTickAddon === true;
      const hasFromPackage = detective.hasBlueTick === true;
      if (hasAddon || hasFromPackage) {
        console.log(`[verify-blue-tick] Blue Tick already active (replay), returning success: ${detective.id}`);
        const updatedDetective = await storage.getDetective(detective.id);
        if (!updatedDetective) {
          console.error(`[verify-blue-tick] Could not fetch detective for idempotent response: ${detective.id}`);
          return res.status(500).json({ error: "Failed to fetch updated detective" });
        }
        return res.json({
          success: true,
          hasBlueTick: true,
          detective: updatedDetective,
        });
      }

      // GUARD: Block duplicate Blue Tick purchases (HARD RULE)
      try {
        await assertBlueTickNotAlreadyActive(detective.id, 'razorpay');
      } catch (guardError: any) {
        if (guardError.statusCode === 409) {
          console.warn(`[verify-blue-tick] Duplicate Blue Tick attempt rejected:`, guardError.message);
          return res.status(409).json({ error: guardError.message });
        }
        throw guardError;
      }

      // VERIFY: Detective still has active package subscription
      if (!detective.subscriptionPackageId) {
        console.error(`[verify-blue-tick] CRITICAL: Detective no longer has active subscription: ${detective.id}`);
        return res.status(400).json({ error: "Active subscription required" });
      }

      console.log(`[verify-blue-tick] Activating Blue Tick for detective ${detective.id}`);

      // Update detective with Blue Tick
      await storage.updateDetectiveAdmin(detective.id, {
        hasBlueTick: true,
        blueTickActivatedAt: new Date(),
      } as any);

      console.log(`[verify-blue-tick] Blue Tick activated`);

      // Fetch updated detective
      const updatedDetective = await storage.getDetective(detective.id);
      
      if (!updatedDetective) {
        console.error(`[verify-blue-tick] Could not fetch updated detective: ${detective.id}`);
        return res.status(500).json({ error: "Failed to fetch updated detective" });
      }

      // Send blue tick purchase success email (non-blocking)
      const user = await storage.getUser(detective.userId);
      if (user) {
        smtpEmailService.sendTransactionalEmail(
          user.email,
          EMAIL_TEMPLATE_KEYS.BLUE_TICK_PURCHASE_SUCCESS,
          {
            detectiveName: detective.businessName || user.name,
            email: user.email,
            supportEmail: "support@askdetectives.com",
          }
        ).catch(err => console.error("[Email] Failed to send blue tick success email:", err));
      }

      console.log(`[verify-blue-tick] Successfully activated Blue Tick add-on for detective: blueTickAddon=${(updatedDetective as any).blueTickAddon}`);
      console.log("[verify-blue-tick] === BLUE TICK VERIFICATION COMPLETE ===");
      // Rotate CSRF token after Blue Tick purchase
      const newToken = rotateCsrfToken(req);
      await new Promise<void>((resolve, reject) => {
        req.session.save((err) => {
          if (err) reject(err);
          else resolve();
        });
      });


      res.json({ 
        success: true, 
        hasBlueTick: true,
        detective: updatedDetective,
        newToken
      });
    } catch (error) {
      console.log("[verify-blue-tick] === BLUE TICK VERIFICATION FAILED ===");
      if (error instanceof z.ZodError) {
        console.error("[verify-blue-tick] Validation error:", fromZodError(error).message);
        return res.status(400).json({ error: fromZodError(error).message });
      }
      console.error("[verify-blue-tick] Unexpected error:", error);
      res.status(500).json({ error: error instanceof Error ? error.message : "Verification failed" });
    }
  });
  
  // Note: admin now uses /api/subscription-plans?all=1, so this route is unused

  app.post("/api/subscription-plans", requireRole("admin"), async (req: Request, res: Response) => {
    try {
      const payload = req.body as any;
      const ALLOWED_SERVICE_LIMITS = [10, 15, 20, 25, 30, 35, 40, 45, 50];
      const parsed = z.object({
        name: z.string().min(2),
        displayName: z.string().min(2).optional(),
        monthlyPrice: z.number().min(0),
        yearlyPrice: z.number().min(0),
        description: z.string().optional(),
        features: z.array(z.string()).optional(),
        badges: z.any().optional(),
        serviceLimit: z.number().int().min(0).refine(
          (val) => val === 0 || val === 1 || val === 2 || val === 3 || val === 4 || val === 5 || ALLOWED_SERVICE_LIMITS.includes(val),
          "Service limit must be between 1-5 or one of: 10, 15, 20, 25, 30, 35, 40, 45, 50"
        ),
        isActive: z.boolean().optional(),
      }).strict().parse({
        name: String(payload.name || "").toLowerCase().trim(),
        displayName: String(payload.displayName || payload.name || "").trim(),
        monthlyPrice: Number(payload.monthlyPrice ?? 0),
        yearlyPrice: Number(payload.yearlyPrice ?? 0),
        description: payload.description,
        features: Array.isArray(payload.features) ? payload.features.map(String) : undefined,
        badges: payload.badges,
        serviceLimit: Number(payload.serviceLimit ?? 0),
        isActive: payload.isActive !== false,
      });
      const plan = await storage.createSubscriptionPlan({
        name: parsed.name,
        displayName: parsed.displayName!,
        monthlyPrice: String(parsed.monthlyPrice),
        yearlyPrice: String(parsed.yearlyPrice),
        description: parsed.description,
        features: parsed.features,
        badges: parsed.badges,
        serviceLimit: parsed.serviceLimit,
        isActive: parsed.isActive !== false,
      });
      res.status(201).json({ plan });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: fromZodError(error).message });
      }
      res.status(400).json({ error: "Failed to create plan" });
    }
  });

  app.patch("/api/subscription-plans/:id", requireRole("admin"), async (req: Request, res: Response) => {
    try {
      if (req.body == null || typeof req.body !== "object") {
        return res.status(400).json({ error: "Invalid request" });
      }
      const raw = req.body as any;
      const ALLOWED_SERVICE_LIMITS = [10, 15, 20, 25, 30, 35, 40, 45, 50];
      const input = {
        name: raw.name,
        displayName: raw.displayName,
        monthlyPrice: raw.monthlyPrice,
        yearlyPrice: raw.yearlyPrice,
        description: raw.description,
        features: Array.isArray(raw.features) ? raw.features : undefined,
        badges: raw.badges,
        serviceLimit: raw.serviceLimit,
        isActive: raw.isActive,
      };
      const parsed = z.object({
        name: z.string().min(2).optional(),
        displayName: z.string().min(2).optional(),
        monthlyPrice: z.number().min(0).optional(),
        yearlyPrice: z.number().min(0).optional(),
        description: z.string().optional(),
        features: z.array(z.string()).optional(),
        badges: z.any().optional(),
        serviceLimit: z.number().int().min(0).refine(
          (val) => val === 0 || val === 1 || val === 2 || val === 3 || val === 4 || val === 5 || ALLOWED_SERVICE_LIMITS.includes(val),
          "Service limit must be between 1-5 or one of: 10, 15, 20, 25, 30, 35, 40, 45, 50"
        ).optional(),
        isActive: z.boolean().optional(),
      }).strict().parse(input);
      const plan = await storage.updateSubscriptionPlan(req.params.id, {
        ...parsed,
        monthlyPrice: parsed.monthlyPrice !== undefined ? String(parsed.monthlyPrice) : undefined,
        yearlyPrice: parsed.yearlyPrice !== undefined ? String(parsed.yearlyPrice) : undefined,
      } as any);
      clearFreePlanCache();
      cache.keys().filter((k) => k.startsWith("services:")).forEach((k) => { cache.del(k); });
      console.debug("[cache INVALIDATE]", "services:");
      res.json({ plan });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: fromZodError(error).message });
      }
      res.status(400).json({ error: "Failed to update plan" });
    }
  });

  app.delete("/api/subscription-plans/:id", requireRole("admin"), async (req: Request, res: Response) => {
    try {
      const ok = await storage.deleteSubscriptionPlan(req.params.id);
      if (!ok) return res.status(404).json({ error: "Plan not found" });
      res.json({ message: "Plan deleted" });
    } catch {
      res.status(400).json({ error: "Failed to delete plan" });
    }
  });

  // Get current logged-in detective's profile (requires detective role)
  app.get("/api/detectives/me", requireAuth, async (req: Request, res: Response) => {
    try {
      setNoStore(res);
      const userId = req.session.userId!;
      
      // Step 1: Fetch detective from database
      let detective = await storage.getDetectiveByUserId(userId);
      
      if (!detective) {
        console.warn(`[/api/detectives/me] No detective profile found for userId: ${userId}`);
        return res.status(404).json({ 
          error: "Detective profile not found",
          code: "PROFILE_NOT_FOUND",
          action: "Create a detective profile to get started"
        });
      }
      
      console.log(`[/api/detectives/me] ✓ Found detective: ${detective.id}`);

      // Step 2: Backfill subscription expiry for paid plans if missing
      const freePlanId = await getFreePlanId();
      const isPaidPlan = detective.subscriptionPackageId && detective.subscriptionPackageId !== freePlanId;
      if (isPaidPlan && !detective.subscriptionExpiresAt) {
        const activatedAt = detective.subscriptionActivatedAt ? new Date(detective.subscriptionActivatedAt) : new Date();
        const billingCycle = detective.billingCycle || "monthly";
        const computedExpiry = calculateExpiryDate(activatedAt, billingCycle);
        if (computedExpiry) {
          await storage.updateDetectiveAdmin(detective.id, {
            subscriptionExpiresAt: computedExpiry,
            billingCycle: billingCycle,
            subscriptionActivatedAt: detective.subscriptionActivatedAt ? new Date(detective.subscriptionActivatedAt) : activatedAt,
          } as any);
          detective = {
            ...detective,
            subscriptionExpiresAt: computedExpiry,
            billingCycle: billingCycle,
            subscriptionActivatedAt: detective.subscriptionActivatedAt ?? activatedAt,
          } as any;
        }
      }
      
      // Step 3: Apply pending downgrades if expiry has passed
      detective = await applyPendingDowngrades(detective);

      if (!detective) {
        return res.status(500).json({
          error: "Profile incomplete",
          code: "PROFILE_FETCH_ERROR",
          message: "Unable to retrieve detective profile"
        });
      }

      // Step 4: Compute effective badges
      const effectiveBadges = computeEffectiveBadges(detective);
      
      // Step 5: Return complete profile with validation flags
      res.json({ 
        detective: { 
          ...detective, 
          effectiveBadges,
          slug: detective.slug || "pending-generation",
          requireLocationUpdate: detective.requireLocationUpdate || false,
        } 
      });
    } catch (error) {
      console.error("[/api/detectives/me] Unhandled error:", error);
      res.status(500).json({ 
        error: "Profile incomplete",
        code: "PROFILE_FETCH_ERROR",
        message: error instanceof Error ? error.message : "Unable to retrieve detective profile"
      });
    }
  });

  // OPTIMIZED: Dashboard endpoint - single query for detective + services + subscription
  app.get("/api/detectives/me/dashboard", requireAuth, async (req: Request, res: Response) => {
    try {
      setNoStore(res);
      const dashboardData = await storage.getDetectiveDashboardData(req.session.userId!);
      if (!dashboardData) {
        return res.status(404).json({ error: "Detective profile not found" });
      }
      res.json(dashboardData);
    } catch (error) {
      console.error("Get detective dashboard error:", error);
      res.status(500).json({ error: "Failed to get detective dashboard" });
    }
  });
  // Location Wizard API - Get all countries (using library)
  // Location routes are now registered via registerLocationRoutes() function
  // See server/routes/locationRoutes.ts for location wizard, top locations, and SEO routes

  app.get("/api/detectives/:id/public-service-count", async (req: Request, res: Response) => {
    try {
      const count = await storage.getPublicServiceCountByDetective(req.params.id);
      res.json({ count });
    } catch (error) {
      console.error("Get public service count error:", error);
      res.status(500).json({ error: "Failed to get service count" });
    }
  });

  // Get detective by ID (public with conditional caching)
  app.get("/api/detectives/:id", async (req: Request, res: Response) => {
    try {
      let detective = await storage.getDetective(req.params.id);
      
      // RECOVERY SEARCH: If not found by ID, try by slug (for old URLs or migration)
      if (!detective && !req.params.id.includes('-') === false) {
        console.log(`[RECOVERY] Detective not found by ID: ${req.params.id}, trying slug-based search`);
        // Could implement slug lookup here if schema supported it
        // For now, return clear error
      }
      
      if (!detective) {
        return res.status(404).json({ 
          error: "Detective not found",
          code: "DETECTIVE_NOT_FOUND",
          message: "The detective profile you're looking for does not exist or has been removed"
        });
      }
      
      const skipCache = !!(req.session?.userId === detective.userId || req.session?.userRole === "admin");
      const cacheKey = `detective:public:${req.params.id}`;
      
      if (!skipCache) {
        try {
          const cached = cache.get<{ detective: unknown; claimInfo: unknown }>(cacheKey);
          if (cached != null && cached.detective != null) {
            console.debug("[cache HIT]", cacheKey);
            res.set("Cache-Control", "public, max-age=60, stale-while-revalidate=300");
            sendCachedJson(req, res, cached);
            return;
          }
        } catch (_) {
          // Cache failure must not break the request
        }
        console.debug("[cache MISS]", cacheKey);
      }
      
      let claimInfo: any = undefined;
      if (detective.isClaimed) {
        const latestClaim = await storage.getLatestApprovedClaimForDetective(detective.id);
        if (latestClaim) {
          claimInfo = {
            claimedAt: latestClaim.reviewedAt,
            claimedEmail: latestClaim.claimantEmail,
            claimId: latestClaim.id,
          };
        }
      }
      
      const maskedDetective = await maskDetectiveContactsPublic(detective as any);
      const payload = { 
        detective: { 
          ...maskedDetective, 
          effectiveBadges: computeEffectiveBadges(maskedDetective, (maskedDetective as any).subscriptionPackage),
          slug: maskedDetective.slug || "pending-generation",
          requireLocationUpdate: maskedDetective.requireLocationUpdate || false,
        }, 
        claimInfo 
      };
      
      if (!skipCache) {
        try {
          cache.set(cacheKey, payload, 60);
        } catch (_) {
          // Cache failure must not break the request
        }
      }
      
      // Conditional caching: public cache for anonymous, no-store for owner/admin
      if (!skipCache) {
        res.set("Cache-Control", "public, max-age=60, stale-while-revalidate=300");
      } else {
        setNoStore(res);
      }
      
      sendCachedJson(req, res, payload);
    } catch (error) {
      console.error("[GET /api/detectives/:id] Error:", error);
      res.status(500).json({ 
        error: "Failed to retrieve detective profile",
        code: "DETECTIVE_FETCH_ERROR",
        message: error instanceof Error ? error.message : "Internal server error"
      });
    }
  });

  // ============== GET Detective by Slug (Country/State/City/Slug) ==============
  app.get("/api/detectives/:country/:state/:city/:slug", async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { country, state, city, slug } = req.params;

      // Route guard: allow dedicated location API route
      if (String(country).toLowerCase() === "location") {
        return next();
      }

      // Convert country name/slug to country code (e.g., "india" -> "IN")
      const countryCode = getCountryCode(country);
      const countryName = COUNTRY_CODE_MAP[countryCode] || "";
      const requestedStateSlug = generateSlug(state);
      const requestedCitySlug = generateSlug(city);

      // Find candidates by slug + country (support both country code and country name in DB)
      const detectiveRows = await db
        .select()
        .from(detectives)
        .where(
          and(
            eq(detectives.slug, slug),
            or(
              eq(detectives.country, countryCode),
              countryName ? ilike(detectives.country, countryName) : undefined,
              ilike(detectives.country, country)
            )
          )
        );

      if (detectiveRows.length === 0) {
        return res.status(404).json({ error: "Detective not found" });
      }

      // URL uses slugified location segments; DB usually stores human-readable names
      // Match by slugified state/city to handle values like "Madhya Pradesh" vs "madhya-pradesh"
      const locationMatchedDetective = detectiveRows.find((row) => {
        const rowStateSlug = generateSlug(row.state || "");
        const rowCitySlug = generateSlug(row.city || "");
        return rowStateSlug === requestedStateSlug && rowCitySlug === requestedCitySlug;
      });

      const detective = locationMatchedDetective || (detectiveRows.length === 1 ? detectiveRows[0] : null);

      if (!detective) {
        return res.status(404).json({ error: "Detective not found" });
      }

      // SECURITY: Apply contact masking based on subscription plan
      // This ensures only detectives with paid plans that include contact features
      // will have their contact information (phone, whatsapp, email, website) exposed
      const maskedDetective = await maskDetectiveContactsPublic(detective as any);

      const payload = {
        detective: {
          id: maskedDetective.id,
          businessName: maskedDetective.businessName,
          bio: maskedDetective.bio,
          logo: maskedDetective.logo,
          location: maskedDetective.location,
          country: maskedDetective.country,
          state: maskedDetective.state,
          city: maskedDetective.city,
          slug: maskedDetective.slug,
          phone: maskedDetective.phone,
          whatsapp: maskedDetective.whatsapp,
          contactEmail: maskedDetective.contactEmail,
          languages: maskedDetective.languages,
          yearsExperience: maskedDetective.yearsExperience,
          businessWebsite: maskedDetective.businessWebsite,
          recognitions: maskedDetective.recognitions,
          memberSince: maskedDetective.memberSince,
          isVerified: maskedDetective.isVerified,
          level: maskedDetective.level,
          hasBlueTick: maskedDetective.hasBlueTick,
          blueTickAddon: maskedDetective.blueTickAddon,
          status: maskedDetective.status,
          createdAt: maskedDetective.createdAt,
          updatedAt: maskedDetective.updatedAt,
          effectiveBadges: {
            blueTick: maskedDetective.hasBlueTick || maskedDetective.blueTickAddon,
            pro: maskedDetective.level === 'pro',
            recommended: false
          }
        }
      };

      res.setHeader("Cache-Control", "public, s-maxage=3600, stale-while-revalidate=86400");
      sendCachedJson(req, res, payload);
    } catch (error) {
      console.error("[GET /api/detectives/:country/:state/:city/:slug] Error:", error);
      res.status(500).json({
        error: "Failed to retrieve detective profile by slug",
        code: "DETECTIVE_SLUG_FETCH_ERROR",
        message: error instanceof Error ? error.message : "Internal server error"
      });
    }
  });

  // Get user profile by id (authenticated - user-specific data)
  app.get("/api/users/:id", requireAuth, async (req: Request, res: Response) => {
    try {
      // User-specific authenticated data must NEVER cache
      setNoStore(res);
      
      const user = await storage.getUser(req.params.id);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }
      // Allow only self or admin — no email/role exposure to unauthorized callers
      const isSelf = req.session.userId === req.params.id;
      const isAdmin = req.session.userRole === "admin";
      if (!isSelf && !isAdmin) {
        return res.status(403).json({ error: "Forbidden" });
      }
      const { password, ...userWithoutPassword } = user as any;
      res.json({ user: userWithoutPassword });
    } catch (error) {
      console.error("Get user error:", error);
      res.status(500).json({ error: "Failed to get user" });
    }
  });

  // Create detective profile (requires authentication)
  app.post("/api/detectives", requireAuth, async (req: Request, res: Response) => {
    try {
      const validatedData = insertDetectiveSchema.parse({
        ...req.body,
        userId: req.session.userId,
      });
      if (typeof (validatedData as any).logo === "string" && (validatedData as any).logo.startsWith("data:")) {
        (validatedData as any).logo = await uploadDataUrl("detective-assets", `logos/${Date.now()}-${Math.random()}.png`, (validatedData as any).logo);
      }
      if (Array.isArray((validatedData as any).businessDocuments)) {
        (validatedData as any).businessDocuments = await Promise.all(((validatedData as any).businessDocuments || []).map(async (d: string, i: number) => {
          return d && d.startsWith("data:") ? await uploadDataUrl("detective-assets", `documents/${Date.now()}-${i}.pdf`, d) : d;
        }));
      }
      if (Array.isArray((validatedData as any).identityDocuments)) {
        (validatedData as any).identityDocuments = await Promise.all(((validatedData as any).identityDocuments || []).map(async (d: string, i: number) => {
          return d && d.startsWith("data:") ? await uploadDataUrl("detective-assets", `identity/${Date.now()}-${i}.pdf`, d) : d;
        }));
      }

      // Check if user already has a detective profile
      const existing = await storage.getDetectiveByUserId(req.session.userId!);
      if (existing) {
        return res.status(400).json({ error: "Detective profile already exists" });
      }

      // DEFENSIVE CHECK: Business name is required for slug generation
      if (!validatedData.businessName || validatedData.businessName.trim() === "") {
        return res.status(400).json({ error: "Business name is required" });
      }

      // Generate unique slug from business name
      const baseSlug = generateSlug(validatedData.businessName);
      const uniqueSlug = await storage.ensureUniqueDetectiveSlug(baseSlug);

      // Resolve location IDs (REQUIRED - database has NOT NULL constraints)
      let locationIds: LocationService.ResolvedLocationIds;
      try {
        locationIds = await LocationService.resolveLocationIds(
          validatedData.country,
          validatedData.state,
          validatedData.city
        );
      } catch (error) {
        console.error("[Detective Creation] Location resolution failed, using defaults:", error);
        locationIds = await LocationService.getDefaultLocationIds();
      }

      const detective = await storage.createDetective({
        ...validatedData,
        slug: uniqueSlug,
        countryId: locationIds.countryId!,
        stateId: locationIds.stateId!,
        cityId: locationIds.cityId!,
      });
      
      // Update user role to detective using privileged method
      await storage.updateUserRole(req.session.userId!, "detective");
      req.session.userRole = "detective";

      // Lazy-populate country code in background (non-blocking)
      if (validatedData.country) {
        const { ensureCountryCode } = await import("./utils/countryCodeMapper.js");
        ensureCountryCode(validatedData.country).catch(err => {
          console.error("[Country Mapper] Failed to populate code:", err);
        });
      }

      res.status(201).json({ detective });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: fromZodError(error).message });
      }
      console.error("Create detective error:", error);
      res.status(500).json({ error: "Failed to create detective profile" });
    }
  });

  // Update detective profile (requires detective role)
  app.patch("/api/detectives/:id", requireRole("detective", "admin"), async (req: Request, res: Response) => {
    try {
      const detective = await storage.getDetective(req.params.id);
      if (!detective) {
        return res.status(404).json({ error: "Detective not found" });
      }

      // Check ownership unless admin
      if (req.session.userRole !== "admin" && detective.userId !== req.session.userId) {
        return res.status(403).json({ error: "Cannot update another detective's profile" });
      }

      // Validate request body - only allow whitelisted fields
      const validatedData = updateDetectiveSchema.parse(req.body);
      
      // SUBSCRIPTION PERMISSION ENFORCEMENT: Validate WhatsApp and Recognition
      // Prevent users from bypassing frontend restrictions by directly calling the API
      if (req.session.userRole !== "admin") {
        let subscriptionPackage = (detective as any).subscriptionPackage;
        
        // Fetch subscription package if not already loaded
        if (!subscriptionPackage && detective.subscriptionPackageId) {
          try {
            subscriptionPackage = await storage.getSubscriptionPlanById(detective.subscriptionPackageId);
          } catch (error) {
            console.error("[profile-update] Failed to fetch subscription package:", error);
          }
        }
        
        const features = Array.isArray(subscriptionPackage?.features) ? (subscriptionPackage.features as string[]) : [];
        const hasWhatsAppPermission = features.includes("contact_whatsapp");
        const hasRecognitionPermission = features.includes("recognition");
        
        // Block WhatsApp update if subscription doesn't allow it
        if ("whatsapp" in validatedData && !hasWhatsAppPermission) {
          return res.status(403).json({ 
            error: "Your subscription plan does not allow WhatsApp contact visibility. Please upgrade to add WhatsApp." 
          });
        }
        
        // Block Recognition update if subscription doesn't allow it
        if ("recognitions" in validatedData && !hasRecognitionPermission) {
          return res.status(403).json({ 
            error: "Your subscription plan does not allow Recognition features. Please upgrade to add Recognitions." 
          });
        }
      }
      
      // SECURITY: Validate file URLs before processing
      // This call handles validation, uploads, and deletion of detective profile files
      await storage.processDetectiveFileUpdates(detective, validatedData);
      
      const updatedDetective = await storage.updateDetective(req.params.id, validatedData);
      
      // Lazy-populate country code in background (non-blocking)
      if (validatedData.country && updatedDetective) {
        const { ensureCountryCode } = await import("./utils/countryCodeMapper.js");
        ensureCountryCode(updatedDetective.country).catch(err => {
          console.error("[Country Mapper] Failed to populate code:", err);
        });
      }
      
      // Trigger Google Indexing API for updated detective profile
      if (updatedDetective && updatedDetective.slug && updatedDetective.country && updatedDetective.state && updatedDetective.city) {
        const countrySlug = updatedDetective.country.toLowerCase().trim().replace(/[^a-z0-9\s-]/g, "").replace(/\s+/g, "-").replace(/-+/g, "-").replace(/^-+|-+$/g, "");
        const stateSlug = updatedDetective.state.toLowerCase().trim().replace(/[^a-z0-9\s-]/g, "").replace(/\s+/g, "-").replace(/-+/g, "-").replace(/^-+|-+$/g, "");
        const citySlug = updatedDetective.city.toLowerCase().trim().replace(/[^a-z0-9\s-]/g, "").replace(/\s+/g, "-").replace(/-+/g, "-").replace(/^-+|-+$/g, "");
        const profileUrl = `https://www.askdetectives.com/detectives/${countrySlug}/${stateSlug}/${citySlug}/${updatedDetective.slug}/`;
        
        // Asynchronously notify Google (don't wait for response)
        googleIndexing.submitUrl(profileUrl, "URL_UPDATED").catch(err => {
          console.error("Failed to notify Google of detective profile update:", err);
        });
      }
      
      res.json({ detective: updatedDetective });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: fromZodError(error).message });
      }
      console.error("Update detective error:", error);
      res.status(500).json({ error: "Failed to update detective" });
    }
  });

  // Get detective stats (requires detective role)
  app.get("/api/detectives/:id/stats", requireRole("detective", "admin"), async (req: Request, res: Response) => {
    try {
      const detective = await storage.getDetective(req.params.id);
      if (!detective) {
        return res.status(404).json({ error: "Detective not found" });
      }

      // Check ownership unless admin
      if (req.session.userRole !== "admin" && detective.userId !== req.session.userId) {
        return res.status(403).json({ error: "Cannot view another detective's stats" });
      }

      const stats = await storage.getDetectiveStats(req.params.id);
      res.json({ stats });
    } catch (error) {
      console.error("Get detective stats error:", error);
      res.status(500).json({ error: "Failed to get stats" });
    }
  });

  // Admin-only detective update (allows changing status, plan, verification)
  app.patch("/api/admin/detectives/:id", requireRole("admin"), async (req: Request, res: Response) => {
    try {
      const detective = await storage.getDetective(req.params.id);
      if (!detective) {
        return res.status(404).json({ error: "Detective not found" });
      }

      // Admin can update additional fields like status, subscription plan
      const allowedData = z.object({
        businessName: z.string().optional(),
        bio: z.string().optional(),
        location: z.string().optional(),
        phone: z.string().optional(),
        whatsapp: z.string().optional(),
        languages: z.array(z.string()).optional(),
        status: z.enum(["pending", "active", "suspended", "inactive"]).optional(),
        isVerified: z.boolean().optional(),
        country: z.string().optional(),
        level: z.enum(["level1", "level2", "level3", "pro"]).optional(),
        planActivatedAt: z.string().datetime().optional(),
        planExpiresAt: z.string().datetime().optional(),
      }).parse(req.body);

      const detectiveUpdates: Partial<Detective> = {
        businessName: allowedData.businessName,
        bio: allowedData.bio,
        location: allowedData.location,
        phone: allowedData.phone,
        whatsapp: allowedData.whatsapp,
        languages: allowedData.languages,
        status: allowedData.status,
        isVerified: allowedData.isVerified,
        country: allowedData.country,
        level: allowedData.level,
        planActivatedAt: allowedData.planActivatedAt ? new Date(allowedData.planActivatedAt) : undefined,
        planExpiresAt: allowedData.planExpiresAt ? new Date(allowedData.planExpiresAt) : undefined,
      };

      const updatedDetective = await storage.updateDetectiveAdmin(req.params.id, detectiveUpdates);
      
      // Trigger Google Indexing API for updated detective profile
      if (updatedDetective && updatedDetective.slug && updatedDetective.country && updatedDetective.state && updatedDetective.city) {
        const countrySlug = updatedDetective.country.toLowerCase().trim().replace(/[^a-z0-9\s-]/g, "").replace(/\s+/g, "-").replace(/-+/g, "-").replace(/^-+|-+$/g, "");
        const stateSlug = updatedDetective.state.toLowerCase().trim().replace(/[^a-z0-9\s-]/g, "").replace(/\s+/g, "-").replace(/-+/g, "-").replace(/^-+|-+$/g, "");
        const citySlug = updatedDetective.city.toLowerCase().trim().replace(/[^a-z0-9\s-]/g, "").replace(/\s+/g, "-").replace(/-+/g, "-").replace(/^-+|-+$/g, "");
        const profileUrl = `https://www.askdetectives.com/detectives/${countrySlug}/${stateSlug}/${citySlug}/${updatedDetective.slug}/`;
        
        // Asynchronously notify Google (don't wait for response)
        googleIndexing.submitUrl(profileUrl, "URL_UPDATED").catch(err => {
          console.error("Failed to notify Google of detective profile update:", err);
        });
      }
      
      res.json({ detective: updatedDetective });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: fromZodError(error).message });
      }
      console.error("Admin update detective error:", error);
      res.status(500).json({ error: "Failed to update detective" });
    }
  });

  // Admin-only password reset for detectives
  app.post("/api/admin/detectives/:id/reset-password", requireRole("admin"), async (req: Request, res: Response) => {
    try {
      const detective = await storage.getDetective(req.params.id);
      if (!detective) {
        return res.status(404).json({ error: "Detective not found" });
      }

      // SECURITY: Generate temporary password using cryptographically secure randomness
      const tempPassword = randomBytes(16).toString('hex');
      
      await storage.resetDetectivePassword(detective.userId, tempPassword);
            // Rotate CSRF token after admin password reset
            const newToken = rotateCsrfToken(req);
            await new Promise<void>((resolve, reject) => {
              req.session.save((err) => {
                if (err) reject(err);
                else resolve();
              });
            });
      
      
      // Return the temporary password to the admin
      res.json({ 
        message: "Password reset successfully",
        temporaryPassword: tempPassword,
        email: detective.email,
        newToken
      });
    } catch (error) {
      console.warn("[auth] Reset password failed");
      res.status(500).json({ error: "Failed to reset password" });
    }
  });

  // Admin-only permanent delete of detective account
  app.delete("/api/admin/detectives/:id", requireRole("admin"), async (req: Request, res: Response) => {
    try {
      const detective = await storage.getDetective(req.params.id);
      if (!detective) {
        return res.status(404).json({ error: "Detective not found" });
      }

      if (detective.logo) {
        await deletePublicUrl(detective.logo as any);
      }
      if (Array.isArray(detective.businessDocuments)) {
        for (const u of detective.businessDocuments as any[]) {
          await deletePublicUrl(u as any);
        }
      }
      if (Array.isArray(detective.identityDocuments)) {
        for (const u of detective.identityDocuments as any[]) {
          await deletePublicUrl(u as any);
        }
      }
      const services = await storage.getServicesByDetective(detective.id);
      for (const s of services) {
        if (Array.isArray(s.images)) {
          for (const u of s.images as any[]) {
            await deletePublicUrl(u as any);
          }
        }
      }
      const ok = await storage.deleteDetectiveAccount(req.params.id);
      if (!ok) {
        return res.status(500).json({ error: "Failed to delete detective" });
      }
      res.json({ message: "Detective account deleted" });
    } catch (error) {
      console.error("Delete detective error:", error);
      res.status(500).json({ error: "Failed to delete detective" });
    }
  });

  // Admin-only service update (pricing & enquiry settings)
  app.patch("/api/admin/services/:id", requireRole("admin"), async (req: Request, res: Response) => {
    try {
      const service = await storage.getService(req.params.id);
      if (!service) {
        return res.status(404).json({ error: "Service not found" });
      }

      // Admin can update pricing and isOnEnquiry
      const allowedData = z.object({
        basePrice: z.string().nullable().optional(),
        offerPrice: z.string().nullable().optional(),
        isOnEnquiry: z.boolean().optional(),
        isActive: z.boolean().optional(),
      }).parse(req.body);

      // Validation: if isOnEnquiry is false, basePrice must be set
      const isOnEnquiry = allowedData.isOnEnquiry !== undefined 
        ? allowedData.isOnEnquiry 
        : service.isOnEnquiry;

      if (!isOnEnquiry) {
        const basePrice = allowedData.basePrice !== undefined 
          ? allowedData.basePrice 
          : service.basePrice;
        
        if (!basePrice) {
          return res.status(400).json({ 
            error: "Base price is required when not using Price on Enquiry" 
          });
        }

        const basePriceNum = parseFloat(basePrice);
        if (!(basePriceNum > 0)) {
          return res.status(400).json({ 
            error: "Base price must be a positive number" 
          });
        }

        // If offer price is provided, validate it
        if (allowedData.offerPrice !== undefined && allowedData.offerPrice !== null) {
          const offerPriceNum = parseFloat(allowedData.offerPrice);
          if (!(offerPriceNum > 0) || !(offerPriceNum < basePriceNum)) {
            return res.status(400).json({ 
              error: "Offer price must be positive and lower than base price" 
            });
          }
        }
      }

      const updatedService = await storage.updateService(req.params.id, allowedData);

      // Invalidate all service-related caches
      try {
        cache.keys().filter(k => k.startsWith("services:")).forEach(k => cache.del(k));
        cache.del(`detective:public:${service.detectiveId}`);
        console.debug("[cache INVALIDATE]", "services:");
        console.debug("[cache INVALIDATE]", `detective:public:${service.detectiveId}`);
      } catch (_) {
        // Cache invalidation must not fail the request
      }

      res.json({ service: updatedService });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: fromZodError(error).message });
      }
      console.error("Admin update service error:", error);
      res.status(500).json({ error: "Failed to update service" });
    }
  });

  // ============== AUTOCOMPLETE SEARCH (navbar) ==============
  app.get("/api/search/autocomplete", async (req: Request, res: Response) => {
    try {
      const query = String(req.query.q || "").trim().toLowerCase();
      console.log("🔍 [Autocomplete API] Received query:", query, "length:", query.length);
      
      if (!query || query.length < 3) {
        console.log("🔍 [Autocomplete API] Query too short, returning empty");
        res.setHeader("Cache-Control", "public, s-maxage=300");
        return res.json({ suggestions: [] });
      }

      const limit = 6;
      const suggestions: Array<{ type: "category" | "detective" | "location"; label: string; value: string; meta?: string }> = [];

      // Search categories
      const categories = await storage.getAllServiceCategories(true);
      const matchingCategories = categories
        .filter((c: { name: string }) => c.name.toLowerCase().includes(query))
        .slice(0, 3)
        .map((c: { name: string }) => ({
          type: "category" as const,
          label: c.name,
          value: c.name,
        }));
      suggestions.push(...matchingCategories);
      console.log("🔍 [Autocomplete API] Found categories:", matchingCategories.length);

      // Search detective business names with normalized location data
      const detectivesResult = await db
        .select({
          id: detectives.id,
          businessName: detectives.businessName,
          location: detectives.location,
          slug: detectives.slug,
          // Use FK-based location with fallback to text fields
          country: countries.name,
          countryFallback: detectives.country,
          state: states.name,
          stateFallback: detectives.state,
          city: cities.name,
          cityFallback: detectives.city,
        })
        .from(detectives)
        .leftJoin(countries, eq(detectives.countryId, countries.id))
        .leftJoin(states, eq(detectives.stateId, states.id))
        .leftJoin(cities, eq(detectives.cityId, cities.id))
        .where(and(
          eq(detectives.status, "active"),
          ilike(detectives.businessName, `%${query}%`)
        ))
        .limit(3);
      
      const matchingDetectives = detectivesResult.map((d) => ({
        type: "detective" as const,
        label: d.businessName || "Unknown Detective",
        value: d.id,
        meta: d.location || undefined,
        slug: d.slug,
        // Use normalized data with fallback to text fields
        country: d.country || d.countryFallback,
        state: d.state || d.stateFallback,
        city: d.city || d.cityFallback,
      }));
      suggestions.push(...matchingDetectives);
      console.log("🔍 [Autocomplete API] Found detectives:", matchingDetectives.length);

      // Search locations (countries, states, cities from WORLD_COUNTRIES)
      const { WORLD_COUNTRIES } = await import("../client/src/lib/world-countries.js");
      const matchingLocations: Array<{ type: "location"; label: string; value: string }> = [];
      
      for (const country of WORLD_COUNTRIES) {
        if (country.name.toLowerCase().includes(query)) {
          matchingLocations.push({
            type: "location",
            label: country.name,
            value: `country:${country.code}`,
          });
        }
        if (matchingLocations.length >= 2) break;
      }
      suggestions.push(...matchingLocations.slice(0, 2));
      console.log("🔍 [Autocomplete API] Found locations:", matchingLocations.length);
      console.log("🔍 [Autocomplete API] Total suggestions:", suggestions.length);

      res.setHeader("Cache-Control", "public, s-maxage=300");
      res.json({ suggestions: suggestions.slice(0, limit) });
    } catch (error) {
      console.error("❌ [Autocomplete API] Error:", error);
      res.status(500).json({ error: "Failed to fetch suggestions" });
    }
  });

  // ============== SMART AI SEARCH (homepage) ==============
  app.post("/api/smart-search", async (req: Request, res: Response) => {
    try {
      const body = req.body && typeof req.body === "object" ? req.body : {};
      const query = typeof body.query === "string" ? body.query.trim() : "";
      
      // Get ALL categories with descriptions (not just names)
      const fullCategories = await storage.getAllServiceCategories(true);
      const categoriesWithDesc = fullCategories.map((c: any) => ({
        id: c.id,
        name: c.name,
        description: c.description || "",
      }));
      
      const checkAvailability = async (opts: { category: string; country: string; state?: string; city?: string }) => {
        const list = await storage.searchServices({
          category: opts.category,
          country: opts.country,
          state: opts.state,
          city: opts.city,
        }, 1, 0);
        return list.length;
      };
      
      const result = await runSmartSearch(query, { categories: categoriesWithDesc, checkAvailability });
      
      // Ensure result is valid before sending
      if (!result || typeof result !== 'object') {
        console.error("[smart-search-error] Invalid result from runSmartSearch:", result);
        return res.status(200).json({
          kind: "category_not_found",
          message: "We didn't find any relevant categories. You can browse here to find what you need.",
        });
      }
      
      res.json(result);
    } catch (error) {
      console.error("[smart-search-error] Smart search error:", error);
      res.status(200).json({
        kind: "category_not_found",
        message: "We didn't find any relevant categories. You can browse here to find what you need.",
      });
    }
  });

  // ============== SERVICE ROUTES ==============

  // In-memory cache for ranked detectives(cache initialized but functions removed)
  const rankedDetectivesCache = new Map<string, { expiresAt: number; data: any }>();
  // getRankedDetectivesCache and setRankedDetectivesCache removed - unused
  
  const SERVICES_POPULAR_TTL_MS = 30 * 1000;
  const servicesPopularCache = new Map<string, { expiresAt: number; data: any }>();
  const getServicesPopularCache = (key: string) => {
    const entry = servicesPopularCache.get(key);
    if (!entry) return undefined;
    if (Date.now() > entry.expiresAt) {
      servicesPopularCache.delete(key);
      return undefined;
    }
    return entry.data;
  };
  const setServicesPopularCache = (key: string, data: any) => {
    servicesPopularCache.set(key, { expiresAt: Date.now() + SERVICES_POPULAR_TTL_MS, data });
  };

  // Search services (public)
  app.get("/api/services", async (req: Request, res: Response) => {
    try {
      const routeStartTime = Date.now();
      console.time("[PERF:SERVICES] Total route execution");
      const { category, country, search, minPrice, maxPrice, minRating, planName, level, limit = "20", offset = "0", sortBy = "popular" } = req.query;
      const limitNum = Math.min(parseInt(limit as string) || 20, 100);
      const offsetNum = parseInt(offset as string) || 0;
      const stableParams = [
        "category", "country", "search", "minPrice", "maxPrice", "minRating", "planName", "level", "limit", "offset", "sortBy"
      ].sort().map(k => `${k}=${String((req.query as Record<string, string>)[k] ?? "").trim()}`).join("&");
      const cacheKey = `services:search:${stableParams}`;
      const skipCache = !!(req.session?.userId);
      const isPopularUnfiltered =
        String(sortBy || "").trim() === "popular" &&
        !String(category || "").trim() &&
        !String(country || "").trim() &&
        !String(search || "").trim() &&
        !String(minPrice || "").trim() &&
        !String(maxPrice || "").trim() &&
        !String(minRating || "").trim() &&
        !String(planName || "").trim() &&
        !String(level || "").trim();
      const popularCacheKey = `services_popular_page_${limitNum}_${offsetNum}`;

      if (!skipCache && isPopularUnfiltered) {
        const cachedPopular = getServicesPopularCache(popularCacheKey);
        if (cachedPopular != null) {
          console.debug("[cache HIT]", popularCacheKey);
          res.set("Cache-Control", "public, max-age=30, stale-while-revalidate=60");
          console.timeEnd("[PERF:SERVICES] Total route execution");
          sendCachedJson(req, res, cachedPopular);
          return;
        }
      }
      if (!skipCache) {
        try {
          const cached = cache.get<{ services: unknown[] }>(cacheKey);
          if (cached != null && Array.isArray(cached.services)) {
            console.debug("[cache HIT]", cacheKey);
            res.set("Cache-Control", "public, max-age=60, stale-while-revalidate=300");
            console.timeEnd("[PERF:SERVICES] Total route execution");
            sendCachedJson(req, res, cached);
            return;
          }
        } catch (_) {
          // Cache failure must not break the request
        }
        console.debug("[cache MISS]", cacheKey);
      }

      if (typeof search === 'string' && search.trim()) {
        await storage.recordSearch(search as string);
      }

      console.time("[PERF:SERVICES] Database query execution");
      const queryStartTime = Date.now();

      // Get paginated services - only fetch what's needed (not 10,000)
      let allServices = await storage.searchServices({
        category: category as string,
        country: country as string,
        searchQuery: search as string,
        minPrice: minPrice ? parseFloat(minPrice as string) : undefined,
        maxPrice: maxPrice ? parseFloat(maxPrice as string) : undefined,
        ratingMin: minRating ? parseFloat(minRating as string) : undefined,
        planName: planName as string,
        level: level as string,
      }, limitNum, offsetNum, sortBy as string);

      let usedFallback = false;

      // ✅ FALLBACK: If country filter provided but no results, try global results
      if (allServices.length === 0 && country && String(country).trim()) {
        console.log(`[FALLBACK] No services for country=${country}, retrying with global results`);
        usedFallback = true;
        const fallbackStartTime = Date.now();
        allServices = await storage.searchServices({
          category: category as string,
          country: undefined,  // Remove country filter for fallback
          searchQuery: search as string,
          minPrice: minPrice ? parseFloat(minPrice as string) : undefined,
          maxPrice: maxPrice ? parseFloat(maxPrice as string) : undefined,
          ratingMin: minRating ? parseFloat(minRating as string) : undefined,
          planName: planName as string,
          level: level as string,
        }, limitNum, offsetNum, sortBy as string);
        const fallbackTime = Date.now() - fallbackStartTime;
        console.log(`[FALLBACK] Global query returned ${allServices.length} rows in ${fallbackTime}ms`);
      }

      const queryTime = Date.now() - queryStartTime;
      console.timeEnd("[PERF:SERVICES] Database query execution");
      console.log(`[PERF:SERVICES] Query returned ${allServices.length} rows in ${queryTime}ms`);

      // ✅ Image filtering is now done in SQL (searchServices), no post-filtering needed
      // ✅ Sorting is done in SQL (storage.searchServices), no re-sorting needed

      const masked = await Promise.all(allServices.map(async (s: any) => {
        const maskedDetective = await maskDetectiveContactsPublic(s.detective);
        const effectiveBadges = computeEffectiveBadges(s.detective, (s.detective as any).subscriptionPackage);
        return { ...s, detective: { ...maskedDetective, effectiveBadges } };
      }));

      const servicesDtos = masked.map((service: any) =>
        buildServiceCardDTO({
          service,
          detective: service.detective,
          avgRating: service.avgRating,
          reviewCount: service.reviewCount,
          maskContacts: true,
        })
      );
      
      // Only cache results that match the original request (don't cache fallback results)
      if (!skipCache && !usedFallback) {
        if (isPopularUnfiltered) {
          try {
            setServicesPopularCache(popularCacheKey, { services: servicesDtos });
          } catch (_) {
            // Cache failure must not break the request
          }
        }
        try {
          cache.set(cacheKey, { services: servicesDtos }, 60);
        } catch (_) {
          // Cache failure must not break the request
        }
      }
      
      if (!skipCache) {
        res.set("Cache-Control", "public, max-age=60, stale-while-revalidate=300");
      } else {
        // Authenticated/user-specific responses should not be cached
        res.set("Cache-Control", "private, no-store");
      }
      const totalTime = Date.now() - routeStartTime;
      console.timeEnd("[PERF:SERVICES] Total route execution");
      console.log(`[PERF:SERVICES] Total route time: ${totalTime}ms (Query: ${queryTime}ms, Mapping+Cache: ${totalTime - queryTime}ms)`);
      sendCachedJson(req, res, { services: servicesDtos });
    } catch (error) {
      console.timeEnd("[PERF:SERVICES] Total route execution");
      console.error("Search services error:", error);
      res.status(500).json({ error: "Failed to search services" });
    }
  });

  // ============== SEARCH Services (dedicated search endpoint) ==============
  app.get("/api/services/search", async (req: Request, res: Response) => {
    try {
      const { q, category, country, minPrice, maxPrice, minRating, planName, level, limit = "20", offset = "0", sortBy = "popular" } = req.query;
      const limitNum = Math.min(parseInt(limit as string) || 20, 100);
      const offsetNum = parseInt(offset as string) || 0;
      
      // Record search query if provided
      if (typeof q === 'string' && q.trim()) {
        await storage.recordSearch(q as string);
      }

      // Get paginated services
      const allServices = await storage.searchServices({
        category: category as string,
        country: country as string,
        searchQuery: q as string,
        minPrice: minPrice ? parseFloat(minPrice as string) : undefined,
        maxPrice: maxPrice ? parseFloat(maxPrice as string) : undefined,
        ratingMin: minRating ? parseFloat(minRating as string) : undefined,
        planName: planName as string,
        level: level as string,
      }, limitNum, offsetNum, sortBy as string);

      // ✅ Return 200 OK with empty array if no results (not 404)
      if (allServices.length === 0) {
        return res.json({ services: [] });
      }

      const masked = await Promise.all(allServices.map(async (s: any) => {
        const maskedDetective = await maskDetectiveContactsPublic(s.detective);
        const effectiveBadges = computeEffectiveBadges(s.detective, (s.detective as any).subscriptionPackage);
        return { ...s, detective: { ...maskedDetective, effectiveBadges } };
      }));

      const servicesDtos = masked.map((service: any) =>
        buildServiceCardDTO({
          service,
          detective: service.detective,
          avgRating: service.avgRating,
          reviewCount: service.reviewCount,
          maskContacts: true,
        })
      );
      
      res.set("Cache-Control", "public, max-age=60, stale-while-revalidate=300");
      sendCachedJson(req, res, { services: servicesDtos });
    } catch (error) {
      console.error("Search services error:", error);
      res.status(500).json({ error: "Failed to search services" });
    }
  });

  // ============== GET Service by Slug (Country/State/City/Slug) ==============
  app.get("/api/services/:country/:state/:city/:slug", async (req: Request, res: Response) => {
    try {
      const { country, state, city, slug } = req.params;

      // Convert country name/slug to country code (e.g., "india" -> "IN")
      const countryCode = getCountryCode(country);

      // Find service by slug + detective location
      // We join services with detectives to verify the location matches
      const rows = await db
        .select({
          service: services,
          detective: detectives
        })
        .from(services)
        .innerJoin(detectives, eq(services.detectiveId, detectives.id))
        .where(
          and(
            eq(services.slug, slug),
            eq(detectives.country, countryCode),
            ilike(detectives.state, state),
            ilike(detectives.city, city)
          )
        )
        .limit(1);

      if (rows.length === 0) {
        return res.status(404).json({ error: "Service not found" });
      }

      const { service, detective } = rows[0];

      // Increment view count
      await storage.incrementServiceViews(service.id);

      const maskedDetective = await maskDetectiveContactsPublic(detective);
      const effectiveBadges = computeEffectiveBadges(maskedDetective, (maskedDetective as any).subscriptionPackage);

      res.setHeader("Cache-Control", "public, s-maxage=3600, stale-while-revalidate=86400");
      res.json({
        service,
        detective: { ...maskedDetective, effectiveBadges },
        avgRating: 0, // You can fetch real stats if needed
        reviewCount: 0
      });
    } catch (error) {
      console.error("[GET /api/services/:country/:state/:city/:slug] Error:", error);
      res.status(500).json({ error: "Failed to retrieve service" });
    }
  });

  // Get service by slug (public)
  app.get("/api/services/by-slug/:slug", async (req: Request, res: Response) => {
    try {
      const slug = req.params.slug;
      const detectiveSlug = req.query.detectiveSlug as string | undefined;
      const preview = (req.query.preview === '1' || req.query.preview === 'true');

      // Helper function to generate slug from text (same as client)
      const generateSlug = (text: string): string => {
        return text
          .toString()
          .normalize("NFKD")
          .toLowerCase()
          .replace(/[\u0300-\u036f]/g, "")
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/^-+|-+$/g, "");
      };

      let rows: Array<{ service: typeof services.$inferSelect; detective: typeof detectives.$inferSelect }> = [];

      if (detectiveSlug) {
        const detectiveRows = await db
          .select({ detective: detectives })
          .from(detectives)
          .where(eq(detectives.slug, detectiveSlug))
          .limit(1);

        if (detectiveRows.length > 0) {
          const detective = detectiveRows[0].detective;
          const scopedRows = await db
            .select({
              service: services,
              detective: detectives,
            })
            .from(services)
            .innerJoin(detectives, eq(services.detectiveId, detectives.id))
            .where(
              and(
                eq(services.detectiveId, detective.id),
                or(eq(services.slug, slug), ilike(services.slug, `${slug}-%`))
              )
            )
            .limit(10);

          if (scopedRows.length > 0) {
            const exact = scopedRows.find((row) => row.service.slug === slug);
            if (exact) {
              rows = [exact];
            } else {
              const withSuffix = scopedRows
                .map((row) => ({
                  row,
                  suffix: row.service.slug.slice(slug.length + 1),
                }))
                .filter((item) => /^\d+$/.test(item.suffix))
                .sort((a, b) => Number(a.suffix) - Number(b.suffix));

              if (withSuffix.length > 0) {
                rows = [withSuffix[0].row];
              }
            }
          }
        }
      }

      if (rows.length === 0) {
        rows = await db
          .select({
            service: services,
            detective: detectives,
          })
          .from(services)
          .innerJoin(detectives, eq(services.detectiveId, detectives.id))
          .where(eq(services.slug, slug))
          .limit(1);
      }

      if (rows.length === 0) {
        return res.status(404).json({ error: "Service not found" });
      }

      const { service, detective: rawDetective } = rows[0];

      // Optional canonical guard: if detective slug is provided in URL, ensure it matches.
      if (detectiveSlug) {
        const requestedSlug = generateSlug(detectiveSlug);
        const detSlug = generateSlug(rawDetective.slug || rawDetective.businessName || "");
        if (requestedSlug && detSlug && requestedSlug !== detSlug) {
          return res.status(404).json({ error: "Service not found" });
        }
      }

      // Check access permissions
      if (preview) {
        const isOwner = req.session.userId && rawDetective.userId === req.session.userId;
        const isAdmin = req.session.userRole === 'admin';
        if (!isOwner && !isAdmin) {
          return res.status(403).json({ error: "Forbidden" });
        }
      } else {
        // Only allow public access if service is complete and active
        const hasImages = Array.isArray(service.images) && service.images.length > 0;
        const hasRequiredContent = service.isOnEnquiry 
          ? (!!service.title && !!service.description && !!service.category)
          : (hasImages && !!service.title && !!service.description && !!service.category);
        
        const isComplete = service.isActive === true && hasRequiredContent;
        if (!isComplete) {
          return res.status(404).json({ error: "Service not available" });
        }
      }

      // Increment view count
      await storage.incrementServiceViews(service.id);

      // Get detective and stats
      const maskedDetective = await maskDetectiveContactsPublic(rawDetective);
      const effectiveBadges = computeEffectiveBadges(maskedDetective, (maskedDetective as any).subscriptionPackage);

      // Get rating stats
      const ratingRows = await db
        .select({
          avgRating: avg(reviews.rating),
          reviewCount: count(reviews.id)
        })
        .from(reviews)
        .where(and(eq(reviews.serviceId, service.id), eq(reviews.isPublished, true)));

      const avgRating = ratingRows[0]?.avgRating ? parseFloat(ratingRows[0].avgRating as any) : 0;
      const reviewCount = ratingRows[0]?.reviewCount ? Number(ratingRows[0].reviewCount) : 0;

      res.json({
        service,
        detective: { ...maskedDetective, effectiveBadges },
        avgRating,
        reviewCount
      });
    } catch (error) {
      console.error("[GET /api/services/by-slug/:slug] Error:", error);
      res.status(500).json({ error: "Failed to retrieve service" });
    }
  });

  // Get service by ID (public)
  app.get("/api/services/:id", async (req: Request, res: Response) => {
    try {
      const service = await storage.getService(req.params.id);
      if (!service) {
        return res.status(404).json({ error: "Service not found" });
      }

      const preview = (req.query.preview === '1' || req.query.preview === 'true');
      if (preview) {
        const detective = await storage.getDetective(service.detectiveId);
        if (!detective) {
          return res.status(404).json({ error: "Detective not found" });
        }
        const isOwner = req.session.userId && detective.userId === req.session.userId;
        const isAdmin = req.session.userRole === 'admin';
        if (!isOwner && !isAdmin) {
          return res.status(403).json({ error: "Forbidden" });
        }
      } else {
        // Only allow public access if service is complete and active
        const hasImages = Array.isArray(service.images) && service.images.length > 0;
        
        // For Price on Enquiry services, images are optional
        // For regular services, images are required
        const hasRequiredContent = service.isOnEnquiry 
          ? (!!service.title && !!service.description && !!service.category)
          : (hasImages && !!service.title && !!service.description && !!service.category);
        
        const isComplete = service.isActive === true && hasRequiredContent && (service.isOnEnquiry || !!service.basePrice);
        if (!isComplete) {
          return res.status(404).json({ error: "Service not available" });
        }
      }

      // Increment view count
      await storage.incrementServiceViews(req.params.id);

      // Get detective info
      let detective = await storage.getDetective(service.detectiveId);
      
      // Detective must exist for the service to be accessible
      if (!detective) {
        return res.status(404).json({ error: "Service not found" });
      }

      // Get stats
      const stats = await storage.getServiceStats(req.params.id);

      if (!preview && detective) {
        detective = await maskDetectiveContactsPublic(detective as any);
      }
      const effectiveBadges = detective ? computeEffectiveBadges(detective, (detective as any).subscriptionPackage) : undefined;
      res.json({ 
        service,
        detective: detective ? { ...detective, effectiveBadges } : undefined,
        avgRating: stats.avgRating,
        reviewCount: stats.reviewCount
      });
    } catch (error) {
      console.error("Get service error:", error);
      res.status(500).json({ error: "Failed to get service" });
    }
  });

  // Create service (requires detective role)
  app.post("/api/services", requireRole("detective"), async (req: Request, res: Response) => {
    try {
      const detective = await storage.getDetectiveByUserId(req.session.userId!);
      if (!detective) {
        return res.status(400).json({ error: "Must create detective profile first" });
      }

      const validatedData = insertServiceSchema.parse({
        ...req.body,
        detectiveId: detective.id,
      });

      // If isOnEnquiry is true, prices are optional
      const isOnEnquiry = (validatedData as any).isOnEnquiry === true;
      
      const pricing = await requirePolicy<{ offerLessThanBase: boolean }>("pricing_constraints");
      if (!isOnEnquiry) {
        // basePrice is required when not on enquiry
        if (!validatedData.basePrice) {
          return res.status(400).json({ error: "Base price is required when not using Price on Enquiry" });
        }
        const base = parseFloat(validatedData.basePrice as any);
        if (!(base > 0)) {
          return res.status(400).json({ error: "Base price must be a positive number" });
        }
        const minPrice = getMinimumBasePriceForCountry(detective.country || undefined);
        if (base < minPrice.min) {
          return res.status(400).json({ error: `Minimum base price is ${minPrice.display}` });
        }
        if ((validatedData as any).offerPrice !== undefined && (validatedData as any).offerPrice !== null) {
          const offer = parseFloat((validatedData as any).offerPrice as any);
          if (!(offer > 0)) {
            return res.status(400).json({ error: "Offer price must be positive" });
          }
          if (pricing?.offerLessThanBase && !(offer < base)) {
            return res.status(400).json({ error: "Offer price must be strictly lower than base price" });
          }
        }
      }

      // Validate that the category exists and is active
      const categories = await storage.getAllServiceCategories(true);
      const categoryExists = categories.some(cat => cat.name === validatedData.category);
      if (!categoryExists) {
        return res.status(400).json({ error: "Invalid service category. Please select a valid category from the admin-managed list." });
      }

      if (Array.isArray((validatedData as any).images)) {
        (validatedData as any).images = await Promise.all(((validatedData as any).images || []).map(async (u: string, i: number) => {
          return u && u.startsWith("data:") ? await uploadDataUrl("service-images", `banners/${Date.now()}-${i}.jpg`, u) : u;
        }));
      }
      const service = await storage.createService(validatedData);
      try {
        cache.keys().filter(k => k.startsWith("services:")).forEach(k => cache.del(k));
        cache.del(`detective:public:${service.detectiveId}`);
        console.debug("[cache INVALIDATE]", "services:");
        console.debug("[cache INVALIDATE]", `detective:public:${service.detectiveId}`);
      } catch (_) {
        // Cache invalidation must not fail the request
      }
      res.status(201).json({ service });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: fromZodError(error).message });
      }
      console.error("Create service error:", error);
      res.status(500).json({ error: "Failed to create service" });
    }
  });

  // Get services by detective (public)
  app.get("/api/services/detective/:id", async (req: Request, res: Response) => {
    try {
      console.log("[DEBUG] Fetching services for detective:", req.params.id);
      const services = await storage.getServicesByDetective(req.params.id);
      const detective = await storage.getDetective(req.params.id);
      console.log("[DEBUG] Services retrieved:", services.length, "total");
      if (services.length > 0) {
        console.log("[DEBUG] First service:", { id: services[0].id, title: services[0].title, isActive: services[0].isActive });
      }
      const serviceDtos = services.map((service: any) =>
        buildServiceCardDTO({ service, detective })
      );
      // Disable caching for detective dashboard - always fetch fresh data
      res.set("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
      res.set("Pragma", "no-cache");
      res.set("Expires", "0");
      sendCachedJson(req, res, { services: serviceDtos });
    } catch (error) {
      console.error("Get services by detective error:", error);
      res.status(500).json({ error: "Failed to get services" });
    }
  });

  // Update service (requires detective role)
  app.patch("/api/services/:id", requireRole("detective", "admin"), async (req: Request, res: Response) => {
    try {
      const service = await storage.getService(req.params.id);
      if (!service) {
        return res.status(404).json({ error: "Service not found" });
      }

      // Check ownership unless admin
      if (req.session.userRole !== "admin") {
        const detective = await storage.getDetectiveByUserId(req.session.userId!);
        if (!detective || service.detectiveId !== detective.id) {
          return res.status(403).json({ error: "Cannot update another detective's service" });
        }
      }

      // Validate request body - only allow whitelisted fields
      const validatedData = updateServiceSchema.parse(req.body);
      if (Array.isArray((validatedData as any).images)) {
        (validatedData as any).images = await Promise.all(((validatedData as any).images || []).map(async (u: string, i: number) => {
          return u && u.startsWith("data:") ? await uploadDataUrl("service-images", `banners/${Date.now()}-${i}.jpg`, u) : u;
        }));
      }
      if (Array.isArray((validatedData as any).images) && Array.isArray(service.images)) {
        for (const prev of (service.images as any[])) {
          if (!(validatedData as any).images.includes(prev)) {
            await deletePublicUrl(prev as any);
          }
        }
      }

      // Check if isOnEnquiry is being set
      const isOnEnquiry = (validatedData as any).isOnEnquiry !== undefined ? (validatedData as any).isOnEnquiry : (service as any).isOnEnquiry;
      
      // Only validate pricing if isOnEnquiry is false
      if (!isOnEnquiry) {
        // For updates, basePrice can come from the update or from existing service
        const basePriceValue = validatedData.basePrice !== undefined ? validatedData.basePrice : ((service as any).basePrice);
        if (!basePriceValue) {
          return res.status(400).json({ error: "Base price is required when not using Price on Enquiry" });
        }
        const currentBase = parseFloat(basePriceValue as any);
        if (!(currentBase > 0)) {
          return res.status(400).json({ error: "Base price must be a positive number" });
        }
        // Enforce minimum price (same as in POST /api/services)
        const detective = await storage.getDetective(service.detectiveId);
        if (detective) {
          const minPrice = getMinimumBasePriceForCountry(detective.country || undefined);
          if (currentBase < minPrice.min) {
            return res.status(400).json({ error: `Minimum base price is ${minPrice.display}` });
          }
        }
        if (validatedData.offerPrice !== undefined && validatedData.offerPrice !== null) {
          const offer = parseFloat(validatedData.offerPrice as any);
          if (!(offer > 0) || !(offer < currentBase)) {
            return res.status(400).json({ error: "Offer price must be positive and strictly lower than base price" });
          }
        }
      }

      // Validate category if it's being updated
      if (validatedData.category) {
        const categories = await storage.getAllServiceCategories(true);
        const categoryExists = categories.some(cat => cat.name === validatedData.category);
        if (!categoryExists) {
          return res.status(400).json({ error: "Invalid service category. Please select a valid category from the admin-managed list." });
        }
      }

      const updatedService = await storage.updateService(req.params.id, validatedData);
      try {
        cache.keys().filter(k => k.startsWith("services:")).forEach(k => cache.del(k));
        cache.del(`detective:public:${service.detectiveId}`);
        console.debug("[cache INVALIDATE]", "services:");
        console.debug("[cache INVALIDATE]", `detective:public:${service.detectiveId}`);
      } catch (_) {
        // Cache invalidation must not fail the request
      }
      res.json({ service: updatedService });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: fromZodError(error).message });
      }
      console.error("Update service error:", error);
      res.status(500).json({ error: "Failed to update service" });
    }
  });

  // Delete service (requires detective role)
  app.delete("/api/services/:id", requireRole("detective", "admin"), async (req: Request, res: Response) => {
    try {
      const service = await storage.getService(req.params.id);
      if (!service) {
        return res.status(404).json({ error: "Service not found" });
      }

      // Check ownership unless admin
      if (req.session.userRole !== "admin") {
        const detective = await storage.getDetectiveByUserId(req.session.userId!);
        if (!detective || service.detectiveId !== detective.id) {
          return res.status(403).json({ error: "Cannot delete another detective's service" });
        }
      }

      if (Array.isArray(service.images)) {
        for (const u of (service.images as any[])) {
          await deletePublicUrl(u as any);
        }
      }
      const detectiveIdForCache = service.detectiveId;
      await storage.deleteService(req.params.id);
      try {
        cache.keys().filter(k => k.startsWith("services:")).forEach(k => cache.del(k));
        cache.del(`detective:public:${detectiveIdForCache}`);
        console.debug("[cache INVALIDATE]", "services:");
        console.debug("[cache INVALIDATE]", `detective:public:${detectiveIdForCache}`);
      } catch (_) {
        // Cache invalidation must not fail the request
      }
      res.json({ message: "Service deleted successfully" });
    } catch (error) {
      console.error("Delete service error:", error);
      res.status(500).json({ error: "Failed to delete service" });
    }
  });

  // Admin: reassign a service to a detective
  app.post("/api/admin/services/:id/reassign", requireRole("admin"), async (req: Request, res: Response) => {
    try {
      const { detectiveId } = req.body as { detectiveId?: string };
      if (!detectiveId) return res.status(400).json({ error: "detectiveId is required" });
      const detective = await storage.getDetective(detectiveId);
      if (!detective) return res.status(404).json({ error: "Detective not found" });
      const service = await storage.getService(req.params.id);
      if (!service) return res.status(404).json({ error: "Service not found" });
      const updated = await storage.reassignService(service.id, detective.id);
      res.json({ service: updated });
    } catch (error) {
      console.error("Admin reassign service error:", error);
      res.status(500).json({ error: "Failed to reassign service" });
    }
  });

  // Admin: list all services for a detective (includes inactive or missing images)
  app.get("/api/admin/detectives/:id/services", requireRole("admin"), async (req: Request, res: Response) => {
    try {
      const detective = await storage.getDetective(req.params.id);
      if (!detective) {
        return res.status(404).json({ error: "Detective not found" });
      }
      const services = await storage.getAllServicesByDetective(detective.id);
      res.json({ services });
    } catch (error) {
      console.error("Admin get services by detective error:", error);
      res.status(500).json({ error: "Failed to get services" });
    }
  });

  app.post("/api/admin/detectives/:id/services", requireRole("admin"), async (req: Request, res: Response) => {
    try {
      const detective = await storage.getDetective(req.params.id);
      if (!detective) {
        return res.status(404).json({ error: "Detective not found" });
      }

      const currentServices = await storage.getServicesByDetective(detective.id);
      const maxAllowed = await getServiceLimit(detective);
      if (currentServices.length >= maxAllowed) {
        return res.status(400).json({ error: `Limit reached. Max ${maxAllowed} services allowed.` });
      }

      const validatedData = insertServiceSchema.parse({
        ...req.body,
        detectiveId: detective.id,
      });

      const base = parseFloat(validatedData.basePrice as any);
      if (!(base > 0)) {
        return res.status(400).json({ error: "Base price must be a positive number" });
      }
      if ((validatedData as any).offerPrice !== undefined && (validatedData as any).offerPrice !== null) {
        const offer = parseFloat((validatedData as any).offerPrice as any);
        if (!(offer > 0) || !(offer < base)) {
          return res.status(400).json({ error: "Offer price must be positive and strictly lower than base price" });
        }
      }

      const categories = await storage.getAllServiceCategories(true);
      const categoryExists = categories.some(cat => cat.name === validatedData.category);
      if (!categoryExists) {
        return res.status(400).json({ error: "Invalid service category" });
      }

      const service = await storage.createService(validatedData);
      res.status(201).json({ service });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: fromZodError(error).message });
      }
      console.error("Admin create service error:", error);
      res.status(500).json({ error: "Failed to create service" });
    }
  });

  // Onboarding: bulk create services for detective (first login)
  app.post("/api/detectives/:id/onboarding/services", requireRole("detective"), async (req: Request, res: Response) => {
    try {
      const detective = await storage.getDetective(req.params.id);
      if (!detective) return res.status(404).json({ error: "Detective not found" });
      if (detective.userId !== req.session.userId) return res.status(403).json({ error: "Unauthorized" });

      const body = req.body as { services: Array<{ category: string; title: string; description: string; basePrice: string; offerPrice?: string | null; images?: string[] }> };
      const drafts = Array.isArray(body.services) ? body.services : [];
      if (drafts.length === 0) return res.status(400).json({ error: "No services provided" });

      const maxAllowed = await getServiceLimit(detective);
      const limits = { min: 1, max: maxAllowed };
      if (drafts.length < limits.min) {
        return res.status(400).json({ error: `Must submit at least ${limits.min} services` });
      }
      if (drafts.length > limits.max) {
        return res.status(400).json({ error: `You can submit up to ${limits.max} services. Upgrade your package for more.` });
      }

      // Validate categories against active list
      const activeCategories = await storage.getAllServiceCategories(true);
      const activeNames = new Set(activeCategories.map(c => c.name));

      for (const d of drafts) {
        if (!d.category || !activeNames.has(d.category)) {
          return res.status(400).json({ error: `Invalid category: ${d.category}` });
        }
        if (!d.title || !d.description || !d.basePrice) {
          return res.status(400).json({ error: "Title, description and base price are required" });
        }
        if (!Array.isArray(d.images) || d.images.length === 0) {
          return res.status(400).json({ error: "Banner image is required" });
        }
        // Parse with insert schema
        const validated = insertServiceSchema.parse({
          detectiveId: detective.id,
          category: d.category,
          title: d.title,
          description: d.description,
          basePrice: d.basePrice,
          offerPrice: d.offerPrice ?? null,
          images: d.images,
          isActive: true,
        });
        const base = parseFloat(validated.basePrice as any);
        if (!(base > 0)) {
          return res.status(400).json({ error: "Base price must be a positive number" });
        }
        const minPrice = getMinimumBasePriceForCountry(detective.country || undefined);
        if (base < minPrice.min) {
          return res.status(400).json({ error: `Minimum base price is ${minPrice.display}` });
        }
        if ((validated as any).offerPrice !== undefined && (validated as any).offerPrice !== null) {
          const offer = parseFloat((validated as any).offerPrice as any);
          if (!(offer > 0) || !(offer < base)) {
            return res.status(400).json({ error: "Offer price must be positive and strictly lower than base price" });
          }
        }
        if (Array.isArray((validated as any).images)) {
          (validated as any).images = await Promise.all(((validated as any).images || []).map(async (u: string, j: number) => {
            return u && u.startsWith("data:") ? await uploadDataUrl("service-images", `banners/${Date.now()}-${j}.jpg`, u) : u;
          }));
        }
        await storage.createService(validated);
      }

      await storage.updateDetective(detective.id, { mustCompleteOnboarding: false });
      res.json({ ok: true });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: fromZodError(error).message });
      }
      console.error("Onboarding services error:", error);
      res.status(500).json({ error: "Failed to create onboarding services" });
    }
  });

  // ============== REVIEW ROUTES ==============

  // Get reviews for a service (public)
  app.get("/api/services/:id/reviews", async (req: Request, res: Response) => {
    try {
      const { limit = "50" } = req.query;
      const reviews = await storage.getReviewsByService(req.params.id, parseInt(limit as string));
      res.json({ reviews });
    } catch (error) {
      console.error("Get reviews error:", error);
      res.status(500).json({ error: "Failed to get reviews" });
    }
  });

  // Detective: get all reviews for my services (authenticated - dashboard data)
  app.get("/api/reviews/detective", requireAuth, async (req: Request, res: Response) => {
    try {
      setNoStore(res);
      const detective = await storage.getDetectiveByUserId(req.session.userId!);
      if (!detective) return res.status(404).json({ error: "Detective profile not found" });
      const list = await storage.getReviewsByDetective(detective.id);
      res.json({ reviews: list });
    } catch (error) {
      console.error("Get detective reviews error:", error);
      res.status(500).json({ error: "Failed to get reviews" });
    }
  });

  // Create review (requires authentication)
  app.post("/api/reviews", requireAuth, async (req: Request, res: Response) => {
    try {
      const validatedData = insertReviewSchema.parse({
        ...req.body,
        userId: req.session.userId,
      });

      const existing = await storage.getReviewsByService(validatedData.serviceId, 1000);
      const own = existing.find(r => (r as any).userId === req.session.userId);
      if (own) {
        const updated = await storage.updateReview(own.id, validatedData);
        return res.json({ review: updated });
      }

      const review = await storage.createReview({ ...validatedData, isPublished: true } as any);
      res.status(201).json({ review });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: fromZodError(error).message });
      }
      console.error("Create review error:", error);
      res.status(500).json({ error: "Failed to create review" });
    }
  });

  // Update review (requires user ownership)
  app.patch("/api/reviews/:id", requireAuth, async (req: Request, res: Response) => {
    try {
      const review = await storage.getReview(req.params.id);
      if (!review) {
        return res.status(404).json({ error: "Review not found" });
      }

      // Check ownership unless admin
      if (req.session.userRole !== "admin" && review.userId !== req.session.userId) {
        return res.status(403).json({ error: "Cannot update another user's review" });
      }

      // Validate request body - only allow whitelisted fields
      const validatedData = updateReviewSchema.parse(req.body);
      const updatedReview = await storage.updateReview(req.params.id, validatedData);
      res.json({ review: updatedReview });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: fromZodError(error).message });
      }
      console.error("Update review error:", error);
      res.status(500).json({ error: "Failed to update review" });
    }
  });

  // Delete review (requires user ownership or admin)
  app.delete("/api/reviews/:id", requireAuth, async (req: Request, res: Response) => {
    try {
      const review = await storage.getReview(req.params.id);
      if (!review) {
        return res.status(404).json({ error: "Review not found" });
      }

      if (req.session.userRole !== "admin" && review.userId !== req.session.userId) {
        return res.status(403).json({ error: "Cannot delete another user's review" });
      }

      await storage.deleteReview(req.params.id);
      res.json({ message: "Review deleted successfully" });
    } catch (error) {
      console.error("Delete review error:", error);
      res.status(500).json({ error: "Failed to delete review" });
    }
  });

  // ============== ORDER ROUTES ==============
  // Apply session middleware to orders endpoints

  // Get user's orders (authenticated - user-specific data)
  app.get("/api/orders/user", requireAuth, async (req: Request, res: Response) => {
    try {
      setNoStore(res);
      const { limit = "50", offset = "0" } = req.query;
      const limitNum = Math.min(Math.max(1, parseInt(limit as string) || 50), 100);
      const offsetNum = Math.max(0, parseInt(offset as string) || 0);
      const orders = await storage.getOrdersByUser(req.session.userId!, limitNum, offsetNum);
      res.json({ orders });
    } catch (error) {
      console.error("Get user orders error:", error);
      res.status(500).json({ error: "Failed to get orders" });
    }
  });

  // Get detective's orders (OPTIMIZED: single JOIN query instead of two sequential queries)
  app.get("/api/orders/detective", requireRole("detective"), async (req: Request, res: Response) => {
    try {
      const { limit = "50", offset = "0" } = req.query;
      const limitNum = Math.min(Math.max(1, parseInt(limit as string) || 50), 100);
      const offsetNum = Math.max(0, parseInt(offset as string) || 0);
      
      // Single optimized query using JOIN - no need to fetch detective first
      const orders = await storage.getOrdersByDetectiveUserId(req.session.userId!, limitNum, offsetNum);
      res.json({ orders });
    } catch (error) {
      console.error("Get detective orders error:", error);
      res.status(500).json({ error: "Failed to get orders" });
    }
  });

  // Create order (requires authentication)
  app.post("/api/orders", requireAuth, async (req: Request, res: Response) => {
    try {
      const service = await storage.getService(req.body.serviceId);
      if (!service) {
        return res.status(404).json({ error: "Service not found" });
      }

      const validatedData = insertOrderSchema.parse({
        ...req.body,
        userId: req.session.userId,
        detectiveId: service.detectiveId,
      });

      const order = await storage.createOrder(validatedData);
      res.status(201).json({ order });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: fromZodError(error).message });
      }
      console.error("Create order error:", error);
      res.status(500).json({ error: "Failed to create order" });
    }
  });

  // Update order
  app.patch("/api/orders/:id", requireAuth, async (req: Request, res: Response) => {
    try {
      const order = await storage.getOrder(req.params.id);
      if (!order) {
        return res.status(404).json({ error: "Order not found" });
      }

      // Check if user is buyer or seller
      const detective = await storage.getDetectiveByUserId(req.session.userId!);
      const isOwner = order.userId === req.session.userId;
      const isDetective = detective && order.detectiveId === detective.id;

      if (!isOwner && !isDetective && req.session.userRole !== "admin") {
        return res.status(403).json({ error: "Cannot update this order" });
      }

      if ("status" in req.body && req.session.userRole !== "admin") {
        return res.status(403).json({ error: "Status changes are admin-only" });
      }

      // Validate request body - only allow whitelisted fields
      const validatedData = updateOrderSchema.parse(req.body);
      // Type assertion is safe because storage.updateOrder handles string-to-Date conversion internally
      const updatedOrder = await storage.updateOrder(req.params.id, validatedData as any);
      res.json({ order: updatedOrder });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: fromZodError(error).message });
      }
      console.error("Update order error:", error);
      res.status(500).json({ error: "Failed to update order" });
    }
  });

  // ============== FAVORITE ROUTES ==============

  // Get user's favorites (authenticated - user-specific data)
  app.get("/api/favorites", requireAuth, async (req: Request, res: Response) => {
    try {
      setNoStore(res);
      const favorites = await storage.getFavoritesByUser(req.session.userId!);
      res.json({ favorites });
    } catch (error) {
      console.error("Get favorites error:", error);
      res.status(500).json({ error: "Failed to get favorites" });
    }
  });

  // Add favorite
  app.post("/api/favorites", requireAuth, async (req: Request, res: Response) => {
    try {
      const validatedData = insertFavoriteSchema.parse({
        userId: req.session.userId,
        serviceId: req.body.serviceId,
      });

      const favorite = await storage.addFavorite(validatedData);
      res.status(201).json({ favorite });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: fromZodError(error).message });
      }
      console.error("Add favorite error:", error);
      res.status(500).json({ error: "Failed to add favorite" });
    }
  });

  // Remove favorite
  app.delete("/api/favorites/:serviceId", requireAuth, async (req: Request, res: Response) => {
    try {
      await storage.removeFavorite(req.session.userId!, req.params.serviceId);
      res.json({ message: "Favorite removed successfully" });
    } catch (error) {
      console.error("Remove favorite error:", error);
      res.status(500).json({ error: "Failed to remove favorite" });
    }
  });

  // ============== DETECTIVE APPLICATION ROUTES ==============

  // Submit detective application (public)
  app.post("/api/applications", async (req: Request, res: Response) => {
    try {
      console.log("📝 [Applications] Received POST request");
      console.log("📝 [Applications] Request size:", JSON.stringify(req.body).length, "bytes");
      
      // Check if user is admin
      const isAdmin = req.session?.userRole === 'admin';

      const validatedData = insertDetectiveApplicationSchema.parse(req.body);
      console.log("📝 [Applications] Validation passed");
      const hashedPassword = await bcrypt.hash(validatedData.password, 10);
      
      // Duplicate checks for email/phone
      const existingByEmail = await storage.getDetectiveApplicationByEmail(validatedData.email);
      const hasPhone = !!validatedData.phoneCountryCode && !!validatedData.phoneNumber;
      const existingByPhone = hasPhone
        ? await storage.getDetectiveApplicationByPhone(validatedData.phoneCountryCode!, validatedData.phoneNumber!)
        : undefined;

      // Check for duplicates - allow update if admin, else reject
      if (existingByEmail || existingByPhone) {
        if (!isAdmin) {
          const conflictField = existingByEmail ? "email" : "phone";
          console.log("📝 [Applications] Duplicate found:", conflictField);
          return res.status(409).json({ error: `An application with this ${conflictField} already exists` });
        }
        const existing = existingByEmail || existingByPhone!;
        console.log("Duplicate found. Admin updating existing application:", existing.id);
        const updated = await storage.updateDetectiveApplication(existing.id, {
          ...validatedData,
          password: hashedPassword,
          isClaimable: validatedData.isClaimable ?? true,
          status: "pending",
          reviewNotes: null as any,
          reviewedBy: null as any,
          reviewedAt: null as any,
        } as any);
        return res.status(200).json({ application: updated });
      }

      const applicationData = {
        ...validatedData,
        password: hashedPassword,
      };
      
      console.log("📝 [Applications] Inserting into database...");
      const application = await storage.createDetectiveApplication(applicationData);
      console.log("📝 [Applications] Application created with ID:", application.id);
      
      // Send application confirmation email (non-blocking)
      smtpEmailService.sendTransactionalEmail(
        application.email,
        EMAIL_TEMPLATE_KEYS.DETECTIVE_APPLICATION_SUBMITTED,
        {
          detectiveName: application.fullName,
          email: application.email,
          supportEmail: "support@askdetectives.com",
        }
      ).catch(err => console.error("[Email] Failed to send application confirmation:", err));

      // Send admin notification (non-blocking)
      smtpEmailService.sendAdminEmail(
        EMAIL_TEMPLATE_KEYS.ADMIN_APPLICATION_RECEIVED,
        {
          detectiveName: application.fullName,
          email: application.email,
          country: application.country || "Not specified",
          businessType: application.businessType || "Not specified",
          supportEmail: "support@askdetectives.com",
        }
      ).catch(err => console.error("[Email] Failed to send admin notification:", err));
      
      res.status(201).json({ application });
    } catch (error) {
      console.error("=== APPLICATION CREATION ERROR ===");
      console.error("Error type:", error?.constructor?.name);
      console.error("Full error:", error);
      
      if (error instanceof z.ZodError) {
        console.error("❌ Validation error:", fromZodError(error).message);
        return res.status(400).json({ error: fromZodError(error).message });
      }
      
      console.error("❌ Create application error:", error);
      const msg = (typeof (error as any)?.message === "string" && (error as any).message.includes("duplicate key"))
        ? "An application with this email/phone already exists"
        : "Failed to create application";
      res.status(500).json({ error: msg });
    }
  });

  // Get all applications (admin only)
  app.get("/api/applications", requireRole("admin"), async (req: Request, res: Response) => {
    try {
      const { status, limit = "50", offset = "0", search } = req.query;
      const applications = await storage.getAllDetectiveApplications(
        status as string,
        parseInt(limit as string),
        parseInt(offset as string),
        (search as string) || undefined
      );
      res.json({ applications });
    } catch (error) {
      console.error("Get applications error:", error);
      res.status(500).json({ error: "Failed to get applications" });
    }
  });

  // Update application (admin only)
  app.patch("/api/applications/:id", requireRole("admin"), async (req: Request, res: Response) => {
    try {
      // Only allow status and reviewNotes to be updated
      const allowedData = z.object({
        status: z.enum(["pending", "under_review", "approved", "rejected"]).optional(),
        reviewNotes: z.string().optional(),
      }).strict().parse(req.body);

      // If approving application, create user account and detective profile
      if (allowedData.status === "approved") {
        const application = await storage.getDetectiveApplication(req.params.id);
        if (!application) {
          return res.status(404).json({ error: "Application not found" });
        }

        // Check if application was already approved (prevent duplicate accounts)
        if (application.status === "approved") {
          return res.status(400).json({ error: "Application already approved" });
        }

        try {
          const normalizedEmail = (application.email || "").toLowerCase().trim();
          if (!normalizedEmail) {
            return res.status(400).json({ error: "Application has no email. Cannot create account." });
          }
          // Application password may be missing in some flows (e.g. admin-created); use temp password if so
          let passwordToUse = application.password;
          if (!passwordToUse || typeof passwordToUse !== "string" || passwordToUse.trim().length === 0) {
            const tempPassword = randomBytes(16).toString("hex");
            passwordToUse = await bcrypt.hash(tempPassword, 10);
            console.log(`[APPLICATION_APPROVE] Application ${req.params.id} had no password; created user with temporary password (applicant must use password reset).`);
          }
          let user = await storage.getUserByEmail(normalizedEmail);
          if (!user) {
            try {
              user = await storage.createUserFromHashed({
                email: normalizedEmail,
                name: application.fullName,
                password: passwordToUse,
                role: "detective",
                avatar: application.logo || undefined,
              });
            } catch (e: any) {
              if ((e?.message || "").includes("users_email_unique") || (e?.code === "23505" && (e?.detail || "").includes("email"))) {
                user = await storage.getUserByEmail(normalizedEmail);
              } else {
                throw e;
              }
            }
          }

          // Build location string from application data (for backward compatibility)
          const locationParts = [];
          if (application.city) locationParts.push(application.city);
          if (application.state) locationParts.push(application.state);
          const location = locationParts.length > 0 ? locationParts.join(", ") : "Not specified";
          const stateValue = application.state || "Not specified";
          const cityValue = application.city || "Not specified";

          // Build phone number
          const phone = application.phoneCountryCode && application.phoneNumber 
            ? `${application.phoneCountryCode}${application.phoneNumber}`
            : undefined;
          const agencyBusinessDocument = Array.isArray(application.businessDocuments)
            ? application.businessDocuments[0]
            : undefined;
          const individualIdentityDocument = Array.isArray(application.documents)
            ? application.documents[0]
            : undefined;

          // Check if phone already exists in detectives table (phone uniqueness constraint)
          if (phone) {
            const existingWithPhone = await db
              .select()
              .from(detectives)
              .where(eq(detectives.phone, phone))
              .limit(1);
            
            if (existingWithPhone.length > 0) {
              return res.status(409).json({ error: "A detective with this phone number already exists" });
            }
          }

          // Create detective profile with ALL application data
          // Determine if this is admin-created or self-registered
          const isAdminCreated = application.isClaimable === true;
          const freePlanId = await getFreePlanId();
          const postApprovalStatusPolicy = (await requirePolicy<{ value: string }>("post_approval_status"))?.value;
          const postApprovalStatus: "pending" | "active" | "suspended" | "inactive" =
            postApprovalStatusPolicy === "pending" || postApprovalStatusPolicy === "active" || postApprovalStatusPolicy === "suspended" || postApprovalStatusPolicy === "inactive"
              ? postApprovalStatusPolicy
              : "active";
          
          let detective = await storage.getDetectiveByUserId(user!.id);
          if (!detective) {
            // DEFENSIVE CHECK: Business name is required for slug generation
            const businessName = application.companyName || application.fullName;
            if (!businessName || businessName.trim() === "") {
              return res.status(400).json({ error: "Business/company name is required" });
            }

            // Generate unique slug from business name
            const baseSlug = generateSlug(businessName);
            const uniqueSlug = await storage.ensureUniqueDetectiveSlug(baseSlug);

            // Resolve location IDs (REQUIRED - database has NOT NULL constraints)
            let locationIds: LocationService.ResolvedLocationIds;
            try {
              locationIds = await LocationService.resolveLocationIds(
                application.country || "US",
                stateValue,
                cityValue
              );
            } catch (error) {
              console.error("[Application Approval] Location resolution failed, using defaults:", error);
              locationIds = await LocationService.getDefaultLocationIds();
            }

            detective = await storage.createDetective({
              userId: user!.id,
              businessName: businessName,
              slug: uniqueSlug,
              bio: application.about || "Professional detective ready to help with your case.",
              logo: application.logo || undefined,
              defaultServiceBanner: (application as any).banner || undefined,
              subscriptionPackageId: freePlanId,
              status: postApprovalStatus,
              isVerified: true,
              isClaimed: false,
              isClaimable: isAdminCreated ? true : false,
              createdBy: isAdminCreated ? "admin" : "self",
              country: application.country || "US",
              state: stateValue,
              city: cityValue,
              countryId: locationIds.countryId!,
              stateId: locationIds.stateId!,
              cityId: locationIds.cityId!,
              location: location,
              address: (application as any).fullAddress || undefined,
              pincode: (application as any).pincode || undefined,
              phone: phone,
              yearsExperience: application.yearsExperience || undefined,
              businessWebsite: application.businessWebsite || undefined,
              licenseNumber: application.licenseNumber || undefined,
              businessType: application.businessType || undefined,
              businessDocuments: application.businessType === 'agency' ? agencyBusinessDocument : undefined,
              identityDocuments: application.businessType === 'individual' ? individualIdentityDocument : undefined,
              mustCompleteOnboarding: !(application.serviceCategories && application.categoryPricing && application.serviceCategories.length > 0),
              onboardingPlanSelected: false,
            });
          } else {
            await storage.updateDetectiveAdmin(detective.id, {
              defaultServiceBanner: (application as any).banner || detective.defaultServiceBanner || undefined,
              status: postApprovalStatus,
              isVerified: true,
              isClaimed: detective.isClaimed ?? false,
              isClaimable: isAdminCreated ? true : false,
            });
          }

          // 🔴 AUTO-CREATE SERVICES: Only if application has valid service categories
          if (application.serviceCategories && Array.isArray(application.serviceCategories) && application.serviceCategories.length > 0) {
            const existingServices = await storage.getAllServicesByDetective(detective.id);
            if (existingServices.length > 0) {
              console.log(`[AUTO-SERVICE-CREATE] ℹ️  Detective already has ${existingServices.length} service(s). Skipping auto-create.`);
            } else {
              const pricingData = (application.categoryPricing || []) as Array<{category: string; price?: string; currency: string; isOnEnquiry?: boolean}>;
              
              // Log for debugging
              console.log(`[AUTO-SERVICE-CREATE] Detective: ${detective.id} (${application.fullName})`);
              console.log(`[AUTO-SERVICE-CREATE] serviceCategories: ${JSON.stringify(application.serviceCategories)}`);
              console.log(`[AUTO-SERVICE-CREATE] categoryPricing: ${JSON.stringify(pricingData)}`);
              console.log(`[AUTO-SERVICE-CREATE] Total categories to process: ${application.serviceCategories.length}`);
              
              // Deduplicate categories (prevent same category from being processed twice)
              const uniqueCategories = [...new Set(application.serviceCategories)];
              if (uniqueCategories.length !== application.serviceCategories.length) {
                console.warn(`[AUTO-SERVICE-CREATE] ⚠️  Duplicates detected in serviceCategories! Original: ${application.serviceCategories.length}, Unique: ${uniqueCategories.length}`);
              }
              
              let servicesCreated = 0;
              for (const category of uniqueCategories) {
                if (!category || typeof category !== 'string') {
                  console.warn(`[AUTO-SERVICE-CREATE] ⚠️  Skipping invalid category: ${JSON.stringify(category)}`);
                  continue;
                }
                
                const pricing = pricingData.find(p => p?.category === category);
                if (!pricing) {
                  console.warn(`[AUTO-SERVICE-CREATE] ⚠️  No pricing data found for category: ${category}`);
                  continue;
                }
                
                const isOnEnquiry = pricing.isOnEnquiry === true;
                if (!isOnEnquiry && !pricing.price) {
                  console.warn(`[AUTO-SERVICE-CREATE] ⚠️  No price found for category (not on-enquiry): ${category}`);
                  continue;
                }
                
                // Check if service already exists
                const existing = await storage.getServiceByDetectiveAndCategory(detective.id, category);
                if (existing) {
                  console.log(`[AUTO-SERVICE-CREATE] ℹ️  Service already exists for category: ${category}, skipping`);
                  continue;
                }
                
                // Create the service
                try {
                  const bannerImage = typeof (application as { banner?: unknown }).banner === "string"
                    ? (application as { banner: string }).banner
                    : undefined;
                  await storage.createService({
                    detectiveId: detective.id,
                    category,
                    slug: generateSlug(`${detective.id}-${category}-services`),
                    title: `${category} Services`,
                    description: `Professional ${category.toLowerCase()} services by ${application.fullName}. Contact for detailed consultation.`,
                    basePrice: isOnEnquiry ? null : (pricing.price || null),
                    images: bannerImage ? [bannerImage] : undefined,
                    isActive: true,
                    isOnEnquiry: isOnEnquiry,
                  });
                  servicesCreated++;
                  console.log(`[AUTO-SERVICE-CREATE] ✅ Created service for category: ${category} (isOnEnquiry: ${isOnEnquiry})`);
                } catch (serviceError: any) {
                  console.error(`[AUTO-SERVICE-CREATE] ❌ Failed to create service for ${category}:`, serviceError?.message);
                }
              }
              
              console.log(`[AUTO-SERVICE-CREATE] 📊 SUMMARY: ${servicesCreated} service(s) created out of ${uniqueCategories.length} unique categories`);
            }
          } else {
            console.log(`[AUTO-SERVICE-CREATE] ℹ️  No service categories to auto-create (serviceCategories: ${JSON.stringify(application.serviceCategories)})`);
          }

          console.log(`Detective account ${user ? "linked/created" : "unknown"} for: ${normalizedEmail} with ${application.serviceCategories?.length || 0} services.`);
        } catch (createError: any) {
          console.error("Failed to create detective account:", createError);
          const message = createError?.message || String(createError);
          
          // Handle specific constraint violations
          if ((message.includes("detectives_phone_unique") || message.includes("duplicate key")) && message.includes("phone")) {
            return res.status(409).json({ 
              error: "A detective with this phone number already exists",
            });
          }
          if ((message.includes("users_email_unique") || message.includes("duplicate key")) && message.includes("email")) {
            return res.status(409).json({ 
              error: "A detective with this email already exists",
            });
          }
          
          return res.status(500).json({ 
            error: message.includes("FREE plan") ? message : `Failed to create detective account: ${message}`,
          });
        }
      }

      if (allowedData.status === "approved") {
        // Send approval email (non-blocking)
        const application = await storage.getDetectiveApplication(req.params.id);
        if (application) {
          smtpEmailService.sendTransactionalEmail(
            application.email,
            EMAIL_TEMPLATE_KEYS.DETECTIVE_APPLICATION_APPROVED,
            {
              detectiveName: application.fullName,
              email: application.email,
              supportEmail: "support@askdetectives.com",
            }
          ).catch(err => console.error("[Email] Failed to send approval email:", err));

          // If this is a claimable account, send claim invitation email
          if (application.isClaimable && application.email) {
            try {
              const userForClaim = await storage.getUserByEmail((application.email || "").toLowerCase().trim());
              // Generate secure claim token (48-hour expiry)
              const { token, hash } = generateClaimToken();
              const expiresAt = new Date(calculateTokenExpiry());

              // Get the detective that was just created
              const detective = await db
                .select()
                .from(detectives)
                .where(eq(detectives.userId, userForClaim?.id || ""))
                .limit(1)
                .then(r => r[0]);

              if (detective) {
                // Store claim token hash in database
                await db.insert(claimTokens).values({
                  detectiveId: detective.id,
                  tokenHash: hash,
                  expiresAt: expiresAt,
                });

                // Build claim URL and send invitation email
                const claimUrl = buildClaimUrl(token, config.baseUrl || "https://askdetectives.com");
                smtpEmailService.sendTransactionalEmail(
                  application.email,
                  EMAIL_TEMPLATE_KEYS.CLAIMABLE_ACCOUNT_INVITATION,
                  {
                    detectiveName: application.fullName,
                    claimLink: claimUrl,
                    supportEmail: "support@askdetectives.com",
                  }
                ).catch(err => console.error("[Email] Failed to send claim invitation:", err));

                console.log("[Claim] Sent invitation email");
              }
            } catch (claimError: any) {
              console.error("[Claim] Error sending claim invitation:", claimError);
              // Non-blocking: Don't fail approval if claim email fails
            }
          }
        }
        await storage.deleteDetectiveApplication(req.params.id);
        return res.json({ application: null });
      }

      if (allowedData.status === "rejected") {
        // Send rejection email (non-blocking)
        const application = await storage.getDetectiveApplication(req.params.id);
        if (application) {
          smtpEmailService.sendTransactionalEmail(
            application.email,
            EMAIL_TEMPLATE_KEYS.DETECTIVE_APPLICATION_REJECTED,
            {
              detectiveName: application.fullName,
              email: application.email,
              rejectionReason: allowedData.reviewNotes || "Your application did not meet our requirements.",
              supportEmail: "support@askdetectives.com",
            }
          ).catch(err => console.error("[Email] Failed to send rejection email:", err));
        }
        await storage.deleteDetectiveApplication(req.params.id);
        return res.json({ application: null });
      }
      
      const application = await storage.updateDetectiveApplication(req.params.id, {
        ...allowedData,
        reviewedBy: req.session.userId,
        reviewedAt: new Date(),
      });
      res.json({ application });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: fromZodError(error).message });
      }
      console.error("Update application error:", error);
      res.status(500).json({ error: "Failed to update application" });
    }
  });

  app.get("/api/applications/:id", requireRole("admin"), async (req: Request, res: Response) => {
    try {
      const { id } = req.params as { id: string };
      const application = await storage.getDetectiveApplication(id);
      if (!application) {
        return res.status(404).json({ error: "Application not found" });
      }
      res.json({ application });
    } catch (error) {
      console.error("Get application by id error:", error);
      res.status(500).json({ error: "Failed to get application" });
    }
  });

  // ============== PROFILE CLAIM ROUTES ==============

  // Submit profile claim (public)
  app.post("/api/claims", async (req: Request, res: Response) => {
    try {
      const validatedData = insertProfileClaimSchema.parse(req.body);
      const claim = await storage.createProfileClaim(validatedData);
      res.status(201).json({ claim });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: fromZodError(error).message });
      }
      console.error("Create claim error:", error);
      res.status(500).json({ error: "Failed to create claim" });
    }
  });

  // Get all claims (admin only)
  app.get("/api/claims", requireRole("admin"), async (req: Request, res: Response) => {
    try {
      const { status, limit = "50" } = req.query;
      const claims = await storage.getAllProfileClaims(status as string, parseInt(limit as string));
      res.json({ claims });
    } catch (error) {
      console.error("Get claims error:", error);
      if (config.env.isProd) {
        res.status(500).json({ error: "Failed to get claims" });
      } else {
        res.json({ claims: [] });
      }
    }
  });

  // Update claim (admin only)
  app.patch("/api/claims/:id", requireRole("admin"), async (req: Request, res: Response) => {
    try {
      // Only allow status and reviewNotes to be updated
      const allowedData = z.object({
        status: z.enum(["pending", "under_review", "approved", "rejected"]).optional(),
        reviewNotes: z.string().optional(),
      }).strict().parse(req.body);

      // If approving claim, use the storage method to handle ownership transfer atomically
      if (allowedData.status === "approved") {
        try {
          const result = await storage.approveProfileClaim(req.params.id, req.session.userId!);
          
          // Build appropriate messaging based on whether user was newly created or existing
          let adminMessage: string;
          if (result.wasNewUser) {
            adminMessage = `Claim approved. A new detective user was created for ${result.email}. Share the temporary password securely and ask them to reset after first login.`;
          } else {
            adminMessage = `Claim approved. ${result.email} now owns the detective profile. Ask them to log out and back in to access the detective dashboard.`;
          }

          const claimedDetective = await storage.getDetective(result.claim.detectiveId);
          
          // Send legacy email (keep for backward compatibility) - do not block approval
          try {
            await sendClaimApprovedEmail({
              to: result.email,
              detectiveName: claimedDetective?.businessName || "Detective",
              wasNewUser: result.wasNewUser,
              temporaryPassword: result.temporaryPassword,
            });
          } catch (emailError) {
            console.error("[Email] Failed to send claim approval email:", emailError);
          }

          // Send email (non-blocking)
          if (result.wasNewUser && result.temporaryPassword) {
            smtpEmailService.sendTransactionalEmail(
              result.email,
              EMAIL_TEMPLATE_KEYS.PROFILE_CLAIM_TEMPORARY_PASSWORD,
              {
                detectiveName: claimedDetective?.businessName || "Detective",
                email: result.email,
                temporaryPassword: result.temporaryPassword,
                supportEmail: "support@askdetectives.com",
              }
            ).catch(err => console.error("[Email] Failed to send temporary password email:", err));
          } else {
            smtpEmailService.sendTransactionalEmail(
              result.email,
              EMAIL_TEMPLATE_KEYS.PROFILE_CLAIM_APPROVED,
              {
                detectiveName: claimedDetective?.businessName || "Detective",
                email: result.email,
                supportEmail: "support@askdetectives.com",
              }
            ).catch(err => console.error("[Email] Failed to send claim approval email:", err));
          }

          return res.json({ 
            claim: result.claim,
            message: adminMessage,
            wasNewUser: result.wasNewUser,
            email: result.email,
            temporaryPassword: result.temporaryPassword,
          });
        } catch (approvalError: any) {
          console.error("Failed to approve claim:", approvalError);
          return res.status(500).json({ 
            error: approvalError.message || "Failed to approve claim",
          });
        }
      }

      // For non-approval status updates (rejected, under_review), just update the claim
      const claim = await storage.updateProfileClaim(req.params.id, {
        ...allowedData,
        reviewedBy: req.session.userId,
        reviewedAt: new Date(),
      });
      
      if (!claim) {
        return res.status(404).json({ error: "Claim not found" });
      }
      
      res.json({ claim });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: fromZodError(error).message });
      }
      console.error("Update claim error:", error);
      res.status(500).json({ error: "Failed to update claim" });
    }
  });

  // ============== CLAIM ACCOUNT ROUTES (Admin-Created Accounts) ==============

  // Verify claim token (public - no auth required)
  app.post("/api/claim-account/verify", async (req: Request, res: Response) => {
    try {
      const { token } = req.body;

      if (!token || typeof token !== "string") {
        return res.status(400).json({ error: "Invalid request" });
      }

      // Hash the token to look up in database
      const { hashToken, isTokenExpired } = await import("./services/claimTokenService.js");
      const tokenHash = hashToken(token);

      // Find claim token in database
      const claimToken = await db
        .select()
        .from(claimTokens)
        .where(eq(claimTokens.tokenHash, tokenHash))
        .limit(1)
        .then(r => r[0]);

      if (!claimToken) {
        return res.status(404).json({ error: "Invalid or expired claim link" });
      }

      // Check if token is expired
      if (isTokenExpired(claimToken.expiresAt)) {
        return res.status(400).json({ error: "Invalid or expired claim link" });
      }

      // Check if token was already used
      if (claimToken.usedAt) {
        return res.status(400).json({ error: "Invalid or expired claim link" });
      }

      // Get detective info
      const detective = await storage.getDetective(claimToken.detectiveId);
      if (!detective) {
        return res.status(404).json({ error: "Invalid or expired claim link" });
      }

      // Check if already claimed
      if (detective.isClaimed) {
        return res.status(400).json({ error: "This account has already been claimed" });
      }

      // Return detective info (excluding sensitive data)
      res.json({
        valid: true,
        detective: {
          id: detective.id,
          businessName: detective.businessName,
          contactEmail: detective.contactEmail,
        },
      });
    } catch (error) {
      console.error("[Claim] Token verification error:", error);
      res.status(500).json({ error: "Failed to verify claim token" });
    }
  });

  // Submit claim account (public - no auth required, but token verified)
  app.post("/api/claim-account", async (req: Request, res: Response) => {
    try {
      const { token, email } = req.body;

      // Validate input
      if (!token || typeof token !== "string") {
        return res.status(400).json({ error: "Invalid request" });
      }

      if (!email || typeof email !== "string" || !email.includes("@")) {
        return res.status(400).json({ error: "Valid email is required" });
      }

      // Hash the token to look up in database
      const { hashToken, isTokenExpired } = await import("./services/claimTokenService.js");
      const tokenHash = hashToken(token);

      // Start transaction: Find and validate claim token
      const claimToken = await db
        .select()
        .from(claimTokens)
        .where(eq(claimTokens.tokenHash, tokenHash))
        .limit(1)
        .then(r => r[0]);

      if (!claimToken) {
        return res.status(404).json({ error: "Invalid or expired claim link" });
      }

      // Check if token is expired
      if (isTokenExpired(claimToken.expiresAt)) {
        return res.status(400).json({ error: "Invalid or expired claim link" });
      }

      // Check if token was already used
      if (claimToken.usedAt) {
        return res.status(400).json({ error: "This claim link has already been used" });
      }

      // Get detective info
      const detective = await storage.getDetective(claimToken.detectiveId);
      if (!detective) {
        return res.status(404).json({ error: "Invalid or expired claim link" });
      }

      // Check if already claimed
      if (detective.isClaimed) {
        return res.status(400).json({ error: "This account has already been claimed" });
      }

      // Mark token as used (atomic operation)
      await db
        .update(claimTokens)
        .set({ 
          usedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(claimTokens.id, claimToken.id));

      // Mark detective as claimed
      await storage.updateDetectiveAdmin(detective.id, {
        isClaimed: true,
      });

      // Store claimed email in contactEmail temporarily (will be set as primary in Step 3)
      await storage.updateDetectiveAdmin(detective.id, {
        contactEmail: email,
      });

      console.log("[Claim] Account claimed successfully");

      // STEP 3: Generate credentials and enable login
      try {
        // Get the user account associated with this detective
        const user = await db
          .select()
          .from(users)
          .where(eq(users.id, detective.userId))
          .limit(1)
          .then(r => r[0]);

        if (!user) {
          console.error("[Claim] User not found for detective");
          // Still return success for claim, but log error
          return res.json({
            success: true,
            message: "Account claimed successfully",
            detective: {
              id: detective.id,
              businessName: detective.businessName,
            },
          });
        }

        // Check if login is already enabled (prevent re-running)
        if (!user.mustChangePassword && user.password && user.password.length > 0) {
          console.log("[Claim] Login already enabled");
          return res.json({
            success: true,
            message: "Account claimed successfully",
            detective: {
              id: detective.id,
              businessName: detective.businessName,
            },
          });
        }

        // Generate secure temporary password
        const { generateTempPassword } = await import("./services/claimTokenService.js");
        const tempPassword = generateTempPassword(12);
        const hashedPassword = await bcrypt.hash(tempPassword, 10);

        // Update user with hashed password and require password change
        await db
          .update(users)
          .set({
            password: hashedPassword,
            mustChangePassword: true,
            updatedAt: new Date(),
          })
          .where(eq(users.id, user.id));

        console.log("[Claim] Credentials generated");

        // Send temporary password email
        const loginUrl = "https://askdetectives.com/login";
        smtpEmailService.sendTransactionalEmail(
          email,
          EMAIL_TEMPLATE_KEYS.CLAIMABLE_ACCOUNT_CREDENTIALS,
          {
            detectiveName: detective.businessName || "Detective",
            loginEmail: email,
            tempPassword: tempPassword,
            loginUrl: loginUrl,
            supportEmail: "support@askdetectives.com",
          }
        ).catch(err => console.error("[Email] Failed to send temp password email:", err));

        console.log("[Claim] Temporary password email sent");

      } catch (credentialError: any) {
        console.error("[Claim] Error generating credentials:", credentialError);
        // Non-blocking: Claim still succeeded, credentials can be regenerated later
      }

      res.json({
        success: true,
        message: "Account claimed successfully",
        detective: {
          id: detective.id,
          businessName: detective.businessName,
        },
      });
    } catch (error) {
      console.error("[Claim] Account claim error:", error);
      res.status(500).json({ error: "Failed to claim account" });
    }
  });

  // STEP 4: Finalize claim - Replace primary email and complete claim lifecycle
  app.post("/api/claim-account/finalize", async (req: Request, res: Response) => {
    try {
      const userId = req.session?.userId;
      if (!userId) {
        return res.status(401).json({ error: "Not authenticated" });
      }

      // Get the user
      const user = await db
        .select()
        .from(users)
        .where(eq(users.id, userId))
        .limit(1)
        .then(r => r[0]);

      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }

      // Get detective by user ID
      const detective = await storage.getDetectiveByUserId(userId);
      if (!detective) {
        return res.status(404).json({ error: "Detective profile not found" });
      }

      // Validate finalization conditions using utility function
      const { validateClaimFinalization } = await import("./services/claimTokenService.js");
      const validationResult = validateClaimFinalization(detective, user);

      if (!validationResult.isValid) {
        return res.status(400).json({ 
          error: "Cannot finalize claim at this time",
          reason: validationResult.reason,
        });
      }

      // PRIMARY EMAIL REPLACEMENT
      // Replace detective.primaryEmail (from profile) or user.email with claimed email
      const claimedEmail = detective.contactEmail; // Set during Step 2 claim

      if (!claimedEmail) {
        return res.status(400).json({ error: "Claimed email missing" });
      }

      // Ensure the new email is unique in users table
      const existingUser = await db
        .select()
        .from(users)
        .where(eq(users.email, claimedEmail))
        .limit(1)
        .then(r => r[0]);

      if (existingUser && existingUser.id !== user.id) {
        console.error("[Claim] Email already in use");
        return res.status(400).json({ 
          error: "Email already in use",
        });
      }

      // Update user email to match claimed email
      await db
        .update(users)
        .set({
          email: claimedEmail,
          updatedAt: new Date(),
        })
        .where(eq(users.id, user.id));

      console.log("[Claim] User email updated");

      // Mark claim process as completed
      await storage.updateDetectiveAdmin(detective.id, {
        claimCompletedAt: new Date(),
        // Clear temporary claimed email field (not strictly needed but good hygiene)
        contactEmail: null,
      });

      console.log("[Claim] Claim finalized");

      // Clean up any remaining claim tokens for this detective
      try {
        await db
          .delete(claimTokens)
          .where(eq(claimTokens.detectiveId, detective.id));

        console.log("[Claim] Cleaned up claim tokens");
      } catch (cleanupError: any) {
        console.error("[Claim] Error cleaning up tokens:", cleanupError);
        // Non-blocking: Finalization still succeeded
      }

      // Send finalization confirmation email
      const loginUrl = "https://askdetectives.com/login";
      smtpEmailService.sendTransactionalEmail(
        claimedEmail,
        EMAIL_TEMPLATE_KEYS.CLAIMABLE_ACCOUNT_FINALIZED,
        {
          detectiveName: detective.businessName || "Detective",
          loginEmail: claimedEmail,
          loginUrl: loginUrl,
          supportEmail: "support@askdetectives.com",
        }
      ).catch(err => console.error("[Email] Failed to send finalization email:", err));

      console.log("[Claim] Finalization confirmation email sent");

      res.json({
        success: true,
        message: "Account claim finalized successfully",
        detective: {
          id: detective.id,
          businessName: detective.businessName,
          email: claimedEmail,
        },
      });

    } catch (error) {
      console.error("[Claim] Finalization error:", error);
      res.status(500).json({ error: "Failed to finalize claim" });
    }
  });

  // ============== ADMIN EMAIL TEMPLATE ROUTES ==============

  app.get("/api/admin/email-templates", requireRole("admin"), async (_req: Request, res: Response) => {
    try {
      const { getAllEmailTemplates } = await import("./services/emailTemplateService.js");
      const templates = await getAllEmailTemplates();
      console.log("[Admin] Email templates count:", templates.length);
      console.log("[Admin] First template:", templates[0] ? { id: templates[0].id, key: templates[0].key, name: templates[0].name } : "none");
      res.json({ templates });
    } catch (error) {
      console.error("[Admin] Error fetching email templates:", error);
      res.status(500).json({ error: "Failed to fetch templates" });
    }
  });

  app.get("/api/admin/email-templates/:key", requireRole("admin"), async (req: Request, res: Response) => {
    try {
      const { key } = req.params;
      if (!key) {
        return res.status(400).json({ error: "Template key is required" });
      }

      const { getEmailTemplate, extractTemplateVariables } = await import("./services/emailTemplateService.js");
      const template = await getEmailTemplate(key);

      if (!template) {
        return res.status(404).json({ error: "Template not found" });
      }

      const variables = extractTemplateVariables(template.body);

      res.json({
        template,
        variables,
      });
    } catch (error) {
      console.error("[Admin] Error fetching template:", error);
      res.status(500).json({ error: "Failed to fetch template" });
    }
  });

  app.put("/api/admin/email-templates/:key", requireRole("admin"), async (req: Request, res: Response) => {
    try {
      const { key } = req.params;
      const { name, description, subject, body, sendpulseTemplateId } = req.body;

      if (!key) {
        return res.status(400).json({ error: "Template key is required" });
      }

      if (!subject || !body) {
        return res.status(400).json({ error: "Subject and body are required" });
      }

      const { updateEmailTemplate, extractTemplateVariables } = await import("./services/emailTemplateService.js");
      const updated = await updateEmailTemplate(key, {
        name,
        description,
        subject,
        body,
        sendpulseTemplateId: sendpulseTemplateId ? parseInt(sendpulseTemplateId) : undefined,
      });

      if (!updated) {
        return res.status(404).json({ error: "Template not found" });
      }

      const variables = extractTemplateVariables(body);

      console.log(`[Admin] Email template updated: ${key}`);

      res.json({
        success: true,
        template: updated,
        variables,
      });
    } catch (error) {
      console.error("[Admin] Error updating template:", error);
      res.status(500).json({ error: "Failed to update template" });
    }
  });

  app.post("/api/admin/email-templates/:key/toggle", requireRole("admin"), async (req: Request, res: Response) => {
    try {
      const { key } = req.params;
      if (!key) {
        return res.status(400).json({ error: "Template key is required" });
      }

      const { toggleEmailTemplate } = await import("./services/emailTemplateService.js");
      const updated = await toggleEmailTemplate(key);

      if (!updated) {
        return res.status(404).json({ error: "Template not found" });
      }

      console.log(`[Admin] Email template toggled: ${key}, isActive: ${updated.isActive}`);

      res.json({
        success: true,
        template: updated,
      });
    } catch (error) {
      console.error("[Admin] Error toggling template:", error);
      res.status(500).json({ error: "Failed to toggle template" });
    }
  });

  app.post("/api/admin/email-templates/test-all", requireRole("admin"), async (_req: Request, res: Response) => {
    try {
      const testEmail = "contact@askdetectives.com";

      // Mock data for all templates
      const mockVariables = {
        userName: "Ask Detectives",
        detectiveName: "Test Detective",
        loginEmail: "contact@askdetectives.com",
        tempPassword: "Temp@12345",
        packageName: "Pro Plan",
        billingCycle: "Monthly",
        amount: "999",
        currency: "USD",
        loginUrl: "https://askdetectives.com/login",
        claimLink: "https://askdetectives.com/claim-account?token=test",
        supportEmail: "support@askdetectives.com",
        // Additional fallback variables for flexibility
        email: testEmail,
        password: "Temp@12345",
        fullName: "Test Detective",
        businessType: "individual",
        country: "US",
        verificationLink: "https://askdetectives.com/verify?token=test",
        resetLink: "https://askdetectives.com/reset-password?token=test",
        wasNewUser: "true",
        temporaryPassword: "Temp@12345",
        reviewNotes: "This is a test email for template verification",
      };

      console.log("[Admin] Starting test email batch for all templates...");

      const { getAllEmailTemplates } = await import("./services/emailTemplateService.js");
      const allTemplates = await getAllEmailTemplates();

      const results = {
        total: allTemplates.length,
        success: 0,
        failed: 0,
        failedTemplates: [] as Array<{ key: string; name: string; error: string }>,
        testEmail: testEmail,
        timestamp: new Date().toISOString(),
      };

      // Send test email for each template
      for (const template of allTemplates) {
        try {
          // Check for relative image URLs and log warnings
          const bodyWithImages = template.body || "";
          const hasRelativeImages = /src=['"](?!(?:https?:|data:))[^'"]*['"]/.test(bodyWithImages);

          if (hasRelativeImages) {
            console.warn(
              `[Admin] Template ${template.key} contains relative image URLs - images may not load in test email`
            );
          }

          // Send test email using SMTP service
          console.log(`[Admin] Sending test email for template: ${template.key}`);

          const result = await smtpEmailService.sendTransactionalEmail(
            testEmail,
            template.key,
            mockVariables
          );

          if (result.success) {
            results.success++;
            console.log(`[Admin] ✓ Test email sent: ${template.key}`);
          } else {
            results.failed++;
            results.failedTemplates.push({
              key: template.key,
              name: template.name,
              error: result.error || "Unknown error",
            });
            console.error(
              `[Admin] ✗ Failed to send test email: ${template.key} - ${result.error}`
            );
          }
        } catch (error) {
          results.failed++;
          results.failedTemplates.push({
            key: template.key,
            name: template.name,
            error: error instanceof Error ? error.message : "Unknown error",
          });
          console.error(
            `[Admin] Error sending test email for ${template.key}:`,
            error
          );
        }
      }

      console.log(
        `[Admin] Email test batch complete: ${results.success} succeeded, ${results.failed} failed`
      );

      res.json(results);
    } catch (error) {
      console.error("[Admin] Error in test email batch:", error);
      res.status(500).json({
        error: "Failed to execute test email batch",
        details: error instanceof Error ? error.message : "Unknown error",
      });
    }
  });

  // ============== BILLING ROUTES ==============

  // Get billing history (detective only)
  app.get("/api/billing", requireRole("detective"), async (req: Request, res: Response) => {
    try {
      const detective = await storage.getDetectiveByUserId(req.session.userId!);
      if (!detective) {
        return res.status(400).json({ error: "Detective profile not found" });
      }

      const { limit = "50" } = req.query;
      const billingHistory = await storage.getBillingHistory(detective.id, parseInt(limit as string));
      res.json({ billingHistory });
    } catch (error) {
      console.error("Get billing history error:", error);
      res.status(500).json({ error: "Failed to get billing history" });
    }
  });

  // ============== LOCATION ROUTES ==============

  // SEO Redirect: Redirect legacy query-based search URLs to slug-based URLs
  // Example: /search?country=IN&state=Karnataka -> /detectives/india/karnataka/
  app.get('/search', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { country, state, city } = req.query as { country?: string; state?: string; city?: string };
      if (!country || typeof country !== 'string') return next();

      // Lookup country by ISO code (case-insensitive)
      const countryRows = await db
        .select({ id: countries.id, slug: countries.slug, name: countries.name, code: countries.code })
        .from(countries)
        .where(eq(countries.code, (country as string).toUpperCase()));

      if (!countryRows || countryRows.length === 0) return next();
      const countryRow = countryRows[0] as any;

      let target = `/detectives/${countryRow.slug}`;

      let stateRow: any = null;
      if (state && typeof state === 'string') {
        const stateRows = await db
          .select({ id: states.id, slug: states.slug, name: states.name })
          .from(states)
          .where(and(eq(states.countryId, countryRow.id), ilike(states.name, state as string)));

        if (stateRows && stateRows.length > 0) {
          stateRow = stateRows[0] as any;
          target += `/${stateRow.slug}`;
        }
      }

      // Optional city redirect
      if (city && typeof city === 'string' && stateRow) {
        try {
          const cityRows = await db
            .select({ slug: cities.slug, name: cities.name })
            .from(cities)
            .where(and(eq(cities.stateId, stateRow.id), ilike(cities.name, city as string)));

          if (cityRows && cityRows.length > 0) {
            target += `/${cityRows[0].slug}`;
          }
        } catch (e) {
          // ignore city lookup errors and continue
        }
      }

      // Ensure trailing slash
      if (!target.endsWith('/')) target = target + '/';

      return res.redirect(301, target);
    } catch (error) {
      console.error('[SEO Redirect] error:', error);
      return next();
    }
  });

  // ============== SERVICE CATEGORY ROUTES ==============

  // API: Detectives filtered by location slugs (country/state/city)
  // Optimized handler using single database query with getLocationDetectivesForSEO()
  app.get('/api/detectives/location/:countrySlug/:stateSlug?/:citySlug?', async (req: Request, res: Response) => {
    try {
      const { countrySlug, stateSlug, citySlug } = req.params as { countrySlug: string; stateSlug?: string; citySlug?: string };
      const parsedLimit = Number(req.query.limit);
      const parsedOffset = Number(req.query.offset);
      const limit = Number.isFinite(parsedLimit) ? Math.max(1, Math.min(30, Math.floor(parsedLimit))) : 15;
      const offset = Number.isFinite(parsedOffset) ? Math.max(0, Math.floor(parsedOffset)) : 0;

      // City-level URLs must include a state segment
      if (citySlug && !stateSlug) {
        return res.status(400).json({
          error: "State is required when city is provided",
          code: "INVALID_LOCATION_PATH",
          meta: { country: countrySlug, state: stateSlug, city: citySlug }
        });
      }

      // ✅ FETCH LOCATION DETECTIVES USING OPTIMIZED SINGLE QUERY
      // Add an internal timeout so requests fail fast and avoid Vercel 60s timeout.
      const LOCATION_QUERY_TIMEOUT_MS = 20000;
      let timeoutId: ReturnType<typeof setTimeout> | undefined;
      let result: Awaited<ReturnType<typeof getLocationDetectivesForSEO>>;
      try {
        result = await Promise.race([
          getLocationDetectivesForSEO(
            countrySlug,
            stateSlug,
            citySlug,
            limit + 1  // limit+1 for hasMore detection
          ),
          new Promise<never>((_, reject) => {
            timeoutId = setTimeout(() => reject(new Error('LOCATION_QUERY_TIMEOUT')), LOCATION_QUERY_TIMEOUT_MS);
          })
        ]);
      } finally {
        if (timeoutId) {
          clearTimeout(timeoutId);
        }
      }

      // ✅ MANUAL PAGINATION USING OFFSET
      const startIdx = Math.max(0, Math.min(offset, result.detectives.length));
      const paginatedDetectives = result.detectives.slice(startIdx, startIdx + limit);
      const hasMore = result.detectives.length > (startIdx + limit);

      // ✅ MASK SENSITIVE FIELDS
      // Keep this endpoint lightweight: avoid per-item async plan lookups.
      const maskedDetectives = paginatedDetectives.map((d: any) => ({
        ...d,
        phone: undefined,
        whatsapp: undefined,
        contactEmail: undefined,
        userId: undefined,
        businessDocuments: undefined,
        identityDocuments: undefined,
        slug: d.slug || "pending-generation",
        requireLocationUpdate: false,
      }));

      const estimatedTotal = hasMore
        ? offset + maskedDetectives.length + 1
        : offset + maskedDetectives.length;

      // ✅ FETCH SEO METADATA (Optional - can be optimized to move into getLocationDetectivesForSEO)
      let seoMetadata: { metaTitle: string | null; metaDescription: string | null; h1: string | null } = {
        metaTitle: null,
        metaDescription: null,
        h1: null
      };

      try {
        // Generate system SEO (no database query needed)
        const locationName = result.location.city || result.location.state || result.location.country;
        const locationType = result.location.city ? 'City' : result.location.state ? 'State' : 'Country';
        const totalCount = maskedDetectives.length;

        seoMetadata.metaTitle = `Top Private Detectives in ${locationName} | Verified Investigators`;
        seoMetadata.metaDescription = `Find trusted private detectives in ${locationName}. Browse ${totalCount} verified investigators offering background checks, surveillance, and investigation services.`;
        seoMetadata.h1 = `Private Detectives in ${locationName}`;

        console.log(`[Location Route SEO] System-generated SEO for ${locationType}: ${locationName}`);
      } catch (seoError) {
        console.error('[Location Route SEO] Error generating SEO metadata:', seoError);
        // Fallback to basic SEO
        const locationName = result.location.city || result.location.state || result.location.country;
        seoMetadata.metaTitle = `Private Detectives in ${locationName}`;
        seoMetadata.metaDescription = `Find private detectives in ${locationName}`;
        seoMetadata.h1 = `Detectives in ${locationName}`;
      }

      // ✅ RETURN RESPONSE
      res.setHeader('Cache-Control', 'public, s-maxage=60, stale-while-revalidate=300');
      res.json({
        meta: {
          country: result.location.country,
          state: result.location.state || null,
          city: result.location.city || null,
          found: true
        },
        seoMetadata,
        relatedType: result.location.state ? 'cities' : 'states',
        relatedLocations: [],  // Can be populated from getLocationDetectivesForSEO if needed
        detectives: maskedDetectives,
        total: estimatedTotal,
        hasMore,
        limit,
        offset
      });
    } catch (error) {
      if (error instanceof Error && error.message.includes('LOCATION_QUERY_TIMEOUT')) {
        return res.status(504).json({
          error: 'Location fetch timed out',
          code: 'LOCATION_FETCH_TIMEOUT',
          message: 'The location query took too long. Please try again.'
        });
      }

      console.error('[api/detectives/location] error:', error);
      res.status(500).json({
        error: 'Failed to fetch detectives by location',
        code: 'LOCATION_FETCH_ERROR',
        message: error instanceof Error ? error.message : 'Internal server error'
      });
    }
  });

  // API: Services filtered by location slugs (country/state/city) - Phase 1: Background Checks
  // Route: GET /api/services/background-checks/:country/:state/:city/
  // Returns: Array of services with detective info, filtered by location and category
  app.get('/api/services/background-checks/:country/:state/:city', async (req: Request, res: Response) => {
    try {
      const { country: countrySlug, state: stateSlug, city: citySlug } = req.params as { country: string; state: string; city: string };

      // Validation: All three segments required for Phase 1
      if (!countrySlug || !stateSlug || !citySlug) {
        return res.status(400).json({
          error: "Country, state, and city are required",
          code: "INVALID_LOCATION_PATH",
          meta: { country: countrySlug, state: stateSlug, city: citySlug }
        });
      }

      // Resolve country by slug
      const countryRows = await db
        .select({ id: countries.id, code: countries.code, name: countries.name })
        .from(countries)
        .where(eq(countries.slug, countrySlug));

      if (!countryRows || countryRows.length === 0) {
        return res.status(404).json({ 
          error: 'Country not found',
          code: 'COUNTRY_NOT_FOUND',
          meta: { country: countrySlug, state: stateSlug, city: citySlug }
        });
      }
      
      const countryRow: any = countryRows[0];

      // Resolve state
      const stateRows = await db
        .select({ id: states.id, name: states.name })
        .from(states)
        .where(and(eq(states.countryId, countryRow.id), eq(states.slug, stateSlug)));
      
      if (!stateRows || stateRows.length === 0) {
        return res.status(404).json({
          error: 'State not found',
          code: 'STATE_NOT_FOUND',
          meta: { country: countrySlug, state: stateSlug, city: citySlug }
        });
      }

      const stateRow: any = stateRows[0];

      // Resolve city
      const cityRows = await db
        .select({ id: cities.id, name: cities.name })
        .from(cities)
        .where(and(eq(cities.stateId, stateRow.id), eq(cities.slug, citySlug)));
      
      if (!cityRows || cityRows.length === 0) {
        return res.status(404).json({
          error: 'City not found',
          code: 'CITY_NOT_FOUND',
          meta: { country: countrySlug, state: stateSlug, city: citySlug }
        });
      }

      const cityRow: any = cityRows[0];

      // Use storage.searchServices() to fetch background check services in this location
      // Convert country code to country name for the filter (storage expects 2-letter country code)
      const serviceResults = await storage.searchServices({
        category: "Background Check",        // Phase 1: Only background checks
        country: countryRow.code,             // 2-letter country code (IN, US, GB)
        state: stateRow.name,                 // Full state name (Maharashtra)
        city: cityRow.name,                   // Full city name (Pune)
      }, 50, 0, 'popular');

      // Return 404 if no services found in this location
      if (!serviceResults || serviceResults.length === 0) {
        return res.status(404).json({
          error: 'No background check services found in this location',
          code: 'NO_SERVICES_FOUND',
          meta: { 
            country: countryRow.name,
            state: stateRow.name,
            city: cityRow.name,
            category: 'Background Check'
          }
        });
      }

      // Log successful injection for monitoring
      console.log(`[Service SEO] Injected background-checks for ${cityRow.name}`);

      // Return services with location metadata
      res.json({
        meta: {
          country: countryRow.name,
          countryCode: countryRow.code,
          state: stateRow.name,
          city: cityRow.name,
          category: 'Background Check',
          total: serviceResults.length,
          found: true
        },
        services: serviceResults.map(service => ({
          id: service.id,
          title: service.title,
          slug: service.slug,
          category: service.category,
          description: service.description,
          basePrice: service.basePrice,
          offerPrice: service.offerPrice,
          isOnEnquiry: service.isOnEnquiry,
          images: service.images,
          avgRating: service.avgRating,
          reviewCount: service.reviewCount,
          detective: {
            id: service.detective.id,
            businessName: service.detective.businessName,
            slug: service.detective.slug,
            logo: service.detective.logo,
            country: service.detective.country,
            state: service.detective.state,
            city: service.detective.city,
            isVerified: service.detective.isVerified,
            level: service.detective.level,
            phone: service.detective.phone,
            whatsapp: service.detective.whatsapp,
            contactEmail: service.detective.contactEmail
          }
        }))
      });
    } catch (error) {
      console.error('[api/services/background-checks/location] error:', error);
      res.status(500).json({
        error: 'Failed to fetch background check services by location',
        code: 'SERVICE_LOCATION_FETCH_ERROR',
        message: error instanceof Error ? error.message : 'Internal server error'
      });
    }
  });

  // Get all service categories (public, with optional active filter)
  app.get("/api/service-categories", async (req: Request, res: Response) => {
    try {
      const { activeOnly } = req.query;
      const categories = await storage.getAllServiceCategories(activeOnly === "true");
      res.set("Cache-Control", "public, max-age=300, stale-while-revalidate=600");
      sendCachedJson(req, res, { categories });
    } catch (error) {
      console.error("Get service categories error:", error);
      res.status(500).json({ error: "Failed to get service categories" });
    }
  });

  app.get("/api/popular-categories", async (_req: Request, res: Response) => {
    try {
      const popular = await storage.getPopularCategories(2);
      res.set("Cache-Control", "public, max-age=60, stale-while-revalidate=300");
      sendCachedJson(_req, res, { categories: popular.map(p => ({ category: p.category, count: p.count })) });
    } catch (error) {
      res.status(500).json({ error: "Failed to get popular categories" });
    }
  });

  // Get service category by ID (public)
  app.get("/api/service-categories/:id", async (req: Request, res: Response) => {
    try {
      const category = await storage.getServiceCategory(req.params.id);
      if (!category) {
        return res.status(404).json({ error: "Service category not found" });
      }
      res.json({ category });
    } catch (error) {
      console.error("Get service category error:", error);
      res.status(500).json({ error: "Failed to get service category" });
    }
  });

  // Create service category (admin only)
  app.post("/api/service-categories", requireRole("admin"), async (req: Request, res: Response) => {
    try {
      const validatedData = insertServiceCategorySchema.parse(req.body);
      const category = await storage.createServiceCategory(validatedData);
      res.status(201).json({ category });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: fromZodError(error).message });
      }
      console.error("Create service category error:", error);
      res.status(500).json({ error: "Failed to create service category" });
    }
  });

  app.get("/api/site-settings", async (_req: Request, res: Response) => {
    try {
      const s = await storage.getSiteSettings();
      if (!s) {
        return res.status(404).json({ error: "Site settings not configured" });
      }
      res.json({ settings: s });
    } catch (error) {
      res.status(500).json({ error: "Failed to get site settings" });
    }
  });

  app.patch("/api/admin/site-settings", requireRole("admin"), async (req: Request, res: Response) => {
    try {
      // Validate social links URLs if provided
      if (req.body.socialLinks) {
        for (const [platform, url] of Object.entries(req.body.socialLinks)) {
          if (url && typeof url === 'string' && url.trim()) {
            try {
              new URL(url);
            } catch (e) {
              return res.status(400).json({ error: `Invalid ${platform} URL: ${url}` });
            }
          }
        }
      }
      
      const validated = updateSiteSettingsSchema.parse(req.body);
      const payloadKeys = Object.keys(req.body || {});
      console.log("[site-settings] PATCH payload keys:", payloadKeys);
      if (typeof (req.body as any)?.heroBackgroundImage === "string") {
        console.log("[site-settings] heroBackgroundImage length:", (req.body as any).heroBackgroundImage.length);
      }
      if (typeof (req.body as any)?.featuresImage === "string") {
        console.log("[site-settings] featuresImage length:", (req.body as any).featuresImage.length);
      }
      const current = await storage.getSiteSettings();
      
      // Handle legacy logoUrl upload
      if (typeof (validated as any).logoUrl === "string" && (validated as any).logoUrl?.startsWith("data:")) {
        (validated as any).logoUrl = await uploadDataUrl("site-assets", `logos/${Date.now()}-${Math.random()}.png`, (validated as any).logoUrl);
      }
      if ((validated as any).logoUrl && current?.logoUrl && (validated as any).logoUrl !== current.logoUrl) {
        await deletePublicUrl(current.logoUrl as any);
      }
      
      // Handle headerLogoUrl upload
      if (typeof (validated as any).headerLogoUrl === "string" && (validated as any).headerLogoUrl?.startsWith("data:")) {
        (validated as any).headerLogoUrl = await uploadDataUrl("site-assets", `logos/header-${Date.now()}-${Math.random()}.png`, (validated as any).headerLogoUrl);
      }
      if ((validated as any).headerLogoUrl && current?.headerLogoUrl && (validated as any).headerLogoUrl !== current.headerLogoUrl) {
        await deletePublicUrl(current.headerLogoUrl as any);
      }
      
      // Handle stickyHeaderLogoUrl upload
      if (typeof (validated as any).stickyHeaderLogoUrl === "string" && (validated as any).stickyHeaderLogoUrl?.startsWith("data:")) {
        (validated as any).stickyHeaderLogoUrl = await uploadDataUrl("site-assets", `logos/sticky-${Date.now()}-${Math.random()}.png`, (validated as any).stickyHeaderLogoUrl);
      }
      if ((validated as any).stickyHeaderLogoUrl && current?.stickyHeaderLogoUrl && (validated as any).stickyHeaderLogoUrl !== current.stickyHeaderLogoUrl) {
        await deletePublicUrl(current.stickyHeaderLogoUrl as any);
      }
      
      // Handle footerLogoUrl upload
      if (typeof (validated as any).footerLogoUrl === "string" && (validated as any).footerLogoUrl?.startsWith("data:")) {
        (validated as any).footerLogoUrl = await uploadDataUrl("site-assets", `logos/footer-${Date.now()}-${Math.random()}.png`, (validated as any).footerLogoUrl);
      }
      if ((validated as any).footerLogoUrl && current?.footerLogoUrl && (validated as any).footerLogoUrl !== current.footerLogoUrl) {
        await deletePublicUrl(current.footerLogoUrl as any);
      }
      
      // Handle heroBackgroundImage upload
      if (typeof (validated as any).heroBackgroundImage === "string" && (validated as any).heroBackgroundImage?.startsWith("data:")) {
        (validated as any).heroBackgroundImage = await uploadDataUrl("site-assets", `hero/background-${Date.now()}-${Math.random()}.png`, (validated as any).heroBackgroundImage);
      }
      if ((validated as any).heroBackgroundImage && current?.heroBackgroundImage && (validated as any).heroBackgroundImage !== current.heroBackgroundImage) {
        await deletePublicUrl(current.heroBackgroundImage as any);
      }
      
      // Handle featuresImage upload
      if (typeof (validated as any).featuresImage === "string" && (validated as any).featuresImage?.startsWith("data:")) {
        (validated as any).featuresImage = await uploadDataUrl("site-assets", `features/image-${Date.now()}-${Math.random()}.png`, (validated as any).featuresImage);
      }
      if ((validated as any).featuresImage && current?.featuresImage && (validated as any).featuresImage !== current.featuresImage) {
        await deletePublicUrl(current.featuresImage as any);
      }
      
      const s = await storage.upsertSiteSettings(validated as any);
      res.json({ settings: s });
    } catch (error) {
      if (error instanceof z.ZodError) {
        console.error("Validation error in site settings:", fromZodError(error).message);
        return res.status(400).json({ error: fromZodError(error).message });
      }
      console.error("Error updating site settings:", {
        message: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        error
      });
      res.status(500).json({ error: "Failed to update site settings" });
    }
  });

  // Update service category (admin only)
  app.patch("/api/service-categories/:id", requireRole("admin"), async (req: Request, res: Response) => {
    try {
      const category = await storage.getServiceCategory(req.params.id);
      if (!category) {
        return res.status(404).json({ error: "Service category not found" });
      }

      const validatedData = updateServiceCategorySchema.parse(req.body);
      
      // If name is changing, cascade update to all services with the old name
      const oldName = category.name;
      const newName = validatedData.name;
      
      if (newName && oldName !== newName) {
        console.debug(`[category RENAME] "${oldName}" → "${newName}"`);
        // Update all services that reference the old category name
        const result = await db.update(services)
          .set({ category: newName, updatedAt: new Date() })
          .where(eq(services.category, oldName));
        console.debug(`[category RENAME] Updated services count:`, result);
      }
      
      const updatedCategory = await storage.updateServiceCategory(req.params.id, validatedData);
      
      // Invalidate all service-related caches
      cache.keys().filter((k) => k.startsWith("services:")).forEach((k) => { cache.del(k); });
      cache.del(`detective:public:*`);
      
      // Invalidate ranked detectives cache since services may have changed
      rankedDetectivesCache.clear();
      
      console.debug("[cache INVALIDATE]", "services:", "detectives", "categories");
      
      res.json({ category: updatedCategory });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: fromZodError(error).message });
      }
      console.error("Update service category error:", error);
      res.status(500).json({ error: "Failed to update service category" });
    }
  });

  // Delete service category (admin only) - soft delete by marking as inactive
  app.delete("/api/service-categories/:id", requireRole("admin"), async (req: Request, res: Response) => {
    try {
      const category = await storage.getServiceCategory(req.params.id);
      if (!category) {
        return res.status(404).json({ error: "Service category not found" });
      }

      await storage.deleteServiceCategory(req.params.id);
      
      // Invalidate all service-related caches
      cache.keys().filter((k) => k.startsWith("services:")).forEach((k) => { cache.del(k); });
      cache.del(`detective:public:*`);
      rankedDetectivesCache.clear();
      
      console.debug("[cache INVALIDATE]", "services:", "detectives", "categories");
      
      res.json({ message: "Service category deleted successfully" });
    } catch (error) {
      console.error("Delete service category error:", error);
      res.status(500).json({ error: "Failed to delete service category" });
    }
  });

  // Health and dev helpers
  // Simple health check endpoint (fast response, no DB check)
  app.get("/api/health", (_req: Request, res: Response) => {
    res.json({ ok: true, timestamp: new Date().toISOString(), env: config.env.isProd ? 'production' : 'development' });
  });
  
  // Database health check endpoint
  app.get("/api/health/db", async (_req: Request, res: Response) => {
    try {
      await storage.getAllServiceCategories(false);
      res.json({ ok: true });
    } catch (error: any) {
      console.error("DB health error:", error);
      res.status(500).json({ ok: false, error: error?.message || "DB error" });
    }
  });

  if (!config.env.isProd) {
    app.get("/api/dev/sentry-test", (_req: Request, _res: Response) => {
      throw new Error("Sentry test error – safe to ignore");
    });
  }

  // Dev bootstrap endpoints removed to avoid any hard-coded credentials

  app.get("/api/dev/audit-storage", async (_req: Request, res: Response) => {
    try {
      if (process.env.NODE_ENV !== 'development') {
        return res.status(404).json({ error: "Not available" });
      }
      const issues: Array<{ table: string; id: string; field: string; value: string }> = [];
      
      // OPTIMIZED: Batch process detectives to avoid loading entire table into memory
      const BATCH_SIZE = 100;
      let offset = 0;
      let batch = await storage.getAllDetectives(BATCH_SIZE, offset);
      
      while (batch.length > 0) {
        for (const d of batch) {
          if (typeof (d as any).logo === "string" && (d as any).logo && !parsePublicUrl((d as any).logo)) {
            issues.push({ table: "detectives", id: d.id as any, field: "logo", value: (d as any).logo });
          }
          const bd = (d as any).businessDocuments || [];
          for (const v of bd) {
            if (typeof v === "string" && v && !parsePublicUrl(v)) {
              issues.push({ table: "detectives", id: d.id as any, field: "businessDocuments", value: v });
            }
          }
          const idDocs = (d as any).identityDocuments || [];
          for (const v of idDocs) {
            if (typeof v === "string" && v && !parsePublicUrl(v)) {
              issues.push({ table: "detectives", id: d.id as any, field: "identityDocuments", value: v });
            }
          }
        }
        offset += BATCH_SIZE;
        batch = await storage.getAllDetectives(BATCH_SIZE, offset);
      }
      
      // OPTIMIZED: Batch process services to avoid loading entire table into memory
      offset = 0;
      let serviceBatch = await storage.getAllServices(BATCH_SIZE, offset);
      
      while (serviceBatch.length > 0) {
        for (const s of serviceBatch) {
          const imgs = (s as any).images || [];
          for (const v of imgs) {
            if (typeof v === "string" && v && !parsePublicUrl(v)) {
              issues.push({ table: "services", id: s.id as any, field: "images", value: v });
            }
          }
        }
        offset += BATCH_SIZE;
        serviceBatch = await storage.getAllServices(BATCH_SIZE, offset);
      }
      
      const settings = await storage.getSiteSettings();
      if (settings && typeof (settings as any).logoUrl === "string" && (settings as any).logoUrl && !parsePublicUrl((settings as any).logoUrl)) {
        issues.push({ table: "siteSettings", id: (settings as any).id, field: "logoUrl", value: (settings as any).logoUrl });
      }
      res.json({ ok: issues.length === 0, issues });
    } catch (error) {
      console.error("Audit storage error:", error);
      res.status(500).json({ error: "Failed to audit storage" });
    }
  });

  // ============ RANKING & VISIBILITY ROUTES ============

  // GET all detective visibility configs (admin)
  app.get("/api/admin/visibility", requireRole("admin"), async (_req: Request, res: Response) => {
    try {
      const visibilityRecords = await db.select().from(detectiveVisibility);
      
      // Enrich with detective info
      const enriched = await Promise.all(
        visibilityRecords.map(async (v) => {
          try {
            const detective = await db
              .select()
              .from(detectives)
              .where(eq(detectives.id, v.detectiveId))
              .limit(1)
              .then(r => r[0]);
            
            return {
              ...v,
              detective: detective ? {
                id: detective.id,
                businessName: detective.businessName,
                email: detective.contactEmail,
                subscriptionPackageId: detective.subscriptionPackageId,
                hasBlueTick: detective.hasBlueTick,
                status: detective.status,
              } : null
            };
          } catch (detError) {
            console.warn(`Failed to load detective ${v.detectiveId}:`, detError);
            return {
              ...v,
              detective: null
            };
          }
        })
      );

      res.json({ visibility: enriched });
    } catch (error) {
      console.error("Error fetching visibility configs:", error);
      res.status(500).json({ error: "Failed to fetch visibility configs" });
    }
  });

  // UPDATE detective visibility (admin)
  app.patch("/api/admin/visibility/:detectiveId", requireRole("admin"), async (req: Request, res: Response) => {
    try {
      const { detectiveId } = req.params;
      const { isVisible, isFeatured, manualRank } = req.body;

      // Validate detective exists
      const detective = await db
        .select()
        .from(detectives)
        .where(eq(detectives.id, detectiveId))
        .limit(1)
        .then(r => r[0]);

      if (!detective) {
        res.status(404).json({ error: "Detective not found" });
        return;
      }

      // Ensure visibility record exists
      const existing = await db
        .select()
        .from(detectiveVisibility)
        .where(eq(detectiveVisibility.detectiveId, detectiveId))
        .limit(1)
        .then(r => r[0]);

      if (!existing) {
        await db.insert(detectiveVisibility).values({
          detectiveId,
          isVisible: isVisible !== undefined ? isVisible : true,
          isFeatured: isFeatured !== undefined ? isFeatured : false,
          manualRank: manualRank !== undefined ? manualRank : null,
        });
      } else {
        const updateData: any = {};
        if (isVisible !== undefined) updateData.isVisible = isVisible;
        if (isFeatured !== undefined) updateData.isFeatured = isFeatured;
        if (manualRank !== undefined) updateData.manualRank = manualRank;
        updateData.updatedAt = new Date();

        await db
          .update(detectiveVisibility)
          .set(updateData)
          .where(eq(detectiveVisibility.detectiveId, detectiveId));
      }

      res.json({ success: true });
    } catch (error) {
      console.error("Error updating visibility:", error);
      res.status(500).json({ error: "Failed to update visibility" });
    }
  });

  // GET /api/snippets - List all saved snippets
  app.get("/api/snippets", requireRole("admin"), async (_req: Request, res: Response) => {
    try {
      const snippets = await db
        .select()
        .from(detectiveSnippets)
        .orderBy(detectiveSnippets.createdAt);

      res.json({ snippets });
    } catch (error) {
      console.error("Error fetching snippets:", error);
      res.status(500).json({ error: "Failed to fetch snippets" });
    }
  });

  // Helper: ensure at least one service exists for location + category (same logic as snippet detectives)
  const countServicesForSnippet = async (
    country: string,
    state: string | null,
    city: string | null,
    category: string,
    cache?: Map<string, number>
  ): Promise<number> => {
    const cacheKey = `${country}|${state}|${city}|${category}`;
    if (cache?.has(cacheKey)) {
      return cache.get(cacheKey) as number;
    }

    // ✅ STEP 1: RESOLVE COUNTRY to country_id
    let countryId: number | null = null;
    try {
      const countryResult = await db
        .select({ id: countries.id })
        .from(countries)
        .where(
          or(
            eq(countries.slug, country.toLowerCase()),
            eq(countries.code, country.toUpperCase()),
            eq(sql`LOWER(${countries.name})`, country.toLowerCase())
          )
        )
        .limit(1);
      
      if (countryResult.length > 0) {
        countryId = countryResult[0].id;
      }
    } catch (err) {
      console.error(`[countServicesForSnippet] Error resolving country "${country}":`, err);
    }

    if (!countryId) {
      console.warn(`[countServicesForSnippet] Country "${country}" could not be resolved to country_id`);
      return 0;
    }

    // ✅ STEP 2: RESOLVE STATE to state_id (if provided)
    let stateId: number | null = null;
    if (state) {
      try {
        const stateResult = await db
          .select({ id: states.id })
          .from(states)
          .where(
            and(
              eq(states.countryId, countryId),
              or(
                eq(states.slug, state.toLowerCase()),
                eq(sql`LOWER(${states.name})`, state.toLowerCase())
              )
            )
          )
          .limit(1);
        
        if (stateResult.length > 0) {
          stateId = stateResult[0].id;
        }
      } catch (err) {
        console.error(`[countServicesForSnippet] Error resolving state "${state}":`, err);
      }

      if (!stateId) {
        console.warn(`[countServicesForSnippet] State "${state}" could not be resolved to state_id for country_id=${countryId}`);
        return 0;
      }
    }

    // ✅ STEP 3: RESOLVE CITY to city_id (if provided)
    let cityId: number | null = null;
    if (city && stateId) {
      try {
        const cityResult = await db
          .select({ id: cities.id })
          .from(cities)
          .where(
            and(
              eq(cities.stateId, stateId),
              or(
                eq(cities.slug, city.toLowerCase()),
                eq(sql`LOWER(${cities.name})`, city.toLowerCase())
              )
            )
          )
          .limit(1);
        
        if (cityResult.length > 0) {
          cityId = cityResult[0].id;
        }
      } catch (err) {
        console.error(`[countServicesForSnippet] Error resolving city "${city}":`, err);
      }

      if (!cityId) {
        console.warn(`[countServicesForSnippet] City "${city}" could not be resolved to city_id for state_id=${stateId}`);
        return 0;
      }
    }

    // ✅ STEP 4: BUILD WHERE CONDITIONS using FK fields ONLY (no text fields)
    const whereConditions = [
      eq(detectives.status, "active"),
      eq(detectives.countryId, countryId),
      eq(services.category, String(category)),
    ];
    if (stateId) whereConditions.push(eq(detectives.stateId, stateId));
    if (cityId) whereConditions.push(eq(detectives.cityId, cityId));

    const rows = await db
      .select({ count: count(detectives.id) })
      .from(detectives)
      .innerJoin(services, eq(services.detectiveId, detectives.id))
      .where(and(...whereConditions));
    const result = Number(rows[0]?.count ?? 0);
    cache?.set(cacheKey, result);
    return result;
  };

  // POST /api/snippets - Create new snippet (only if at least 1 service exists for location + category)
  app.post("/api/snippets", requireRole("admin"), async (req: Request, res: Response) => {
    try {
      const { name, country, state, city, category, limit } = req.body;

      if (!name || !country || !category) {
        return res.status(400).json({ error: "Missing required fields: name, country, category" });
      }

      const countCache = new Map<string, number>();
      const serviceCount = await countServicesForSnippet(country, state || null, city || null, category, countCache);
      if (serviceCount < 1) {
        return res.status(400).json({
          error: "No services available for this location and category. Add at least one active detective with a service in this category and location before creating a snippet.",
        });
      }

      const snippet = await db
        .insert(detectiveSnippets)
        .values({
          name,
          country,
          state: state || null,
          city: city || null,
          category,
          limit: limit || 4,
        })
        .returning();

      res.json({ success: true, snippet: snippet[0] });
    } catch (error) {
      console.error("Error creating snippet:", error);
      res.status(500).json({ error: "Failed to create snippet" });
    }
  });

  // PUT /api/snippets/:id - Update snippet (only if at least 1 service exists for new location + category)
  app.put("/api/snippets/:id", requireRole("admin"), async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const { name, country, state, city, category, limit } = req.body;

      const existing = await db.select().from(detectiveSnippets).where(eq(detectiveSnippets.id, id)).limit(1);
      if (existing.length === 0) {
        return res.status(404).json({ error: "Snippet not found" });
      }

      const effectiveCountry = country !== undefined ? country : existing[0].country;
      const effectiveState = state !== undefined ? (state || null) : existing[0].state;
      const effectiveCity = city !== undefined ? (city || null) : existing[0].city;
      const effectiveCategory = category !== undefined ? category : existing[0].category;

      const countCache = new Map<string, number>();
      const serviceCount = await countServicesForSnippet(
        effectiveCountry,
        effectiveState,
        effectiveCity,
        effectiveCategory,
        countCache
      );
      if (serviceCount < 1) {
        return res.status(400).json({
          error: "No services available for this location and category. Snippet cannot be updated to a combination with zero services.",
        });
      }

      const updateData: any = {};
      if (name !== undefined) updateData.name = name;
      if (country !== undefined) updateData.country = country;
      if (state !== undefined) updateData.state = state || null;
      if (city !== undefined) updateData.city = city || null;
      if (category !== undefined) updateData.category = category;
      if (limit !== undefined) updateData.limit = limit;
      updateData.updatedAt = new Date();

      const snippet = await db
        .update(detectiveSnippets)
        .set(updateData)
        .where(eq(detectiveSnippets.id, id))
        .returning();

      try {
        cache.del(`snippets:${id}`);
        console.debug("[cache INVALIDATE]", `snippets:${id}`);
      } catch (_) {
        // Cache invalidation must not fail the request
      }
      res.json({ success: true, snippet: snippet[0] });
    } catch (error) {
      console.error("Error updating snippet:", error);
      res.status(500).json({ error: "Failed to update snippet" });
    }
  });

  // DELETE /api/snippets/:id - Delete snippet
  app.delete("/api/snippets/:id", requireRole("admin"), async (req: Request, res: Response) => {
    try {
      const { id } = req.params;

      await db
        .delete(detectiveSnippets)
        .where(eq(detectiveSnippets.id, id));

      try {
        cache.del(`snippets:${id}`);
        console.debug("[cache INVALIDATE]", `snippets:${id}`);
      } catch (_) {
        // Cache invalidation must not fail the request
      }
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting snippet:", error);
      res.status(500).json({ error: "Failed to delete snippet" });
    }
  });

  // In-memory cache for snippet location queries (TTL: 5 minutes)
  const SNIPPET_LOCATIONS_TTL_MS = 5 * 60 * 1000;
  const snippetLocationsCache = new Map<string, { expiresAt: number; data: any }>();
  const getSnippetLocationsCache = (key: string) => {
    const entry = snippetLocationsCache.get(key);
    if (!entry) return undefined;
    if (Date.now() > entry.expiresAt) {
      snippetLocationsCache.delete(key);
      return undefined;
    }
    return entry.data;
  };
  const setSnippetLocationsCache = (key: string, data: any) => {
    snippetLocationsCache.set(key, { expiresAt: Date.now() + SNIPPET_LOCATIONS_TTL_MS, data });
  };

  // GET /api/snippets/available-locations - Countries/states/cities where at least one service exists (for snippet dropdowns)
  app.get("/api/snippets/available-locations", async (req: Request, res: Response) => {
    try {
      const { country, state: stateParam } = req.query;
      const hasCountry = typeof country === "string" && country.trim() !== "";
      const hasState = typeof stateParam === "string" && stateParam.trim() !== "";

      if (!hasCountry) {
        const cacheKey = "snippets:locations:countries";
        const cached = getSnippetLocationsCache(cacheKey);
        if (cached) {
          return res.json({ countries: cached });
        }
        // ✅ REFACTORED: Use countries table, join with detectives/services via FK
        const countriesResult = await db
          .selectDistinct({ country: countries.name })
          .from(countries)
          .innerJoin(detectives, eq(detectives.countryId, countries.id))
          .innerJoin(services, eq(services.detectiveId, detectives.id))
          .where(and(
            eq(detectives.status, "active"),
            eq(services.isActive, true)
          ))
          .orderBy(countries.name);
        const countryList = countriesResult
          .map((r) => r.country)
          .filter((c) => c != null && c !== "")
          .sort();
        setSnippetLocationsCache(cacheKey, countryList);
        return res.json({ countries: countryList });
      }

      if (!hasState) {
        // ✅ STEP 1: Resolve country string to country_id
        let countryId: number | null = null;
        try {
          const countryResult = await db
            .select({ id: countries.id })
            .from(countries)
            .where(
              or(
                eq(countries.slug, String(country).toLowerCase()),
                eq(countries.code, String(country).toUpperCase()),
                eq(sql`LOWER(${countries.name})`, String(country).toLowerCase())
              )
            )
            .limit(1);
          
          if (countryResult.length > 0) {
            countryId = countryResult[0].id;
          }
        } catch (err) {
          console.error(`[/api/snippets/available-locations] Error resolving country "${country}":`, err);
        }

        if (!countryId) {
          return res.status(400).json({ error: `Country "${country}" could not be resolved` });
        }

        const cacheKey = `snippets:locations:states:${String(country)}`;
        const cached = getSnippetLocationsCache(cacheKey);
        if (cached) {
          return res.json({ states: cached });
        }
        // ✅ REFACTORED: Use states table with country_id FK, join with detectives/services
        const statesResult = await db
          .selectDistinct({ state: states.name })
          .from(states)
          .innerJoin(detectives, eq(detectives.stateId, states.id))
          .innerJoin(services, eq(services.detectiveId, detectives.id))
          .where(and(
            eq(detectives.countryId, countryId),
            eq(detectives.status, "active"),
            eq(services.isActive, true)
          ))
          .orderBy(states.name);
        const stateList = statesResult
          .map((r) => r.state)
          .filter((s) => s && s !== "Not specified")
          .sort();
        setSnippetLocationsCache(cacheKey, stateList);
        return res.json({ states: stateList });
      }

      // ✅ STEP 1: Resolve country string to country_id
      let countryId: number | null = null;
      try {
        const countryResult = await db
          .select({ id: countries.id })
          .from(countries)
          .where(
            or(
              eq(countries.slug, String(country).toLowerCase()),
              eq(countries.code, String(country).toUpperCase()),
              eq(sql`LOWER(${countries.name})`, String(country).toLowerCase())
            )
          )
          .limit(1);
        
        if (countryResult.length > 0) {
          countryId = countryResult[0].id;
        }
      } catch (err) {
        console.error(`[/api/snippets/available-locations] Error resolving country "${country}":`, err);
      }

      if (!countryId) {
        return res.status(400).json({ error: `Country "${country}" could not be resolved` });
      }

      // ✅ STEP 2: Resolve state string to state_id
      let stateId: number | null = null;
      try {
        const stateResult = await db
          .select({ id: states.id })
          .from(states)
          .where(
            and(
              eq(states.countryId, countryId),
              or(
                eq(states.slug, String(stateParam).toLowerCase()),
                eq(sql`LOWER(${states.name})`, String(stateParam).toLowerCase())
              )
            )
          )
          .limit(1);
        
        if (stateResult.length > 0) {
          stateId = stateResult[0].id;
        }
      } catch (err) {
        console.error(`[/api/snippets/available-locations] Error resolving state "${stateParam}":`, err);
      }

      if (!stateId) {
        return res.status(400).json({ error: `State "${stateParam}" could not be resolved for country_id=${countryId}` });
      }

      const cacheKey = `snippets:locations:cities:${String(country)}:${String(stateParam)}`;
      const cached = getSnippetLocationsCache(cacheKey);
      if (cached) {
        return res.json({ cities: cached });
      }
      // ✅ REFACTORED: Use cities table with state_id FK, join with detectives/services
      const citiesResult = await db
        .selectDistinct({ city: cities.name })
        .from(cities)
        .innerJoin(detectives, eq(detectives.cityId, cities.id))
        .innerJoin(services, eq(services.detectiveId, detectives.id))
        .where(and(
          eq(detectives.stateId, stateId),
          eq(detectives.status, "active"),
          eq(services.isActive, true)
        ))
        .orderBy(cities.name);
      const cityList = citiesResult
        .map((r) => r.city)
        .filter((c) => c && c !== "Not specified")
        .sort();
      setSnippetLocationsCache(cacheKey, cityList);
      return res.json({ cities: cityList });
    } catch (error) {
      console.error("Error fetching available locations:", error);
      res.status(500).json({ error: "Failed to fetch available locations" });
    }
  });

  // GET /api/snippets/detectives - Get services for snippet (one card per service, correct link + banner)
  // Returns services matching snippet filters with detective info so cards show real service id, title, images
  app.get("/api/snippets/detectives", async (req: Request, res: Response) => {
    try {
      const { country, state, city, category, limit = 4 } = req.query;

      if (!country || !category) {
        return res.status(400).json({ error: "Missing required parameters: country, category" });
      }

      // ✅ STEP 1: RESOLVE COUNTRY to country_id
      let countryId: number | null = null;
      try {
        const countryResult = await db
          .select({ id: countries.id })
          .from(countries)
          .where(
            or(
              eq(countries.slug, String(country).toLowerCase()),
              eq(countries.code, String(country).toUpperCase()),
              eq(sql`LOWER(${countries.name})`, String(country).toLowerCase())
            )
          )
          .limit(1);
        
        if (countryResult.length > 0) {
          countryId = countryResult[0].id;
        }
      } catch (err) {
        console.error(`[/api/snippets/detectives] Error resolving country "${country}":`, err);
      }

      if (!countryId) {
        return res.status(400).json({ error: `Country "${country}" could not be resolved` });
      }

      // ✅ STEP 2: RESOLVE STATE to state_id (if provided)
      let stateId: number | null = null;
      if (state) {
        try {
          const stateResult = await db
            .select({ id: states.id })
            .from(states)
            .where(
              and(
                eq(states.countryId, countryId),
                or(
                  eq(states.slug, String(state).toLowerCase()),
                  eq(sql`LOWER(${states.name})`, String(state).toLowerCase())
                )
              )
            )
            .limit(1);
          
          if (stateResult.length > 0) {
            stateId = stateResult[0].id;
          }
        } catch (err) {
          console.error(`[/api/snippets/detectives] Error resolving state "${state}":`, err);
        }

        if (!stateId) {
          return res.status(400).json({ error: `State "${state}" could not be resolved for country_id=${countryId}` });
        }
      }

      // ✅ STEP 3: RESOLVE CITY to city_id (if provided)
      let cityId: number | null = null;
      if (city && stateId) {
        try {
          const cityResult = await db
            .select({ id: cities.id })
            .from(cities)
            .where(
              and(
                eq(cities.stateId, stateId),
                or(
                  eq(cities.slug, String(city).toLowerCase()),
                  eq(sql`LOWER(${cities.name})`, String(city).toLowerCase())
                )
              )
            )
            .limit(1);
          
          if (cityResult.length > 0) {
            cityId = cityResult[0].id;
          }
        } catch (err) {
          console.error(`[/api/snippets/detectives] Error resolving city "${city}":`, err);
        }

        if (!cityId) {
          return res.status(400).json({ error: `City "${city}" could not be resolved for state_id=${stateId}` });
        }
      }

      // ✅ STEP 4: BUILD FK-BASED WHERE CLAUSE
      const limitNum = Math.min(Math.max(parseInt(String(limit)) || 4, 1), 20);
      const params: (string | number)[] = [countryId, String(category)];
      let paramIdx = 3;
      const stateClause = stateId ? ` AND d.state_id = $${paramIdx++}` : "";
      if (stateId) params.push(stateId);
      const cityClause = cityId ? ` AND d.city_id = $${paramIdx++}` : "";
      if (cityId) params.push(cityId);
      params.push(limitNum);

      const q = `
        SELECT s.id AS service_id, s.title AS service_title, s.images AS service_images,
               s.base_price, s.offer_price, s.is_on_enquiry, s.category AS service_category,
               d.id AS detective_id, d.business_name, d.level, d.logo, d.is_verified, d.location, d.country,
               d.phone, d.whatsapp, d.contact_email,
               d.has_blue_tick, d.blue_tick_addon, d.subscription_package_id, d.subscription_expires_at,
               sp.badges AS subscription_badges, sp.features AS subscription_features, sp.is_active AS subscription_is_active,
               u.email AS user_email,
               (SELECT COALESCE(AVG(r.rating), 0) FROM reviews r WHERE r.service_id = s.id) AS avg_rating,
               (SELECT COUNT(*)::int FROM reviews r WHERE r.service_id = s.id) AS review_count
        FROM services s
        INNER JOIN detectives d ON d.id = s.detective_id AND d.status = 'active'
        LEFT JOIN subscription_plans sp ON sp.id = d.subscription_package_id
        LEFT JOIN users u ON u.id = d.user_id
        WHERE s.is_active = true AND d.country_id = $1 AND s.category = $2${stateClause}${cityClause}
        ORDER BY avg_rating DESC NULLS LAST
        LIMIT $${paramIdx}
      `;

      const result = await pool.query<{
        service_id: string;
        service_title: string | null;
        service_images: string[] | null;
        base_price: string;
        offer_price: string | null;
        is_on_enquiry: boolean | null;
        service_category: string | null;
        detective_id: string;
        business_name: string | null;
        level: string;
        logo: string | null;
        is_verified: boolean;
        location: string;
        country: string | null;
        phone: string | null;
        whatsapp: string | null;
        contact_email: string | null;
        has_blue_tick: boolean;
        blue_tick_addon: boolean;
        subscription_package_id: string | null;
        subscription_expires_at: string | null;
        subscription_badges: unknown;
        subscription_features: string[] | null;
        subscription_is_active: boolean | null;
        user_email: string | null;
        avg_rating: string;
        review_count: string;
      }>(q, params);

      const detectives = await Promise.all(result.rows.map(async (r) => {
        const effectiveBadges = computeEffectiveBadges(
          {
            subscriptionPackageId: r.subscription_package_id,
            subscriptionExpiresAt: r.subscription_expires_at,
            hasBlueTick: r.has_blue_tick,
            blueTickAddon: r.blue_tick_addon,
          },
          r.subscription_badges ? { badges: r.subscription_badges } : null
        );

        const detectiveRaw: any = {
          id: r.detective_id,
          subscriptionPackageId: r.subscription_package_id,
          subscriptionPackage: r.subscription_package_id
            ? {
                features: Array.isArray(r.subscription_features) ? r.subscription_features : [],
                isActive: r.subscription_is_active !== false,
              }
            : null,
          contactEmail: r.contact_email ?? null,
          email: r.user_email ?? null,
          phone: r.phone ?? null,
          whatsapp: r.whatsapp ?? null,
        };

        const masked = await maskDetectiveContactsPublic(detectiveRaw);

        return {
          id: r.detective_id,
          serviceId: r.service_id,
          fullName: r.business_name ?? "Unknown",
          level: r.level,
          profilePhoto: r.logo ?? "",
          isVerified: r.is_verified,
          location: r.location ?? "",
          country: r.country ?? "",
          avgRating: parseFloat(r.avg_rating) || 0,
          reviewCount: parseInt(r.review_count, 10) || 0,
          startingPrice: parseFloat(r.base_price) || 0,
          offerPrice: r.offer_price != null ? parseFloat(r.offer_price) : null,
          isOnEnquiry: r.is_on_enquiry === true,
          serviceTitle: r.service_title ?? r.service_category ?? "Service",
          serviceImages: Array.isArray(r.service_images) ? r.service_images : (r.service_images ? [r.service_images] : []),
          serviceCategory: r.service_category ?? "",
          effectiveBadges,
          phone: masked.phone ?? undefined,
          whatsapp: masked.whatsapp ?? undefined,
          contactEmail: (masked.contactEmail ?? masked.email) ?? undefined,
        };
      }));

      res.json({ detectives });
    } catch (error) {
      console.error("Error fetching snippet detectives:", error);
      res.status(500).json({ error: "Failed to fetch detectives" });
    }
  });

  // GET /api/snippets/:id - Get single snippet by id (public: for Live Preview + embedding on pages)
  app.get("/api/snippets/:id", async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const cacheKey = `snippets:${id}`;
      try {
        const cached = cache.get<{ snippet: unknown }>(cacheKey);
        if (cached != null && cached.snippet != null) {
          console.debug("[cache HIT]", cacheKey);
          return res.json(cached);
        }
      } catch (_) {
        // Cache failure must not break the request
      }
      console.debug("[cache MISS]", cacheKey);

      const snippet = await db
        .select()
        .from(detectiveSnippets)
        .where(eq(detectiveSnippets.id, id))
        .limit(1);

      if (snippet.length === 0) {
        return res.status(404).json({ error: "Snippet not found" });
      }

      const payload = { snippet: snippet[0] };
      try {
        cache.set(cacheKey, payload, 300);
      } catch (_) {
        // Cache failure must not break the request
      }
      res.json(payload);
    } catch (error) {
      console.error("Error fetching snippet:", error);
      res.status(500).json({ error: "Failed to fetch snippet" });
    }
  });

  // ============== PAYMENT GATEWAY SETTINGS (ADMIN) ==============
  
  // Get all payment gateways
  app.get("/api/admin/payment-gateways", requireRole("admin"), async (_req: Request, res: Response) => {
    try {
      const result = await pool.query(`
        SELECT id, name, display_name, is_enabled, is_test_mode, 
               config, created_at, updated_at
        FROM payment_gateways
        ORDER BY name
      `);
      
      res.json({ gateways: result.rows });
    } catch (error) {
      console.error("Error fetching payment gateways:", error);
      res.status(500).json({ error: "Failed to fetch payment gateways" });
    }
  });

  // Get a single payment gateway
  app.get("/api/admin/payment-gateways/:id", requireRole("admin"), async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      
      const result = await pool.query(`
        SELECT id, name, display_name, is_enabled, is_test_mode, 
               config, created_at, updated_at
        FROM payment_gateways
        WHERE id = $1
      `, [id]);
      
      if (result.rows.length === 0) {
        return res.status(404).json({ error: "Payment gateway not found" });
      }
      
      res.json({ gateway: result.rows[0] });
    } catch (error) {
      console.error("Error fetching payment gateway:", error);
      res.status(500).json({ error: "Failed to fetch payment gateway" });
    }
  });

  // Update payment gateway configuration
  app.put("/api/admin/payment-gateways/:id", requireRole("admin"), async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const { is_enabled, is_test_mode, config } = req.body;
      
      // Validate config is an object
      if (config && typeof config !== 'object') {
        return res.status(400).json({ error: "Config must be a JSON object" });
      }
      
      const result = await pool.query(`
        UPDATE payment_gateways
        SET is_enabled = COALESCE($1, is_enabled),
            is_test_mode = COALESCE($2, is_test_mode),
            config = COALESCE($3::jsonb, config),
            updated_by = $4,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = $5
        RETURNING id, name, display_name, is_enabled, is_test_mode, config, updated_at
      `, [is_enabled, is_test_mode, config ? JSON.stringify(config) : null, req.session.userId, id]);
      
      if (result.rows.length === 0) {
        return res.status(404).json({ error: "Payment gateway not found" });
      }
      
      res.json({ 
        success: true, 
        gateway: result.rows[0],
        message: "Payment gateway updated successfully"
      });
    } catch (error) {
      console.error("Error updating payment gateway:", error);
      res.status(500).json({ error: "Failed to update payment gateway" });
    }
  });

  // Toggle payment gateway enabled status
  app.post("/api/admin/payment-gateways/:id/toggle", requireRole("admin"), async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      
      const result = await pool.query(`
        UPDATE payment_gateways
        SET is_enabled = NOT is_enabled,
            updated_by = $1,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = $2
        RETURNING id, name, display_name, is_enabled, is_test_mode, config, updated_at
      `, [req.session.userId, id]);
      
      if (result.rows.length === 0) {
        return res.status(404).json({ error: "Payment gateway not found" });
      }
      
      res.json({ 
        success: true, 
        gateway: result.rows[0],
        message: `Payment gateway ${result.rows[0].is_enabled ? 'enabled' : 'disabled'} successfully`
      });
    } catch (error) {
      console.error("Error toggling payment gateway:", error);
      res.status(500).json({ error: "Failed to toggle payment gateway" });
    }
  });

  // === CASE STUDIES / NEWS ROUTES ===

  // Get case study by slug
  app.get("/api/case-studies/:slug", async (req: Request, res: Response) => {
    try {
      const { slug } = req.params;

      const caseStudyRows = await db
        .select()
        .from(caseStudies)
        .where(eq(caseStudies.slug, slug))
        .limit(1);

      if (caseStudyRows.length === 0) {
        return res.status(404).json({ error: "Case study not found" });
      }

      const caseStudy = caseStudyRows[0];

      // If detective_id exists, fetch detective details
      let detective = null;
      if (caseStudy.detectiveId) {
        const detectives_data = await db
          .select()
          .from(detectives)
          .where(eq(detectives.id, caseStudy.detectiveId))
          .limit(1);

        if (detectives_data.length > 0) {
          const d = detectives_data[0];
          detective = {
            id: d.id,
            businessName: d.businessName,
            slug: d.slug,
            logo: d.logo,
            city: d.city,
            state: d.state,
            country: d.country,
            isVerified: d.isVerified,
            effectiveBadges: (d as any).effectiveBadges,
          };
        }
      }

      // Increment view count
      await db
        .update(caseStudies)
        .set({ viewCount: (caseStudy.viewCount || 0) + 1 })
        .where(eq(caseStudies.id, caseStudy.id));

      res.json({ caseStudy: { ...caseStudy, detective } });
    } catch (error) {
      console.error("[api/case-studies/:slug] error:", error);
      res.status(500).json({ error: "Failed to fetch case study" });
    }
  });

  // Get all published case studies (with optional detective filter)
  app.get("/api/case-studies", async (req: Request, res: Response) => {
    try {
      const { detectiveId, featured, limit = "10", offset = "0" } = req.query;

      let query = db
        .select()
        .from(caseStudies)
        .where(
          and(
            ...[
              detectiveId ? eq(caseStudies.detectiveId, String(detectiveId)) : undefined,
              featured === "true" ? eq(caseStudies.featured, true) : undefined,
            ].filter(Boolean) as any[]
          )
        )
        .orderBy(desc(caseStudies.publishedAt))
        .limit(Math.min(parseInt(String(limit)), 100))
        .offset(parseInt(String(offset)));

      const results = await query;

      // Fetch detective details for each case study
      const withDetectives = await Promise.all(
        results.map(async (cs: any) => {
          let detective = null;
          if (cs.detectiveId) {
            const detectives_data = await db
              .select()
              .from(detectives)
              .where(eq(detectives.id, cs.detectiveId))
              .limit(1);

            if (detectives_data.length > 0) {
              const d = detectives_data[0];
              detective = {
                id: d.id,
                businessName: d.businessName,
                slug: d.slug,
                logo: d.logo,
                city: d.city,
                state: d.state,
                country: d.country,
              };
            }
          }
          return { ...cs, detective };
        })
      );

      res.json({ caseStudies: withDetectives, total: results.length });
    } catch (error) {
      console.error("[api/case-studies] error:", error);
      res.status(500).json({ error: "Failed to fetch case studies" });
    }
  });

  // Create a new case study (admin only)
  app.post("/api/admin/case-studies", requireRole("admin"), async (req: Request, res: Response) => {
    try {
      const caseStudySchema = z.object({
        title: z.string().min(1, "Title is required"),
        slug: z.string().min(1, "Slug is required"),
        content: z.string().min(1, "Content is required"),
        excerptHtml: z.string().optional(),
        detectiveId: z.string().optional(),
        category: z.string().default("Investigation"),
        featured: z.boolean().default(false),
        thumbnail: z.string().optional(),
        publishedAt: z.string().datetime(),
      });

      const validatedData = caseStudySchema.parse(req.body);

      // Verify slug uniqueness
      const existing = await db
        .select()
        .from(caseStudies)
        .where(eq(caseStudies.slug, validatedData.slug))
        .limit(1);

      if (existing.length > 0) {
        return res.status(400).json({ error: "Slug must be unique" });
      }

      // Insert case study
      const result = await db
        .insert(caseStudies)
        .values({
          ...validatedData,
          publishedAt: new Date(validatedData.publishedAt),
        })
        .returning();

      const newCaseStudy = result[0];

      // Trigger Google Indexing if published
      if (newCaseStudy && validatedData.publishedAt) {
        const publishDate = new Date(validatedData.publishedAt);
        if (publishDate <= new Date()) {
          const articleUrl = `https://www.askdetectives.com/news/${newCaseStudy.slug}`;
          googleIndexing.submitUrl(articleUrl, "URL_UPDATED").catch(err => {
            console.error("Failed to notify Google of new case study:", err);
          });
        }
      }

      res.status(201).json({ caseStudy: newCaseStudy });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: fromZodError(error).message });
      }
      console.error("[admin/case-studies] create error:", error);
      res.status(500).json({ error: "Failed to create case study" });
    }
  });

  // Update a case study (admin only)
  app.put("/api/admin/case-studies/:id", requireRole("admin"), async (req: Request, res: Response) => {
    try {
      const { id } = req.params;

      // Fetch existing case study
      const existingRows = await db
        .select()
        .from(caseStudies)
        .where(eq(caseStudies.id, id))
        .limit(1);

      if (existingRows.length === 0) {
        return res.status(404).json({ error: "Case study not found" });
      }

      const existingStudy = existingRows[0];

      const updateSchema = z.object({
        title: z.string().optional(),
        slug: z.string().optional(),
        content: z.string().optional(),
        excerptHtml: z.string().optional(),
        detectiveId: z.string().optional(),
        category: z.string().optional(),
        featured: z.boolean().optional(),
        thumbnail: z.string().optional(),
        publishedAt: z.string().datetime().optional(),
      });

      const validatedData = updateSchema.parse(req.body);
      const updateValues: {
        title?: string;
        slug?: string;
        content?: string;
        excerptHtml?: string;
        detectiveId?: string;
        category?: string;
        featured?: boolean;
        thumbnail?: string;
        publishedAt?: Date;
        updatedAt: Date;
      } = {
        title: validatedData.title,
        slug: validatedData.slug,
        content: validatedData.content,
        excerptHtml: validatedData.excerptHtml,
        detectiveId: validatedData.detectiveId,
        category: validatedData.category,
        featured: validatedData.featured,
        thumbnail: validatedData.thumbnail,
        updatedAt: new Date(),
      };

      if (validatedData.publishedAt) {
        updateValues.publishedAt = new Date(validatedData.publishedAt);
      }

      // Check slug uniqueness if changed
      if (validatedData.slug && validatedData.slug !== existingStudy.slug) {
        const duplicate = await db
          .select()
          .from(caseStudies)
          .where(eq(caseStudies.slug, validatedData.slug))
          .limit(1);

        if (duplicate.length > 0) {
          return res.status(400).json({ error: "Slug must be unique" });
        }
      }

      // Update case study
      const result = await db
        .update(caseStudies)
        .set(updateValues)
        .where(eq(caseStudies.id, id))
        .returning();

      const updatedStudy = result[0];

      // Trigger Google Indexing
      if (updatedStudy && updatedStudy.slug) {
        const articleUrl = `https://www.askdetectives.com/news/${updatedStudy.slug}`;
        googleIndexing.submitUrl(articleUrl, "URL_UPDATED").catch(err => {
          console.error("Failed to notify Google of case study update:", err);
        });
      }

      res.json({ caseStudy: updatedStudy });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: fromZodError(error).message });
      }
      console.error("[admin/case-studies/:id] update error:", error);
      res.status(500).json({ error: "Failed to update case study" });
    }
  });

  // Delete a case study (admin only)
  app.delete("/api/admin/case-studies/:id", requireRole("admin"), async (req: Request, res: Response) => {
    try {
      const { id } = req.params;

      // Fetch case study to get slug
      const studyRows = await db
        .select()
        .from(caseStudies)
        .where(eq(caseStudies.id, id))
        .limit(1);

      if (studyRows.length === 0) {
        return res.status(404).json({ error: "Case study not found" });
      }

      const study = studyRows[0];

      // Delete case study
      await db.delete(caseStudies).where(eq(caseStudies.id, id));

      // Notify Google of deletion
      if (study && study.slug) {
        const articleUrl = `https://www.askdetectives.com/news/${study.slug}`;
        googleIndexing.submitUrl(articleUrl, "URL_DELETED").catch(err => {
          console.error("Failed to notify Google of case study deletion:", err);
        });
      }

      res.json({ message: "Case study deleted successfully" });
    } catch (error) {
      console.error("[admin/case-studies/:id] delete error:", error);
      res.status(500).json({ error: "Failed to delete case study" });
    }
  });

  const sendCachedJson = (req: Request, res: Response, payload: any) => {
    const body = JSON.stringify(payload);
    const tag = 'W/"' + createHash('sha1').update(body).digest('hex') + '"';
    if (req.headers['if-none-match'] === tag) {
      res.status(304).end();
      return;
    }
    res.set('ETag', tag);
    res.json(payload);
  };

  const httpServer = createServer(app);

  console.log('[DEBUG] registerRoutes() completing, about to return httpServer');
  return httpServer;
}
