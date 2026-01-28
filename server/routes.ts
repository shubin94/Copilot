import type { Express, Request, Response, NextFunction } from "express";
import { createHash } from "node:crypto";
import crypto from "crypto";
import { createServer, type Server } from "http";
import { storage } from "./storage.ts";
import { sendClaimApprovedEmail } from "./email.ts";
import bcrypt from "bcrypt";
import Razorpay from "razorpay";
import { db } from "../db/index.ts";
import { eq } from "drizzle-orm";
import {
  detectives,
  detectiveVisibility,
  users,
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
import pkg from "pg";
const { Pool } = pkg;
import { requirePolicy } from "./policy.ts";

const razorpayClient = new Razorpay({
  key_id: config.razorpay.keyId,
  key_secret: config.razorpay.keySecret,
});

// Extend Express Session
declare module "express-session" {
  interface SessionData {
    userId: string;
    userRole: string;
  }
}

// Middleware to check if user is authenticated
const requireAuth = (req: Request, res: Response, next: NextFunction) => {
  if (!req.session.userId) {
    return res.status(401).json({ error: "Unauthorized - Please log in" });
  }
  next();
};

// Middleware to check for specific roles
const requireRole = (...roles: string[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.session.userId) {
      return res.status(401).json({ error: "Unauthorized - Please log in" });
    }
    if (!roles.includes(req.session.userRole || "")) {
      return res.status(403).json({ error: "Forbidden - Insufficient permissions" });
    }
    next();
  };
};

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

export async function registerRoutes(app: Express): Promise<Server> {
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
          hasEmail = features.includes("contact_email");
          hasPhone = features.includes("contact_phone");
          hasWhatsApp = features.includes("contact_whatsapp");
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
            hasEmail = features.includes("contact_email");
            hasPhone = features.includes("contact_phone");
            hasWhatsApp = features.includes("contact_whatsapp");
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
  
  // ============== AUTHENTICATION ROUTES ==============
  
  // Register new user
  app.post("/api/auth/register", async (req: Request, res: Response) => {
    try {
      const validatedData = insertUserSchema.parse(req.body);
      
      // Check if user already exists
      const existingUser = await storage.getUserByEmail(validatedData.email);
      if (existingUser) {
        return res.status(400).json({ error: "Email already registered" });
      }

      const user = await storage.createUser(validatedData);
      
      // Set session
      req.session.userId = user.id;
      req.session.userRole = user.role;

      // Don't send password in response
      const { password, ...userWithoutPassword } = user;
      res.status(201).json({ user: userWithoutPassword });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: fromZodError(error).message });
      }
      console.error("Registration error:", error);
      res.status(500).json({ error: "Failed to register user" });
    }
  });

  // Dev endpoint removed - Trial Inactive plan cannot be auto-recreated

  // Login
  app.post("/api/auth/login", async (req: Request, res: Response) => {
    try {
      let { email, password } = req.body as { email: string; password: string };
      email = (email || "").toLowerCase().trim();

      if (!email || !password) {
        return res.status(400).json({ error: "Email and password are required" });
      }

      // Only database-backed credentials are allowed

      const user = await storage.getUserByEmail(email);
      if (!user) {
        // Check pending detective application
        const application = await storage.getDetectiveApplicationByEmail(email);
        if (application) {
          const match = await bcrypt.compare(password, application.password);
          if (match) {
            return res.json({ applicant: { email: application.email, status: application.status } });
          }
        }
        console.warn(`[auth] Login failed: user not found for email=${email}`);
        return res.status(401).json({ error: "Invalid email or password" });
      }

      let validPassword = false;
      try {
        validPassword = await bcrypt.compare(password, user.password);
      } catch (e) {
        console.error("Password compare error:", e);
        return res.status(400).json({ error: "Invalid email or password" });
      }
      if (!validPassword) {
        console.warn(`[auth] Login failed: password mismatch for userId=${user.id}, email=${email}`);
        return res.status(401).json({ error: "Invalid email or password" });
      }

      // Set session
      req.session.userId = user.id;
      req.session.userRole = user.role;

      // Don't send password in response
      const { password: _, ...userWithoutPassword } = user;
      res.json({ user: userWithoutPassword });
    } catch (error) {
      console.error("Login error:", error);
      res.status(500).json({ error: "Failed to log in" });
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
    } catch (error) {
      console.error("Change password error:", error);
      res.status(500).json({ error: "Failed to change password" });
    }
  });

  // Admin: verify a user's password
  app.post("/api/admin/users/check-password", requireRole("admin"), async (req: Request, res: Response) => {
    try {
      const { email, password } = req.body as { email?: string; password?: string };
      if (!email || !password) return res.status(400).json({ error: "Email and password required" });
      const user = await storage.getUserByEmail(email.toLowerCase().trim());
      if (!user) return res.status(404).json({ error: "User not found" });
      const match = await bcrypt.compare(password, user.password);
      res.json({ match, userId: user.id, role: user.role, mustChangePassword: (user as any).mustChangePassword === true });
    } catch (error) {
      console.error("Admin check password error:", error);
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
    } catch (error) {
      console.error("Set password error:", error);
      res.status(500).json({ error: "Failed to set password" });
    }
  });

  // Logout
  app.post("/api/auth/logout", (req: Request, res: Response) => {
    req.session.destroy((err) => {
      if (err) {
        return res.status(500).json({ error: "Failed to log out" });
      }
      res.clearCookie("connect.sid");
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
        status: ((status as string) || "active") as string,
        plan: plan as string,
        searchQuery: search as string,
        limit: 100,
      });

      // Apply filters based on query
      if (country) {
        detectives = detectives.filter((d: any) => d.country === country);
      }
      if (status && status !== "active") {
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

      res.set("Cache-Control", "public, max-age=60, stale-while-revalidate=300");
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
      const usersCount = await storage.countUsers();
      const detectivesCount = await storage.countDetectives();
      const servicesCount = await storage.countServices();
      const applicationsCount = await storage.countApplications();
      const claimsCount = await storage.countClaims();
      res.json({ usersCount, detectivesCount, servicesCount, applicationsCount, claimsCount });
    } catch (error) {
      console.error("DB check error:", error);
      res.status(500).json({ error: "DB check failed" });
    }
  });

  app.get("/api/admin/detectives/raw", requireRole("admin"), async (_req: Request, res: Response) => {
    try {
      const detectives = await storage.getAllDetectives(500, 0);
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

  app.get("/api/subscription-plans", async (req: Request, res: Response) => {
    try {
      const includeInactive = (req.query.all === '1' || req.query.includeInactive === '1' || req.query.activeOnly === '0');
      const plans = await storage.getAllSubscriptionPlans(!includeInactive);
      res.json({ plans });
    } catch {
      res.json({ plans: [] });
    }
  });

  // ============== PAYMENT (RAZORPAY) ROUTES ==============

  // Upgrade to free or paid plan (price === 0 goes directly, price > 0 requires payment)
  app.post("/api/payments/upgrade-plan", requireRole("detective"), async (req: Request, res: Response) => {
    res.setHeader('Content-Type', 'application/json');
    
    try {
      const detective = await storage.getDetectiveByUserId(req.session.userId!);
      if (!detective) {
        console.error("[upgrade-plan] Detective not found for userId:", req.session.userId);
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
      if (!config.razorpay.keyId || !config.razorpay.keySecret) {
        console.error("[create-order] Razorpay not configured");
        return res.status(500).json({ error: "Payments not configured" });
      }

      // Reject requests with old field names
      if (req.body.plan || req.body.subscriptionPlan) {
        console.error("[create-order] Rejected: Request contains deprecated field (plan or subscriptionPlan)");
        return res.status(400).json({ error: "Invalid request. Use packageId and billingCycle instead." });
      }

      const detective = await storage.getDetectiveByUserId(req.session.userId!);
      if (!detective) {
        console.error("[create-order] Detective not found for userId:", req.session.userId);
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

      // Select price based on billing cycle
      const priceString = billingCycle === "monthly" ? packageRecord.monthlyPrice : packageRecord.yearlyPrice;
      const amount = Number(priceString || 0);
      
      // Validate price
      if (!amount || Number.isNaN(amount) || amount <= 0) {
        console.error(`[create-order] Invalid ${billingCycle} price for package ${packageId}: ${priceString}`);
        return res.status(400).json({ error: `Package has no valid ${billingCycle} price` });
      }

      const amountPaise = Math.round(amount * 100);
      console.log(`[create-order] Creating Razorpay order for ₹${amount} (${amountPaise} paise) - ${billingCycle}`);
      
      // Create Razorpay order (receipt max 40 chars)
      const order = await razorpayClient.orders.create({
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
        amount: String(amount),
        currency: "INR",
        razorpayOrderId: order.id,
        status: "created",
      } as any);

      console.log(`[create-order] Payment order saved to DB with billing cycle: ${billingCycle}`);
      
      // Return response
      res.json({ 
        orderId: order.id, 
        amount: amountPaise,
        key: config.razorpay.keyId 
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
      if (!config.razorpay.keyId || !config.razorpay.keySecret) {
        console.error("[verify] Razorpay not configured");
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
        console.error(`[verify] Forbidden: User ${req.session.userId} does not own order ${body.razorpay_order_id}`);
        return res.status(403).json({ error: "Forbidden" });
      }

      // Verify Razorpay signature
      const expected = crypto
        .createHmac("sha256", config.razorpay.keySecret)
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

      // Update detective with new subscription (subscriptionPackageId is the ONLY field to track subscriptions)
      await storage.updateDetectiveAdmin(paymentOrder.detectiveId, {
        subscriptionPackageId: packageId,
        billingCycle: billingCycle,
        subscriptionActivatedAt: new Date(),
        // Note: subscriptionPlan and planActivatedAt are LEGACY fields - not updated during payment
      } as any);

      console.log(`[verify] Detective subscription fields updated`);

      // Fetch updated detective to return to client
      const updatedDetective = await storage.getDetective(paymentOrder.detectiveId);
      
      if (!updatedDetective) {
        console.error(`[verify] Could not fetch updated detective: ${paymentOrder.detectiveId}`);
        return res.status(500).json({ error: "Failed to fetch updated detective" });
      }

      console.log(`[verify] Successfully updated detective: subscriptionPackageId=${updatedDetective.subscriptionPackageId}, billingCycle=${updatedDetective.billingCycle}, activatedAt=${updatedDetective.subscriptionActivatedAt}`);
      console.log("[verify] === PAYMENT VERIFICATION COMPLETE ===");

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
      const { detectiveId } = req.body;
      
      if (!detectiveId) {
        return res.status(400).json({ error: "detectiveId is required" });
      }

      console.log(`[admin-sync] Starting payment sync recovery for detective: ${detectiveId}`);

      // Fetch detective to check current state
      const detective = await storage.getDetective(detectiveId);
      if (!detective) {
        console.error(`[admin-sync] Detective not found: ${detectiveId}`);
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
        console.error("[blue-tick-order] Detective not found for userId:", req.session.userId);
        return res.status(400).json({ error: "Detective profile not found" });
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

      // Blue Tick pricing: $15/month or $150/year
      const amount = billingCycle === "yearly" ? 150 : 15;
      const amountPaise = Math.round(amount * 100);
      
      // Create Razorpay order
      const order = await razorpayClient.orders.create({
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
        key: config.razorpay.keyId,
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
      if (!config.razorpay.keyId || !config.razorpay.keySecret) {
        console.error("[verify-blue-tick] Razorpay not configured");
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
        .createHmac("sha256", config.razorpay.keySecret)
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
        console.error(`[verify-blue-tick] Detective not found for user ${req.session.userId}`);
        return res.status(400).json({ error: "Detective not found" });
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

      console.log(`[verify-blue-tick] Successfully activated Blue Tick for detective: hasBlueTick=${updatedDetective.hasBlueTick}`);
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
      const parsed = z.object({
        name: z.string().min(2),
        displayName: z.string().min(2).optional(),
        monthlyPrice: z.number().min(0),
        yearlyPrice: z.number().min(0),
        description: z.string().optional(),
        features: z.array(z.string()).optional(),
        badges: z.any().optional(),
        serviceLimit: z.number().int().min(0),
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
      const raw = req.body as any;
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
        serviceLimit: z.number().int().min(0).optional(),
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
      
      // Apply pending downgrades if expiry has passed
      detective = await applyPendingDowngrades(detective);
      
      res.json({ detective });
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
      res.set("Cache-Control", "public, max-age=300, stale-while-revalidate=600");
      sendCachedJson(req, res, { detective, claimInfo });
    } catch (error) {
      console.error("Get detective error:", error);
      res.status(500).json({ error: "Failed to get detective" });
    }
  });

  // Public: get user profile by id (limited fields)
  app.get("/api/users/:id", async (req: Request, res: Response) => {
    try {
      const user = await storage.getUser(req.params.id);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
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

      // Generate a random temporary password
      const tempPassword = Math.random().toString(36).slice(-10) + Math.random().toString(36).slice(-10).toUpperCase();
      
      await storage.resetDetectivePassword(detective.userId, tempPassword);
      
      // Return the temporary password to the admin
      res.json({ 
        message: "Password reset successfully",
        temporaryPassword: tempPassword,
        email: detective.email
      });
    } catch (error) {
      console.error("Reset password error:", error);
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

  // ============== SERVICE ROUTES ==============

  // Search services (public)
  app.get("/api/services", async (req: Request, res: Response) => {
    try {
      const { category, country, search, minPrice, maxPrice, minRating, limit = "20", offset = "0", sortBy = "popular" } = req.query;
      if (typeof search === 'string' && search.trim()) {
        await storage.recordSearch(search as string);
      }

      // First get detectives ranked by visibility
      const { getRankedDetectives } = await import("./ranking.ts");
      const rankedDetectives = await getRankedDetectives({ limit: 1000 });
      const visibleDetectiveIds = new Set(rankedDetectives.map((d: any) => d.id));

      // Then search services from visible detectives
      const allServices = await storage.searchServices({
        category: category as string,
        country: country as string,
        searchQuery: search as string,
        minPrice: minPrice ? parseFloat(minPrice as string) : undefined,
        maxPrice: maxPrice ? parseFloat(maxPrice as string) : undefined,
        ratingMin: minRating ? parseFloat(minRating as string) : undefined,
      }, 10000, 0, sortBy as string); // Fetch all, then filter and paginate

      // Filter services from visible detectives
      const visibleServices = allServices.filter((s: any) => visibleDetectiveIds.has(s.detectiveId));

      // Apply pagination
      const limitNum = parseInt(limit as string);
      const offsetNum = parseInt(offset as string);
      const paginatedServices = visibleServices.slice(offsetNum, offsetNum + limitNum);

      const masked = await Promise.all(paginatedServices.map(async (s: any) => ({ 
        ...s, 
        detective: await maskDetectiveContactsPublic(s.detective) 
      })));
      res.set("Cache-Control", "public, max-age=60, stale-while-revalidate=300");
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
      res.json({ 
        service,
        detective,
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

      const pricing = await requirePolicy<{ offerLessThanBase: boolean }>("pricing_constraints");
      const base = parseFloat(validatedData.basePrice as any);
      if (!(base > 0)) {
        return res.status(400).json({ error: "Base price must be a positive number" });
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
      res.set("Cache-Control", "public, max-age=60, stale-while-revalidate=300");
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

      const currentBase = validatedData.basePrice !== undefined ? parseFloat(validatedData.basePrice as any) : parseFloat((service as any).basePrice as any);
      if (!(currentBase > 0)) {
        return res.status(400).json({ error: "Base price must be a positive number" });
      }
      if (validatedData.offerPrice !== undefined && validatedData.offerPrice !== null) {
        const offer = parseFloat(validatedData.offerPrice as any);
        if (!(offer > 0) || !(offer < currentBase)) {
          return res.status(400).json({ error: "Offer price must be positive and strictly lower than base price" });
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
      await storage.deleteService(req.params.id);
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

  // Get user's orders
  app.get("/api/orders/user", requireAuth, async (req: Request, res: Response) => {
    try {
      const { limit = "50" } = req.query;
      const orders = await storage.getOrdersByUser(req.session.userId!, parseInt(limit as string));
      res.json({ orders });
    } catch (error) {
      console.error("Get user orders error:", error);
      res.status(500).json({ error: "Failed to get orders" });
    }
  });

  // Get detective's orders
  app.get("/api/orders/detective", requireRole("detective"), async (req: Request, res: Response) => {
    try {
      const detective = await storage.getDetectiveByUserId(req.session.userId!);
      if (!detective) {
        return res.status(400).json({ error: "Detective profile not found" });
      }

      const { limit = "50" } = req.query;
      const orders = await storage.getOrdersByDetective(detective.id, parseInt(limit as string));
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
    console.log("=== RECEIVED POST /api/applications ===");
    console.log("Request body size:", JSON.stringify(req.body).length);
    console.log("Request has logo:", !!req.body.logo);
    console.log("Request has documents:", !!req.body.documents);
    
    try {
      console.log("Validating request body...");
      const validatedData = insertDetectiveApplicationSchema.parse(req.body);
      console.log("Validation passed");
      
      // Hash the password before storing - CRITICAL SECURITY
      console.log("Hashing password...");
      const hashedPassword = await bcrypt.hash(validatedData.password, 10);
      console.log("Password hashed");
      
      // Duplicate checks for email/phone
      const existingByEmail = await storage.getDetectiveApplicationByEmail(validatedData.email);
      const hasPhone = !!validatedData.phoneCountryCode && !!validatedData.phoneNumber;
      const existingByPhone = hasPhone
        ? await storage.getDetectiveApplicationByPhone(validatedData.phoneCountryCode!, validatedData.phoneNumber!)
        : undefined;

      // isAdmin was declared above; reuse it here
      if (existingByEmail || existingByPhone) {
        if (!isAdmin) {
          const conflictField = existingByEmail ? "email" : "phone";
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
      
      console.log("Inserting into database...");
      const application = await storage.createDetectiveApplication(applicationData);
      console.log("Application created with ID:", application.id);
      
      res.status(201).json({ application });
    } catch (error) {
      console.error("=== APPLICATION CREATION ERROR ===");
      if (error instanceof z.ZodError) {
        console.error("Validation error:", fromZodError(error).message);
        return res.status(400).json({ error: fromZodError(error).message });
      }
      console.error("Create application error:", error);
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
          let user = await storage.getUserByEmail(normalizedEmail);
          if (!user) {
            try {
              user = await storage.createUserFromHashed({
                email: normalizedEmail,
                name: application.fullName,
                password: application.password,
                role: "detective",
                avatar: application.logo || undefined,
              });
            } catch (e: any) {
              if ((e?.message || "").includes("users_email_unique")) {
                user = await storage.getUserByEmail(normalizedEmail);
              } else {
                throw e;
              }
            }
          }

          // Build location string from application data
          const locationParts = [];
          if (application.city) locationParts.push(application.city);
          if (application.state) locationParts.push(application.state);
          const location = locationParts.length > 0 ? locationParts.join(", ") : "Not specified";

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
          return res.status(500).json({ 
            error: "Failed to create detective account. Application not approved.",
            details: createError.message 
          });
        }
      }

      if (allowedData.status === "approved" || allowedData.status === "rejected") {
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
          await sendClaimApprovedEmail({
            to: result.email,
            detectiveName: claimedDetective?.businessName || "Detective",
            wasNewUser: result.wasNewUser,
            temporaryPassword: result.temporaryPassword,
          });

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

  // Dev bootstrap endpoints removed to avoid any hard-coded credentials

  app.get("/api/dev/audit-storage", async (_req: Request, res: Response) => {
    try {
      if (process.env.NODE_ENV !== 'development') {
        return res.status(404).json({ error: "Not available" });
      }
      const issues: Array<{ table: string; id: string; field: string; value: string }> = [];
      const detectives = await storage.getAllDetectives();
      for (const d of detectives) {
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
      const services = await storage.getAllServices();
      for (const s of services) {
        const imgs = (s as any).images || [];
        for (const v of imgs) {
          if (typeof v === "string" && v && !parsePublicUrl(v)) {
            issues.push({ table: "services", id: s.id as any, field: "images", value: v });
          }
        }
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
      const { ranking } = await import("./ranking.ts");
      const visibilityRecords = await db.select().from(detectiveVisibility);
      
      // Enrich with detective info
      const enriched = await Promise.all(
        visibilityRecords.map(async (v) => {
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