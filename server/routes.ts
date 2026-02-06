import type { Express, Request, Response, NextFunction } from "express";
import { createHash, randomBytes } from "node:crypto";
import crypto from "crypto";
import { createServer, type Server } from "http";
import { storage } from "./storage.ts";
import { sendClaimApprovedEmail } from "./email.ts";
import { sendpulseEmail, EMAIL_TEMPLATES } from "./services/sendpulseEmail.ts";
import { generateClaimToken, calculateTokenExpiry, buildClaimUrl } from "./services/claimTokenService.ts";
import bcrypt from "bcrypt";
import Razorpay from "razorpay";
import { db, pool } from "../db/index.ts";
import { eq, and, desc, avg, count, min, ilike } from "drizzle-orm";
import {
  detectives,
  detectiveVisibility,
  users,
  claimTokens,
  emailTemplates,
  detectiveSnippets,
  appSecrets,
  services,
  reviews,
  insertUserSchema, 
  insertDetectiveSchema, 
  insertServiceSchema, 
  insertReviewSchema,
  insertOrderSchema,
  insertFavoriteSchema,
  insertDetectiveApplicationSchema,
  insertProfileClaimSchema,
  insertServiceCategorySchema,
  updateUserSchema,
  updateDetectiveSchema,
  updateServiceSchema,
  updateReviewSchema,
  updateOrderSchema,
  updateServiceCategorySchema,
  updateSiteSettingsSchema,
  type User
} from "../shared/schema.ts";
import { z } from "zod";
import { fromZodError } from "zod-validation-error";
import { uploadDataUrl, deletePublicUrl, parsePublicUrl } from "./supabase.ts";
import { config } from "./config.ts";
import { bodyParsers } from "./app.ts";
import * as cache from "./lib/cache.ts";
import { runSmartSearch } from "./lib/smart-search.ts";
import { getCurrencyForCountry, getEffectiveCurrency } from "../client/src/lib/country-currency-map.ts";
import pkg from "pg";
const { Pool } = pkg;
import { requirePolicy } from "./policy.ts";
import { requireAuth, requireRole } from "./authMiddleware.ts";
import { getPaymentGateway, isPaymentGatewayEnabled } from "./services/paymentGateway.ts";
import { createPayPalOrder, capturePayPalOrder, verifyPayPalCapture } from "./services/paypal.ts";
import { paymentGatewayRoutes } from "./routes/paymentGateways.ts";
import { getFreePlanId } from "./services/freePlan.ts";
import adminCmsRouter from "./routes/admin-cms.ts";
import adminFinanceRouter from "./routes/admin-finance.ts";
import publicPagesRouter from "./routes/public-pages.ts";
import publicCategoriesRouter from "./routes/public-categories.ts";
import publicTagsRouter from "./routes/public-tags.ts";

// Initialize Razorpay with env fallback (will be overridden by DB config)
let razorpayClient = new Razorpay({
  key_id: config.razorpay.keyId || "dummy",
  key_secret: config.razorpay.keySecret || "dummy",
});

// Helper to get/refresh Razorpay client from database
async function getRazorpayClient() {
  const gateway = await getPaymentGateway('razorpay');
  
  if (!gateway) {
    console.warn('[Razorpay] Gateway not enabled, falling back to env config');
    return razorpayClient;
  }
  
  // Reinitialize with DB config
  const dbClient = new Razorpay({
    key_id: gateway.config.keyId || config.razorpay.keyId,
    key_secret: gateway.config.keySecret || config.razorpay.keySecret,
  });
  
  console.log(`[Razorpay] Using ${gateway.is_test_mode ? 'TEST' : 'LIVE'} mode from database`);
  return dbClient;
}

// Extend Express Session
declare module "express-session" {
  interface SessionData {
    userId: string;
    userRole: string;
    csrfToken?: string;
  }
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

import { applyPackageEntitlements, computeEffectiveBadges } from "./services/entitlements.ts";

// GUARD: Enforce no duplicate Blue Tick add-on purchases
// Block if detective already has Blue Tick (from add-on OR subscription)
async function assertBlueTickNotAlreadyActive(detectiveId: string, provider: string): Promise<void> {
  const detective = await storage.getDetective(detectiveId);
  
  if (!detective) {
    throw new Error(`Detective not found: ${detectiveId}`);
  }
  
  const hasAddon = (detective as any).blueTickAddon === true;
  const hasFromPackage = detective.hasBlueTick === true;
  if (hasAddon || hasFromPackage) {
    console.error(`[BLUE_TICK_GUARD] Duplicate attempt blocked`, {
      detectiveId,
      provider,
      blueTickAddon: hasAddon,
      hasBlueTick: hasFromPackage,
    });
    
    const error = new Error("Blue Tick already active");
    (error as any).statusCode = 409; // Conflict
    throw error;
  }
  
  const existingOrder = await storage.getPaymentOrdersByDetectiveId?.(detectiveId)
    ?.then((orders: any[]) => 
      orders.find((o: any) => 
        o.status !== "verified" && 
        (o.plan === "blue_tick_addon" || o.plan === "blue-tick" || o.packageId === "blue-tick")
      )
    ) || null;
  
  if (existingOrder) {
    console.warn(`[BLUE_TICK_GUARD] Existing unpaid Blue Tick order found`, {
      detectiveId,
      orderId: existingOrder.id,
      status: existingOrder.status,
    });
    
    const error = new Error("Blue Tick payment already in progress");
    (error as any).statusCode = 409; // Conflict
    throw error;
  }
}

export async function registerRoutes(app: Express): Promise<Server> {
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

  async function maskDetectiveContactsPublic(d: any, planCache?: { get: (name: string) => Promise<any> }): Promise<any> {
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
  
  // ============== BODY PARSER APPLICATION - APPLY TO ALL API ROUTES ==============
  // Apply body parsers globally to all /api routes with 10MB limit
  // This ensures ALL routes can accept JSON/form data without configuration issues
  app.use('/api/', bodyParsers.fileUpload.json, bodyParsers.fileUpload.urlencoded);
  
  // ============== CSRF TOKEN (must be before auth; no token required for GET) ==============
  // SECURITY: CSRF tokens must be generated using cryptographically secure randomness.
  // Using crypto.randomBytes(32) provides 256 bits of entropy.
  app.get("/api/csrf-token", (req: Request, res: Response) => {
    if (!req.session.csrfToken) {
      req.session.csrfToken = randomBytes(32).toString("hex");
    }
    res.json({ csrfToken: req.session.csrfToken });
  });

  app.post("/api/contact", async (req: Request, res: Response) => {
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
    const result = await sendpulseEmail.sendTransactionalEmail(
      "contact@askdetectives.com",
      EMAIL_TEMPLATES.CONTACT_FORM,
      { firstName, lastName, email, message },
      "Contact Form Submission"
    );

    if (!result.success) {
      return res.status(500).json({ error: "Failed to send message" });
    }

    return res.json({ success: true });
  });

  // ============== AUTHENTICATION ROUTES ==============
  
  // Register new user
  app.post("/api/auth/register", async (req: Request, res: Response) => {
    try {
      const validatedData = insertUserSchema.parse(req.body);
      
      // Check if user already exists
      const existingUser = await storage.getUserByEmail(validatedData.email);
      if (existingUser) {
        return res.status(400).json({ error: "Registration failed" });
      }

      const user = await storage.createUser(validatedData);

      // Session fixation prevention: regenerate session before setting auth data
      req.session.regenerate((err) => {
        if (err) {
          console.warn("[auth] Session error during registration");
          return res.status(500).json({ error: "Failed to register user" });
        }
        req.session.userId = user.id;
        req.session.userRole = user.role;
        req.session.csrfToken = randomBytes(32).toString("hex");

        // Send welcome email (non-blocking)
        sendpulseEmail.sendTransactionalEmail(
          user.email,
          EMAIL_TEMPLATES.WELCOME_USER,
          {
            userName: user.name,
            email: user.email,
            supportEmail: "support@askdetectives.com",
          }
        ).catch(e => console.error("[Email] Failed to send welcome email:", e));

        const { password: _p, ...userWithoutPassword } = user;
        res.status(201).json({ user: userWithoutPassword, csrfToken: req.session.csrfToken });
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: fromZodError(error).message });
      }
      console.warn("[auth] Registration failed");
      res.status(500).json({ error: "Failed to register user" });
    }
  });

  // Dev endpoint removed - Trial Inactive plan cannot be auto-recreated

  // Login
  // SECURITY: Admin credentials must NEVER be hardcoded. Admin access is DB-driven only.
  // Admin status is determined solely by user.role === "admin" from the database.
  app.post("/api/auth/login", async (req: Request, res: Response) => {
    try {
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
      req.session.regenerate((err) => {
        if (err) {
          console.warn("[auth] Session error during login", { userId: user.id, email });
          return res.status(500).json({ error: "Failed to log in" });
        }
        req.session.userId = user.id;
        req.session.userRole = user.role;
        req.session.csrfToken = randomBytes(32).toString("hex");

        const { password: _p, ...userWithoutPassword } = user;
        res.json({ user: userWithoutPassword, csrfToken: req.session.csrfToken });
      });
    } catch (_error) {
      console.warn("[auth] Login failed");
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
    const redirectUri = `${baseUrl}/api/auth/google/callback`;
    const scope = "openid email profile";
    const url = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${encodeURIComponent(clientId)}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=${encodeURIComponent(scope)}`;
    res.redirect(302, url);
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
      req.session.regenerate((err) => {
        if (err) {
          console.warn("[auth] Session error during Google login");
          return res.redirect(`${frontOrigin}/login?error=session_failed`);
        }
        req.session.userId = user!.id;
        req.session.userRole = user!.role;
        req.session.csrfToken = randomBytes(32).toString("hex");
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
      res.json({ message: "Password updated successfully" });
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
      req.session.destroy((err) => {
      if (err) {
        return res.status(500).json({ error: "Failed to log out" });
      }
      res.clearCookie("connect.sid", { path: "/", httpOnly: true, secure: config.session.secureCookies, sameSite: "lax" });
      res.json({ message: "Logged out successfully" });
    });
  });

  // Get current user
  app.get("/api/auth/me", requireAuth, async (req: Request, res: Response) => {
    try {
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

  // Alias for admin pages: same response shape as /api/auth/me (single source of truth)
  app.get("/api/user", requireAuth, async (req: Request, res: Response) => {
    try {
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

  // Update user country/currency preferences
  app.patch("/api/users/preferences", requireAuth, async (req: Request, res: Response) => {
    try {
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
  const RATES_CACHE_DURATION = 60 * 60 * 1000; // 1 hour
  const RATES_UPDATE_INTERVAL = 30 * 60 * 1000; // Update every 30 minutes
  const MIN_BASE_PRICE_INR = 1000; // Minimum base price in INR (applies to all countries)

  // Fallback rates (used if API fails)
  function getFallbackRates(): Record<string, number> {
    return {
      USD: 1,
      GBP: 0.79,
      INR: 83.5,
      CAD: 1.35,
      AUD: 1.52,
      EUR: 0.92,
    };
  }

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

  // ============== DETECTIVE ROUTES ==============

  // Get all detectives (public)
  app.get("/api/detectives", async (req: Request, res: Response) => {
    try {
      const { country, status, plan, search } = req.query;
      const policyLimit = await requirePolicy<{ value: number }>("pagination_default_limit");
      const policyOffset = await requirePolicy<{ value: number }>("pagination_default_offset");
      const limit = String((req.query as any).limit ?? policyLimit?.value ?? 20);
      const offset = String((req.query as any).offset ?? policyOffset?.value ?? 0);
      if (typeof search === 'string' && search.trim()) {
        await storage.recordSearch(search as string);
      }

      // Use ranking system for detective visibility and ordering
      const { getRankedDetectives } = await import("./ranking.ts");
      let detectives = await getRankedDetectives({
        country: country as string,
        status: status as string || undefined, // Don't default to "active" - let ranking decide
        plan: plan as string,
        searchQuery: search as string,
        limit: 100,
      });

      // Apply filters based on query
      if (country) {
        detectives = detectives.filter((d: any) => d.country === country);
      }
      if (status) {
        detectives = detectives.filter((d: any) => d.status === status);
      }

      // Apply pagination
      const limitNum = parseInt(limit);
      const offsetNum = parseInt(offset);
      const total = detectives.length;
      const paginatedDetectives = detectives.slice(offsetNum, offsetNum + limitNum);

      const maskedDetectives = await Promise.all(paginatedDetectives.map(async (d: any) => {
        const masked = await maskDetectiveContactsPublic(d);
        // Explicitly null sensitive fields we never want public
        masked.userId = undefined;
        masked.email = masked.email; // preserved only if allowed by mask
        masked.contactEmail = masked.contactEmail; // preserved only if allowed by mask
        masked.phone = masked.phone; // preserved only if allowed by mask
        masked.whatsapp = masked.whatsapp; // preserved only if allowed by mask
        masked.businessDocuments = undefined;
        masked.identityDocuments = undefined;
        masked.isClaimable = undefined;
        return masked;
      }));

      // Disable caching for dashboard - always fetch fresh data
      res.set("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
      res.set("Pragma", "no-cache");
      res.set("Expires", "0");
      res.json({ detectives: maskedDetectives, total });
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

  app.get("/api/subscription-limits", async (_req: Request, res: Response) => {
    try {
      const plans = await storage.getAllSubscriptionPlans(true);
      const limits: Record<string, number> = {};
      for (const p of plans) {
        limits[p.name] = Number(p.serviceLimit || 0);
      }
      res.json({ limits });
    } catch {
      if (config.env.isProd) {
        res.status(500).json({ error: "Subscription limits not configured" });
      } else {
        res.json({ limits: {} });
      }
    }
  });

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
    "sendgrid_api_key", "sendgrid_from_email",
    "smtp_host", "smtp_port", "smtp_secure", "smtp_user", "smtp_pass", "smtp_from_email",
    "sendpulse_api_id", "sendpulse_api_secret", "sendpulse_sender_email", "sendpulse_sender_name", "sendpulse_enabled",
    "razorpay_key_id", "razorpay_key_secret", "paypal_client_id", "paypal_client_secret", "paypal_mode",
    "gemini_api_key",
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
    console.log("🔍 [GET subscription-plans/:id] Headers:", req.headers);
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
        
        const updated = await storage.getDetective(detective.id);
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
      const { packageId, billingCycle } = z.object({ 
        packageId: z.string().min(1, "Package ID is required"),
        billingCycle: z.enum(["monthly", "yearly"], { errorMap: () => ({ message: "Billing cycle must be 'monthly' or 'yearly'" }) })
      }).parse(req.body);
      
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
      const order = await rzpClient.orders.create({
        amount: amountPaise,
        currency: "INR",
        receipt: `sub_${Date.now()}`.substring(0, 40),
        notes: { 
          packageId, 
          packageName: packageRecord.name,
          billingCycle,
          detectiveId: detective.id, 
          userId: req.session.userId 
        },
      });

      console.log(`[create-order] Razorpay order created: ${order.id}`);

      // Save payment order to database
      await storage.createPaymentOrder({
        userId: req.session.userId!,
        detectiveId: detective.id,
        plan: packageRecord.name as any,
        packageId: packageId,
        billingCycle: billingCycle,
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

      // Send payment success email (non-blocking)
      const user = await storage.getUser(req.session.userId!);
      if (user && packageToActivate) {
        const expiryDate = calculateExpiryDate(new Date(), billingCycle);
        sendpulseEmail.sendTransactionalEmail(
          user.email,
          EMAIL_TEMPLATES.PAYMENT_SUCCESS,
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
        sendpulseEmail.sendAdminEmail(
          EMAIL_TEMPLATES.ADMIN_NEW_PAYMENT,
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
        detective: updatedDetective
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
      if (paymentOrder.user_id !== req.session.userId) {
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
      const packageId = paymentOrder.package_id;
      const billingCycle = paymentOrder.billing_cycle;

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
          await assertBlueTickNotAlreadyActive(paymentOrder.detective_id, 'paypal');
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

      console.log(`[paypal-capture] Activating package ${packageId} for detective ${paymentOrder.detective_id}`);

      // Handle Blue Tick addon vs regular subscription
      if (packageId === 'blue-tick' || packageId === 'blue_tick_addon') {
        // Blue Tick add-on: set add-on flag only (subscription-granted Blue Tick stays in hasBlueTick via applyPackageEntitlements)
        await storage.updateDetectiveAdmin(paymentOrder.detective_id, {
          blueTickAddon: true,
          blueTickActivatedAt: new Date(),
        } as any);
        
        console.log(`[paypal-capture] Blue Tick add-on activated for detective ${paymentOrder.detective_id}`);
      } else {
        // Regular subscription: update subscription fields only
        await storage.updateDetectiveAdmin(paymentOrder.detective_id, {
          subscriptionPackageId: packageId,
          billingCycle: billingCycle,
          subscriptionActivatedAt: new Date(),
          subscriptionExpiresAt: calculateExpiryDate(new Date(), billingCycle),
          // Note: subscriptionPlan and planActivatedAt are LEGACY fields - not updated during payment
        } as any);
        
        console.log(`[paypal-capture] Subscription activated for detective ${paymentOrder.detective_id}`);

        // APPLY ENTITLEMENTS: Use centralized entitlement system
        // This function reads package.badges and applies/removes entitlements (Blue Tick, Pro, etc.)
        await applyPackageEntitlements(paymentOrder.detective_id, 'activation');
        
        console.log(`[paypal-capture] Entitlements applied`);
      }

      // Fetch updated detective to return to client
      const updatedDetective = await storage.getDetective(paymentOrder.detective_id);
      
      if (!updatedDetective) {
        console.error(`[paypal-capture] Could not fetch updated detective: ${paymentOrder.detective_id}`);
        return res.status(500).json({ error: "Failed to fetch updated detective" });
      }

      console.log(`[paypal-capture] Successfully updated detective: subscriptionPackageId=${updatedDetective.subscriptionPackageId}, billingCycle=${updatedDetective.billingCycle}, activatedAt=${updatedDetective.subscriptionActivatedAt}`);
      console.log("[paypal-capture] === PAYPAL CAPTURE COMPLETE ===");

      // Send payment success email (non-blocking)
      const user = await storage.getUser(req.session.userId!);
      if (user && packageToActivate) {
        if (packageId === 'blue-tick' || packageId === 'blue_tick_addon') {
          // Send Blue Tick success email
          sendpulseEmail.sendTransactionalEmail(
            user.email,
            EMAIL_TEMPLATES.BLUE_TICK_PURCHASE_SUCCESS,
            {
              detectiveName: updatedDetective.businessName || user.name,
              email: user.email,
              supportEmail: "support@askdetectives.com",
            }
          ).catch(err => console.error("[Email] Failed to send Blue Tick success email:", err));
        } else {
          // Send regular subscription success email
          const expiryDate = calculateExpiryDate(new Date(), billingCycle);
          sendpulseEmail.sendTransactionalEmail(
            user.email,
            EMAIL_TEMPLATES.PAYMENT_SUCCESS,
            {
              detectiveName: updatedDetective.businessName || user.name,
              email: user.email,
              packageName: packageToActivate.name,
              billingCycle: billingCycle,
              amount: String(paymentOrder.amount || ""),
              currency: paymentOrder.currency || "USD",
              subscriptionExpiryDate: expiryDate ? new Date(expiryDate).toLocaleDateString() : "N/A",
              supportEmail: "support@askdetectives.com",
            }
          ).catch(err => console.error("[Email] Failed to send payment success email:", err));

          // Send admin notification (non-blocking)
          sendpulseEmail.sendAdminEmail(
            EMAIL_TEMPLATES.ADMIN_NEW_PAYMENT,
            {
              detectiveName: updatedDetective.businessName || user.name,
              email: user.email,
              packageName: packageToActivate.name,
              amount: String(paymentOrder.amount || ""),
              currency: paymentOrder.currency || "USD",
              supportEmail: "support@askdetectives.com",
            }
          ).catch(err => console.error("[Email] Failed to send admin payment notification:", err));
        }
      }

      // Build response based on package type
      const response: any = { 
        success: true, 
        detective: updatedDetective
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

  // Public Pages Routes (read-only access to published pages)
  app.use("/api/public/pages", publicPagesRouter);
  app.use("/api/public/categories", publicCategoriesRouter);
  app.use("/api/public/tags", publicTagsRouter);

  // Admin CMS Routes
  app.use("/api/admin", adminCmsRouter);

  // Admin Finance Routes
  app.use("/api/admin/finance", requireRole("admin"), adminFinanceRouter);

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
      const { billingCycle } = z.object({ 
        billingCycle: z.enum(["monthly", "yearly"], { errorMap: () => ({ message: "Billing cycle must be 'monthly' or 'yearly'" }) })
      }).parse(req.body);
      
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
      const order = await rzpClient.orders.create({
        amount: amountPaise,
        currency: "INR",
        receipt: `bluetick_${Date.now()}`.substring(0, 40),
        notes: { 
          type: "blue_tick_addon",
          billingCycle,
          detectiveId: detective.id, 
          userId: req.session.userId 
        },
      });

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
        sendpulseEmail.sendTransactionalEmail(
          user.email,
          EMAIL_TEMPLATES.BLUE_TICK_PURCHASE_SUCCESS,
          {
            detectiveName: detective.businessName || user.name,
            email: user.email,
            supportEmail: "support@askdetectives.com",
          }
        ).catch(err => console.error("[Email] Failed to send blue tick success email:", err));
      }

      console.log(`[verify-blue-tick] Successfully activated Blue Tick add-on for detective: blueTickAddon=${(updatedDetective as any).blueTickAddon}`);
      console.log("[verify-blue-tick] === BLUE TICK VERIFICATION COMPLETE ===");

      res.json({ 
        success: true, 
        hasBlueTick: true,
        detective: updatedDetective
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
      let detective = await storage.getDetectiveByUserId(req.session.userId!);
      if (!detective) {
        return res.status(404).json({ error: "Detective profile not found" });
      }

      // Backfill subscription expiry for paid plans if missing
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
      
      // Apply pending downgrades if expiry has passed
      detective = await applyPendingDowngrades(detective);

      const effectiveBadges = computeEffectiveBadges(detective, (detective as any).subscriptionPackage);
      res.json({ detective: { ...detective, effectiveBadges } });
    } catch (error) {
      console.error("Get current detective error:", error);
      res.status(500).json({ error: "Failed to get current detective" });
    }
  });

  app.get("/api/detectives/:id/public-service-count", async (req: Request, res: Response) => {
    try {
      const count = await storage.getPublicServiceCountByDetective(req.params.id);
      res.json({ count });
    } catch (error) {
      console.error("Get public service count error:", error);
      res.status(500).json({ error: "Failed to get service count" });
    }
  });

  // Get detective by ID (public)
  app.get("/api/detectives/:id", async (req: Request, res: Response) => {
    try {
      const detective = await storage.getDetective(req.params.id);
      if (!detective) {
        return res.status(404).json({ error: "Detective not found" });
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
      const payload = { detective: { ...maskedDetective, effectiveBadges: computeEffectiveBadges(maskedDetective, (maskedDetective as any).subscriptionPackage) }, claimInfo };
      if (!skipCache) {
        try {
          cache.set(cacheKey, payload, 60);
        } catch (_) {
          // Cache failure must not break the request
        }
      }
      res.set("Cache-Control", "public, max-age=60, stale-while-revalidate=300");
      sendCachedJson(req, res, payload);
    } catch (error) {
      console.error("Get detective error:", error);
      res.status(500).json({ error: "Failed to get detective" });
    }
  });

  // Public: get user profile by id (limited fields)
  app.get("/api/users/:id", requireAuth, async (req: Request, res: Response) => {
    try {
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
      res.set("Cache-Control", "public, max-age=300, stale-while-revalidate=600");
      sendCachedJson(req, res, { user: userWithoutPassword });
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

      const detective = await storage.createDetective(validatedData);
      
      // Update user role to detective using privileged method
      await storage.updateUserRole(req.session.userId!, "detective");
      req.session.userRole = "detective";

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
      if ((validatedData as any).logo && detective.logo && (validatedData as any).logo !== detective.logo) {
        await deletePublicUrl(detective.logo as any);
      }
      if (Array.isArray((validatedData as any).businessDocuments) && Array.isArray(detective.businessDocuments)) {
        for (const prev of (detective.businessDocuments as any[])) {
          if (!(validatedData as any).businessDocuments.includes(prev)) {
            await deletePublicUrl(prev as any);
          }
        }
      }
      if (Array.isArray((validatedData as any).identityDocuments) && Array.isArray(detective.identityDocuments)) {
        for (const prev of (detective.identityDocuments as any[])) {
          if (!(validatedData as any).identityDocuments.includes(prev)) {
            await deletePublicUrl(prev as any);
          }
        }
      }
      const updatedDetective = await storage.updateDetective(req.params.id, validatedData);
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

      const updatedDetective = await storage.updateDetectiveAdmin(req.params.id, allowedData);
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
      
      // Return the temporary password to the admin
      res.json({ 
        message: "Password reset successfully",
        temporaryPassword: tempPassword,
        email: detective.email
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

  // ============== AUTOCOMPLETE SEARCH (navbar) ==============
  app.get("/api/search/autocomplete", async (req: Request, res: Response) => {
    try {
      const query = String(req.query.q || "").trim().toLowerCase();
      console.log("🔍 [Autocomplete API] Received query:", query, "length:", query.length);
      
      if (!query || query.length < 3) {
        console.log("🔍 [Autocomplete API] Query too short, returning empty");
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

      // Search detective business names
      const detectivesResult = await db
        .select({
          id: detectives.id,
          businessName: detectives.businessName,
          location: detectives.location,
        })
        .from(detectives)
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
      }));
      suggestions.push(...matchingDetectives);
      console.log("🔍 [Autocomplete API] Found detectives:", matchingDetectives.length);

      // Search locations (countries, states, cities from WORLD_COUNTRIES)
      const { WORLD_COUNTRIES } = await import("../client/src/lib/world-countries.ts");
      const matchingLocations: Array<{ type: "location"; label: string; value: string }> = [];
      
      for (const country of WORLD_COUNTRIES) {
        if (country.name.toLowerCase().includes(query)) {
          matchingLocations.push({
            type: "location",
            label: `${country.flag} ${country.name}`,
            value: `country:${country.code}`,
          });
        }
        if (matchingLocations.length >= 2) break;
      }
      suggestions.push(...matchingLocations.slice(0, 2));
      console.log("🔍 [Autocomplete API] Found locations:", matchingLocations.length);
      console.log("🔍 [Autocomplete API] Total suggestions:", suggestions.length);

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
      const categories = await storage.getAllServiceCategories(true);
      const categoryNames = categories.map((c: { name: string }) => c.name);
      const checkAvailability = async (opts: { category: string; country: string; state?: string; city?: string }) => {
        const list = await storage.searchServices({
          category: opts.category,
          country: opts.country,
          state: opts.state,
          city: opts.city,
        }, 1, 0);
        return list.length;
      };
      const result = await runSmartSearch(query, { categoryNames, checkAvailability });
      
      // Ensure result is valid before sending
      if (!result || typeof result !== 'object') {
        console.error("[deepseek-error] Invalid result from runSmartSearch:", result);
        return res.status(200).json({
          kind: "category_not_found",
          message: "We didn't find any relevant categories. You can browse here to find what you need.",
        });
      }
      
      res.json(result);
    } catch (error) {
      console.error("[deepseek-error] Smart search error:", error);
      res.status(200).json({
        kind: "category_not_found",
        message: "We didn't find any relevant categories. You can browse here to find what you need.",
      });
    }
  });

  // ============== SERVICE ROUTES ==============

  // In-memory cache for ranked detectives (TTL: 2 minutes)
  const RANKED_DETECTIVES_TTL_MS = 2 * 60 * 1000;
  const rankedDetectivesCache = new Map<string, { expiresAt: number; data: any }>();
  const getRankedDetectivesCache = (key: string) => {
    const entry = rankedDetectivesCache.get(key);
    if (!entry) return undefined;
    if (Date.now() > entry.expiresAt) {
      rankedDetectivesCache.delete(key);
      return undefined;
    }
    return entry.data;
  };
  const setRankedDetectivesCache = (key: string, data: any) => {
    rankedDetectivesCache.set(key, { expiresAt: Date.now() + RANKED_DETECTIVES_TTL_MS, data });
  };

  // Search services (public)
  app.get("/api/services", async (req: Request, res: Response) => {
    try {
      const { category, country, search, minPrice, maxPrice, minRating, limit = "20", offset = "0", sortBy = "popular" } = req.query;
      const stableParams = [
        "category", "country", "search", "minPrice", "maxPrice", "minRating", "limit", "offset", "sortBy"
      ].sort().map(k => `${k}=${String((req.query as Record<string, string>)[k] ?? "").trim()}`).join("&");
      const cacheKey = `services:search:${stableParams}`;
      const skipCache = !!(req.session?.userId);
      if (!skipCache) {
        try {
          const cached = cache.get<{ services: unknown[] }>(cacheKey);
          if (cached != null && Array.isArray(cached.services)) {
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

      if (typeof search === 'string' && search.trim()) {
        await storage.recordSearch(search as string);
      }

      // Get all active services - ALL services visible
      const allServices = await storage.searchServices({
        category: category as string,
        country: country as string,
        searchQuery: search as string,
        minPrice: minPrice ? parseFloat(minPrice as string) : undefined,
        maxPrice: maxPrice ? parseFloat(maxPrice as string) : undefined,
        ratingMin: minRating ? parseFloat(minRating as string) : undefined,
      }, 10000, 0, sortBy as string);

      // Filter out services without images
      const servicesWithImages = allServices.filter((s: any) => {
        const hasImages = Array.isArray(s.images) && s.images.length > 0;
        return hasImages;
      });

      // Get detective rankings for sorting (NOT filtering)
      const rankedLimit = 1000;
      const rankedCacheKey = `ranked:${rankedLimit}`;
      let rankedDetectives = getRankedDetectivesCache(rankedCacheKey);
      if (!rankedDetectives) {
        const { getRankedDetectives } = await import("./ranking");
        rankedDetectives = await getRankedDetectives({ limit: rankedLimit });
        setRankedDetectivesCache(rankedCacheKey, rankedDetectives);
      }
      const detectiveRankMap = new Map(rankedDetectives.map((d: any, idx: number) => [d.id, { score: d.visibilityScore, rank: idx }]));

      // Sort services by detective ranking (higher score = higher position)
      const sortedServices = servicesWithImages.sort((a: any, b: any) => {
        const aRank = detectiveRankMap.get(a.detectiveId);
        const bRank = detectiveRankMap.get(b.detectiveId);
        // Higher score = better ranking = appears first
        if (aRank && bRank) {
          return bRank.score - aRank.score;
        }
        // Services without ranking appear after ranked ones
        if (aRank) return -1;
        if (bRank) return 1;
        return 0;
      });

      // Apply pagination after ranking
      const limitNum = parseInt(limit as string);
      const offsetNum = parseInt(offset as string);
      const paginatedServices = sortedServices.slice(offsetNum, offsetNum + limitNum);

      const masked = await Promise.all(paginatedServices.map(async (s: any) => {
        const maskedDetective = await maskDetectiveContactsPublic(s.detective);
        const effectiveBadges = computeEffectiveBadges(s.detective, (s.detective as any).subscriptionPackage);
        return { ...s, detective: { ...maskedDetective, effectiveBadges } };
      }));
      if (!skipCache) {
        try {
          cache.set(cacheKey, { services: masked }, 60);
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
      sendCachedJson(req, res, { services: masked });
    } catch (error) {
      console.error("Search services error:", error);
      res.status(500).json({ error: "Failed to search services" });
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
        const isComplete = service.isActive === true && Array.isArray(service.images) && service.images.length > 0 && !!service.title && !!service.description && !!service.category && !!service.basePrice;
        if (!isComplete) {
          return res.status(404).json({ error: "Service not available" });
        }
      }

      // Increment view count
      await storage.incrementServiceViews(req.params.id);

      // Get detective info
      let detective = await storage.getDetective(service.detectiveId);

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
      const services = await storage.getServicesByDetective(req.params.id);
      // Disable caching for detective dashboard - always fetch fresh data
      res.set("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
      res.set("Pragma", "no-cache");
      res.set("Expires", "0");
      sendCachedJson(req, res, { services });
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

  // Detective: get all reviews for my services
  app.get("/api/reviews/detective", requireAuth, async (req: Request, res: Response) => {
    try {
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

  // Get user's orders
  app.get("/api/orders/user", requireAuth, async (req: Request, res: Response) => {
    try {
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

  // Get user's favorites
  app.get("/api/favorites", requireAuth, async (req: Request, res: Response) => {
    try {
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
      sendpulseEmail.sendTransactionalEmail(
        application.email,
        EMAIL_TEMPLATES.DETECTIVE_APPLICATION_SUBMITTED,
        {
          detectiveName: application.fullName,
          email: application.email,
          supportEmail: "support@askdetectives.com",
        }
      ).catch(err => console.error("[Email] Failed to send application confirmation:", err));

      // Send admin notification (non-blocking)
      sendpulseEmail.sendAdminEmail(
        EMAIL_TEMPLATES.ADMIN_APPLICATION_RECEIVED,
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

          // Create detective profile with ALL application data
          // Determine if this is admin-created or self-registered
          const isAdminCreated = application.isClaimable === true;
          
          let detective = await storage.getDetectiveByUserId(user!.id);
          if (!detective) {
            detective = await storage.createDetective({
              userId: user!.id,
              businessName: application.companyName || application.fullName,
              bio: application.about || "Professional detective ready to help with your case.",
              logo: application.logo || undefined,
              defaultServiceBanner: (application as any).banner || undefined,
              subscriptionPlan: "free", // TODO: Remove in v3.0 - legacy field only
              subscriptionPackageId: null, // Explicitly NULL - user starts with FREE tier
              status: (await requirePolicy<{ value: string }>("post_approval_status"))?.value || "active",
              isVerified: true,
              isClaimed: isAdminCreated ? false : true,
              isClaimable: isAdminCreated ? true : false,
              createdBy: isAdminCreated ? "admin" : "self",
              country: application.country || "US",
              state: stateValue,
              city: cityValue,
              location: location,
              address: (application as any).fullAddress || undefined,
              pincode: (application as any).pincode || undefined,
              phone: phone,
              yearsExperience: application.yearsExperience || undefined,
              businessWebsite: application.businessWebsite || undefined,
              licenseNumber: application.licenseNumber || undefined,
              businessType: application.businessType || undefined,
              businessDocuments: application.businessType === 'agency' ? application.businessDocuments || undefined : undefined,
              identityDocuments: application.businessType === 'individual' ? (application as any).documents || undefined : undefined,
              mustCompleteOnboarding: !(application.serviceCategories && application.categoryPricing && application.serviceCategories.length > 0),
              onboardingPlanSelected: false,
            });
          } else {
            await storage.updateDetectiveAdmin(detective.id, {
              defaultServiceBanner: (application as any).banner || detective.defaultServiceBanner || undefined,
              status: (await requirePolicy<{ value: string }>("post_approval_status"))?.value || "active",
              isVerified: true,
              isClaimed: isAdminCreated ? false : true,
              isClaimable: isAdminCreated ? true : false,
            });
          }

          if (application.serviceCategories && application.categoryPricing) {
            const pricingData = application.categoryPricing as Array<{category: string; price: string; currency: string}>;
            for (const category of application.serviceCategories) {
              const pricing = pricingData.find(p => p.category === category);
              if (pricing && pricing.price) {
                const existing = await storage.getServiceByDetectiveAndCategory(detective.id, category);
                if (!existing) {
                  await storage.createService({
                    detectiveId: detective.id,
                    category,
                    title: `${category} Services`,
                    description: `Professional ${category.toLowerCase()} services by ${application.fullName}. Contact for detailed consultation.`,
                    basePrice: pricing.price,
                    images: (application as any).banner ? [(application as any).banner] : undefined,
                    isActive: true,
                  });
                }
              }
            }
          }

          console.log(`Detective account ${user ? "linked/created" : "unknown"} for: ${normalizedEmail} with ${application.serviceCategories?.length || 0} services.`);
        } catch (createError: any) {
          console.error("Failed to create detective account:", createError);
          const message = createError?.message || String(createError);
          return res.status(500).json({ 
            error: message.includes("FREE plan") ? message : `Failed to create detective account: ${message}`,
          });
        }
      }

      if (allowedData.status === "approved") {
        // Send approval email (non-blocking)
        const application = await storage.getDetectiveApplication(req.params.id);
        if (application) {
          sendpulseEmail.sendTransactionalEmail(
            application.email,
            EMAIL_TEMPLATES.DETECTIVE_APPLICATION_APPROVED,
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
                sendpulseEmail.sendTransactionalEmail(
                  application.email,
                  EMAIL_TEMPLATES.CLAIMABLE_ACCOUNT_INVITATION,
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
          sendpulseEmail.sendTransactionalEmail(
            application.email,
            EMAIL_TEMPLATES.DETECTIVE_APPLICATION_REJECTED,
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

          // Send SendPulse email (non-blocking)
          if (result.wasNewUser && result.temporaryPassword) {
            sendpulseEmail.sendTransactionalEmail(
              result.email,
              EMAIL_TEMPLATES.PROFILE_CLAIM_TEMPORARY_PASSWORD,
              {
                detectiveName: claimedDetective?.businessName || "Detective",
                email: result.email,
                temporaryPassword: result.temporaryPassword,
                supportEmail: "support@askdetectives.com",
              }
            ).catch(err => console.error("[Email] Failed to send temporary password email:", err));
          } else {
            sendpulseEmail.sendTransactionalEmail(
              result.email,
              EMAIL_TEMPLATES.PROFILE_CLAIM_APPROVED,
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
      const { hashToken, isTokenExpired } = await import("./services/claimTokenService.ts");
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
      const { hashToken, isTokenExpired } = await import("./services/claimTokenService.ts");
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
        const { generateTempPassword } = await import("./services/claimTokenService.ts");
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

        // Send temporary password email via SendPulse
        const loginUrl = "https://askdetectives.com/login";
        sendpulseEmail.sendTransactionalEmail(
          email,
          EMAIL_TEMPLATES.CLAIMABLE_ACCOUNT_CREDENTIALS,
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
      const { validateClaimFinalization } = await import("./services/claimTokenService.ts");
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
      sendpulseEmail.sendTransactionalEmail(
        claimedEmail,
        EMAIL_TEMPLATES.CLAIMABLE_ACCOUNT_FINALIZED,
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

  app.get("/api/admin/email-templates", requireRole("admin"), async (req: Request, res: Response) => {
    try {
      const { getAllEmailTemplates } = await import("./services/emailTemplateService");
      const templates = await getAllEmailTemplates();
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

      const { getEmailTemplate, extractTemplateVariables } = await import("./services/emailTemplateService");
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

      const { updateEmailTemplate, extractTemplateVariables } = await import("./services/emailTemplateService");
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

      const { toggleEmailTemplate } = await import("./services/emailTemplateService");
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

  app.post("/api/admin/email-templates/test-all", requireRole("admin"), async (req: Request, res: Response) => {
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

      const { getAllEmailTemplates } = await import("./services/emailTemplateService");
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

          // Only send if template has a SendPulse template ID
          if (template.sendpulseTemplateId) {
            console.log(
              `[Admin] Sending test email for template: ${template.key} (ID: ${template.sendpulseTemplateId})`
            );

            const result = await sendpulseEmail.sendTransactionalEmail(
              testEmail,
              template.sendpulseTemplateId,
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
          } else {
            console.warn(
              `[Admin] Template ${template.key} has no SendPulse template ID - skipping test`
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

  // Get distinct countries with detectives
  app.get("/api/locations/countries", async (req: Request, res: Response) => {
    try {
      console.log("[locations/countries] Starting query...");
      
      const result = await db
        .selectDistinct({ country: detectives.country })
        .from(detectives)
        .where(eq(detectives.status, "active"));
      
      console.log("[locations/countries] Query result:", result);
      
      if (!Array.isArray(result)) {
        console.warn("[locations/countries] Query result is not an array:", typeof result);
        return res.json({ countries: [] });
      }
      
      const countries = result
        .map(r => r.country)
        .filter(c => c != null && c !== '')
        .sort();
      
      console.log("[locations/countries] Filtered countries:", countries);
      res.json({ countries });
    } catch (error) {
      console.error("[locations/countries] ERROR DETAILS:", {
        message: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        type: error instanceof Error ? error.constructor.name : typeof error
      });
      res.status(500).json({ error: "Failed to get countries" });
    }
  });

  // Get distinct states for a country
  app.get("/api/locations/states", async (req: Request, res: Response) => {
    try {
      const { country } = req.query;
      if (!country || typeof country !== 'string') {
        return res.status(400).json({ error: "Country parameter required" });
      }

      console.log("[locations/states] Query for country:", country);
      const result = await db
        .selectDistinct({ state: detectives.state })
        .from(detectives)
        .where(and(
          eq(detectives.country, country),
          eq(detectives.status, "active")
        ));
      
      console.log("[locations/states] Query result:", result);
      
      if (!Array.isArray(result)) {
        console.warn("[locations/states] Query result is not an array:", typeof result);
        return res.json({ states: [] });
      }
      
      const states = result
        .map(r => r.state)
        .filter(s => s != null && s !== '')
        .sort();
      
      console.log("[locations/states] Filtered states:", states);
      res.json({ states });
    } catch (error) {
      console.error("[locations/states] ERROR DETAILS:", {
        message: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        type: error instanceof Error ? error.constructor.name : typeof error
      });
      res.status(500).json({ error: "Failed to get states" });
    }
  });

  // Get distinct cities for a country + state
  app.get("/api/locations/cities", async (req: Request, res: Response) => {
    try {
      const { country, state } = req.query;
      if (!country || typeof country !== 'string') {
        return res.status(400).json({ error: "Country parameter required" });
      }
      if (!state || typeof state !== 'string') {
        return res.status(400).json({ error: "State parameter required" });
      }

      console.log("[locations/cities] Query for country:", country, "state:", state);
      const result = await db
        .selectDistinct({ city: detectives.city })
        .from(detectives)
        .where(and(
          eq(detectives.country, country),
          eq(detectives.state, state),
          eq(detectives.status, "active")
        ));
      
      console.log("[locations/cities] Query result:", result);
      
      if (!Array.isArray(result)) {
        console.warn("[locations/cities] Query result is not an array:", typeof result);
        return res.json({ cities: [] });
      }
      
      const cities = result
        .map(r => r.city)
        .filter(c => c != null && c !== '')
        .sort();
      
      console.log("[locations/cities] Filtered cities:", cities);
      res.json({ cities });
    } catch (error) {
      console.error("[locations/cities] ERROR DETAILS:", {
        message: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        type: error instanceof Error ? error.constructor.name : typeof error
      });
      res.status(500).json({ error: "Failed to get cities" });
    }
  });

  // ============== SERVICE CATEGORY ROUTES ==============

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
      const popular = await storage.getPopularSearches(6);
      res.set("Cache-Control", "public, max-age=60, stale-while-revalidate=300");
      sendCachedJson(_req, res, { categories: popular.map(p => ({ category: p.query, count: p.count })) });
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
      const updatedCategory = await storage.updateServiceCategory(req.params.id, validatedData);
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
      res.json({ message: "Service category deleted successfully" });
    } catch (error) {
      console.error("Delete service category error:", error);
      res.status(500).json({ error: "Failed to delete service category" });
    }
  });

  // Health and dev helpers
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
  app.get("/api/snippets", requireRole("admin"), async (req: Request, res: Response) => {
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

    const whereConditions = [
      eq(detectives.status, "active"),
      eq(detectives.country, String(country)),
      eq(services.category, String(category)),
    ];
    if (state) whereConditions.push(eq(detectives.state, String(state)));
    if (city) whereConditions.push(eq(detectives.city, String(city)));

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
        const countriesResult = await db
          .selectDistinct({ country: detectives.country })
          .from(detectives)
          .innerJoin(services, eq(services.detectiveId, detectives.id))
          .where(and(
            eq(detectives.status, "active"),
            eq(services.isActive, true)
          ));
        const countries = countriesResult
          .map((r) => r.country)
          .filter((c) => c != null && c !== "")
          .sort();
        setSnippetLocationsCache(cacheKey, countries);
        return res.json({ countries });
      }

      if (!hasState) {
        const cacheKey = `snippets:locations:states:${String(country)}`;
        const cached = getSnippetLocationsCache(cacheKey);
        if (cached) {
          return res.json({ states: cached });
        }
        const statesResult = await db
          .selectDistinct({ state: detectives.state })
          .from(detectives)
          .innerJoin(services, eq(services.detectiveId, detectives.id))
          .where(and(
            eq(detectives.status, "active"),
            eq(services.isActive, true),
            eq(detectives.country, String(country))
          ));
        const states = statesResult
          .map((r) => r.state)
          .filter((s) => s && s !== "Not specified")
          .sort();
        setSnippetLocationsCache(cacheKey, states);
        return res.json({ states });
      }

      const cacheKey = `snippets:locations:cities:${String(country)}:${String(stateParam)}`;
      const cached = getSnippetLocationsCache(cacheKey);
      if (cached) {
        return res.json({ cities: cached });
      }
      const citiesResult = await db
        .selectDistinct({ city: detectives.city })
        .from(detectives)
        .innerJoin(services, eq(services.detectiveId, detectives.id))
        .where(and(
          eq(detectives.status, "active"),
          eq(services.isActive, true),
          eq(detectives.country, String(country)),
          eq(detectives.state, String(stateParam))
        ));
      const cities = citiesResult
        .map((r) => r.city)
        .filter((c) => c && c !== "Not specified")
        .sort();
      setSnippetLocationsCache(cacheKey, cities);
      return res.json({ cities });
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

      const limitNum = Math.min(Math.max(parseInt(String(limit)) || 4, 1), 20);
      const params: (string | number)[] = [String(country), String(category)];
      let paramIdx = 3;
      const stateClause = state ? ` AND d.state = $${paramIdx++}` : "";
      if (state) params.push(String(state));
      const cityClause = city ? ` AND d.city = $${paramIdx++}` : "";
      if (city) params.push(String(city));
      params.push(limitNum);

      const q = `
        SELECT s.id AS service_id, s.title AS service_title, s.images AS service_images,
               s.base_price, s.offer_price, s.category AS service_category,
               d.id AS detective_id, d.business_name, d.level, d.logo, d.is_verified, d.location, d.country,
               d.has_blue_tick, d.blue_tick_addon, d.subscription_package_id, d.subscription_expires_at,
               sp.badges AS subscription_badges,
               (SELECT COALESCE(AVG(r.rating), 0) FROM reviews r WHERE r.service_id = s.id) AS avg_rating,
               (SELECT COUNT(*)::int FROM reviews r WHERE r.service_id = s.id) AS review_count
        FROM services s
        INNER JOIN detectives d ON d.id = s.detective_id AND d.status = 'active'
        LEFT JOIN subscription_plans sp ON sp.id = d.subscription_package_id
        WHERE s.is_active = true AND d.country = $1 AND s.category = $2${stateClause}${cityClause}
        ORDER BY avg_rating DESC NULLS LAST
        LIMIT $${paramIdx}
      `;

      const result = await pool.query<{
        service_id: string;
        service_title: string | null;
        service_images: string[] | null;
        base_price: string;
        offer_price: string | null;
        service_category: string | null;
        detective_id: string;
        business_name: string | null;
        level: string;
        logo: string | null;
        is_verified: boolean;
        location: string;
        country: string | null;
        has_blue_tick: boolean;
        blue_tick_addon: boolean;
        subscription_package_id: string | null;
        subscription_expires_at: string | null;
        subscription_badges: unknown;
        avg_rating: string;
        review_count: string;
      }>(q, params);

      res.json({
        detectives: result.rows.map((r) => {
          const effectiveBadges = computeEffectiveBadges(
            {
              subscriptionPackageId: r.subscription_package_id,
              subscriptionExpiresAt: r.subscription_expires_at,
              hasBlueTick: r.has_blue_tick,
              blueTickAddon: r.blue_tick_addon,
            },
            r.subscription_badges ? { badges: r.subscription_badges } : null
          );
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
            serviceTitle: r.service_title ?? r.service_category ?? "Service",
            serviceImages: Array.isArray(r.service_images) ? r.service_images : (r.service_images ? [r.service_images] : []),
            serviceCategory: r.service_category ?? "",
            effectiveBadges,
          };
        }),
      });
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

  return httpServer;
}