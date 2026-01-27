import type { Express, Request, Response, NextFunction } from "express";
import { createHash } from "node:crypto";
import { createServer, type Server } from "http";
import { storage } from "./storage.ts";
import { sendClaimApprovedEmail } from "./email.ts";
import bcrypt from "bcrypt";
import { 
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

export async function registerRoutes(app: Express): Promise<Server> {
  const SUBSCRIPTION_LIMITS: Record<string, number> = { free: 2, pro: 4, agency: 1000 };
  
  function createPlanCache() {
    const cache = new Map<string, any>();
    return {
      async get(planName: string) {
        const key = (planName || "").toLowerCase();
        if (cache.has(key)) return cache.get(key);
        const plan = await storage.getSubscriptionPlanByName(key);
        cache.set(key, plan);
        return plan;
      }
    };
  }

  async function maskDetectiveContactsPublic(d: any, planCache?: { get: (name: string) => Promise<any> }): Promise<any> {
    try {
      const plan = planCache ? await planCache.get(String(d.subscriptionPlan || "")) : await storage.getSubscriptionPlanByName(String(d.subscriptionPlan || "").toLowerCase());
      const features = Array.isArray(plan?.features) ? (plan!.features as string[]) : [];
      const hasEmail = features.includes("contact_email");
      const hasPhone = features.includes("contact_phone");
      const hasWhatsApp = features.includes("contact_whatsapp");
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
    } catch {
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
    const hasInactive = Array.isArray(existingPlans) && existingPlans.some(p => p.isActive === false);
    if (!hasInactive) {
      await storage.createSubscriptionPlan({
        name: "trial-inactive",
        displayName: "Trial Inactive",
        monthlyPrice: "0",
        yearlyPrice: "0",
        description: "Sample inactive plan for validation.",
        features: [],
        badges: {},
        serviceLimit: 1,
        isActive: false,
      });
      console.log("[seed] Created sample inactive subscription plan: trial-inactive");
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

  app.post("/api/dev/create-inactive-plan", async (_req: Request, res: Response) => {
    try {
      const current = await storage.getAllSubscriptionPlans(false);
      const hasInactive = Array.isArray(current) && current.some(p => p.isActive === false);
      if (hasInactive) {
        return res.json({ created: false, message: "Inactive plan already exists" });
      }
      const plan = await storage.createSubscriptionPlan({
        name: "trial-inactive",
        displayName: "Trial Inactive",
        monthlyPrice: "0",
        yearlyPrice: "0",
        description: "Sample inactive plan for validation.",
        features: [],
        badges: {},
        serviceLimit: 1,
        isActive: false,
      });
      res.json({ created: true, plan });
    } catch (e) {
      res.status(400).json({ error: "Failed to create inactive plan" });
    }
  });
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

      const planCache = createPlanCache();

      const detectives = await storage.searchDetectives({
        country: country as string,
        status: ((status as string) || "active") as string,
        plan: plan as string,
        searchQuery: search as string,
      }, parseInt(limit), parseInt(offset));

      const maskedDetectives = await Promise.all(detectives.map(async (d: any) => {
        const masked = await maskDetectiveContactsPublic(d, planCache);
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

      const limitNum = parseInt(limit);
      const offsetNum = parseInt(offset);
      const total = detectives.length < limitNum
        ? offsetNum + detectives.length
        : await storage.countDetectives();
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
      if (req.query.seed === 'inactive') {
        const current = await storage.getAllSubscriptionPlans(false);
        const hasInactive = Array.isArray(current) && current.some(p => p.isActive === false);
        if (!hasInactive) {
          await storage.createSubscriptionPlan({
            name: "trial-inactive",
            displayName: "Trial Inactive",
            monthlyPrice: "0",
            yearlyPrice: "0",
            description: "Sample inactive plan for validation.",
            features: [],
            badges: {},
            serviceLimit: 1,
            isActive: false,
          });
        }
      }
      const plans = await storage.getAllSubscriptionPlans(!includeInactive);
      res.json({ plans });
    } catch {
      res.json({ plans: [] });
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
      const detective = await storage.getDetectiveByUserId(req.session.userId!);
      if (!detective) {
        return res.status(404).json({ error: "Detective profile not found" });
      }
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
        subscriptionPlan: z.enum(["free", "pro", "agency"]).optional(),
        isVerified: z.boolean().optional(),
        country: z.string().optional(),
        level: z.enum(["level1", "level2", "level3", "pro"]).optional(),
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

      const planCache = createPlanCache();

      const services = await storage.searchServices({
        category: category as string,
        country: country as string,
        searchQuery: search as string,
        minPrice: minPrice ? parseFloat(minPrice as string) : undefined,
        maxPrice: maxPrice ? parseFloat(maxPrice as string) : undefined,
        ratingMin: minRating ? parseFloat(minRating as string) : undefined,
      }, parseInt(limit as string), parseInt(offset as string), sortBy as string);

      const masked = await Promise.all(services.map(async (s: any) => ({ 
        ...s, 
        detective: await maskDetectiveContactsPublic(s.detective, planCache) 
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
      const plan = await storage.getSubscriptionPlanByName(String(detective.subscriptionPlan || "").toLowerCase());
      const maxAllowed = Number(plan?.serviceLimit || 0);
      if (currentServices.length >= maxAllowed) {
        return res.status(400).json({ error: `Plan limit reached. Max ${maxAllowed} services allowed for ${detective.subscriptionPlan}.` });
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

      const maxAllowed = SUBSCRIPTION_LIMITS[detective.subscriptionPlan] ?? SUBSCRIPTION_LIMITS.free;
      const limits = { min: 1, max: maxAllowed };
      if (drafts.length < limits.min) {
        return res.status(400).json({ error: `Must submit at least ${limits.min} services for ${detective.subscriptionPlan} plan` });
      }
      if (drafts.length > limits.max) {
        return res.status(400).json({ error: `You can submit up to ${limits.max} services for ${detective.subscriptionPlan} plan` });
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
              subscriptionPlan: "free",
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

  const httpServer = createServer(app);

  return httpServer;
}
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
