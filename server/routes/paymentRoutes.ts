import type { Express, Request, Response } from "express";
import { randomBytes } from "node:crypto";
import crypto from "crypto";
import Razorpay from "razorpay";
import { z } from "zod";
import { fromZodError } from "zod-validation-error";
import { pool } from "../../db/index";
import { storage } from "../storage";
import { getSmtpEmailService, EMAIL_TEMPLATE_KEYS } from "../services/smtpEmailService";
import { getPaymentGateway } from "../services/paymentGateway";
import { createPayPalOrder, capturePayPalOrder, verifyPayPalCapture } from "../services/paypal";
import { applyPackageEntitlements } from "../services/entitlements";
import { clearFreePlanCache } from "../services/freePlan";
import * as cache from "../lib/cache";
import { config } from "../config";
import { requireRole } from "../authMiddleware";

// ============== HELPER FUNCTIONS ==============

// Initialize Razorpay lazily - only when first accessed
let razorpayClient: Razorpay | null = null;

function getDefaultRazorpayClient(): Razorpay {
  if (!razorpayClient) {
    razorpayClient = new Razorpay({
      key_id: config.razorpay.keyId || "dummy",
      key_secret: config.razorpay.keySecret || "dummy",
    });
  }
  return razorpayClient;
}

// Helper to get/refresh Razorpay client from database
async function getRazorpayClient() {
  const gateway = await getPaymentGateway('razorpay');
  
  if (!gateway) {
    console.warn('[Razorpay] Gateway not enabled, falling back to env config');
    return getDefaultRazorpayClient();
  }
  
  // Reinitialize with DB config
  const dbClient = new Razorpay({
    key_id: gateway.config.keyId || config.razorpay.keyId,
    key_secret: gateway.config.keySecret || config.razorpay.keySecret,
  });
  
  console.log(`[Razorpay] Using ${gateway.is_test_mode ? 'TEST' : 'LIVE'} mode from database`);
  return dbClient;
}

// Helper: Rotate CSRF token after sensitive operations
function rotateCsrfToken(req: Request): string {
  const newToken = randomBytes(32).toString("hex");
  req.session.csrfToken = newToken;
  req.session.csrfTokenGeneratedAt = Date.now();
  return newToken;
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


// ============== PAYMENT ROUTES ==============

export async function registerPaymentRoutes(app: Express): Promise<void> {
  console.log('[Payment Routes] Registering payment routes');

  // Initialize email service lazily
  const smtpEmailService = getSmtpEmailService();

  // ============== PUBLIC SUBSCRIPTION ENDPOINTS ==============

  // Get subscription limits for all active plans
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

  // Get all active subscription plans
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

  // ============== DETECTIVE PAYMENT ROUTES ==============

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

  // ============== RAZORPAY PAYMENT ROUTES ==============

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
      const order = await (rzpClient.orders.create({
        amount: amountPaise,
        currency: "INR",
        receipt: `sub_${Date.now()}`.substring(0, 40),
        notes: {
          packageId,
          packageName: packageRecord.name,
          billingCycle,
          detectiveId: detective.id,
          userId: req.session.userId ?? "",
        },
      }) as Promise<{ id: string }>);

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
      } as any);

      console.log(`[verify] Subscription activated for detective ${paymentOrder.detectiveId}`);

      // APPLY ENTITLEMENTS: Use centralized entitlement system
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

  // ============== PAYPAL PAYMENT ROUTES ==============

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
      
      // GUARD: Block duplicate Blue Tick purchases (HARD RULE)
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
        currency: "USD",
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
        paypalOrderId: order.id,
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
        // Blue Tick add-on: set add-on flag only
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
        } as any);
        
        console.log(`[paypal-capture] Subscription activated for detective ${paymentOrder.detectiveId}`);

        // APPLY ENTITLEMENTS
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
          smtpEmailService.sendTransactionalEmail(
            user.email,
            EMAIL_TEMPLATE_KEYS.PAYMENT_SUCCESS,
            {
              detectiveName: updatedDetective.businessName || user.name,
              email: user.email,
              packageName: packageToActivate.name,
              billingCycle: billingCycle,
              amount: String((paymentOrder as any).amount || ""),
              currency: (paymentOrder as any).currency || "USD",
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
              amount: String((paymentOrder as any).amount || ""),
              currency: (paymentOrder as any).currency || "USD",
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
      const order = await (rzpClient.orders.create({
        amount: amountPaise,
        currency: "INR",
        receipt: `bluetick_${Date.now()}`.substring(0, 40),
        notes: {
          type: "blue_tick_addon",
          billingCycle,
          detectiveId: detective.id,
          userId: req.session.userId ?? "",
        },
      }) as Promise<{ id: string }>);

      console.log(`[blue-tick-order] Razorpay order created: ${order.id}`);
      
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

  // ============== PAYMENT HISTORY & ADMIN ENDPOINTS ==============

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

  // ============== ADMIN SUBSCRIPTION PLAN CRUD ==============

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

  // ============== ADMIN PAYMENT GATEWAY MANAGEMENT ==============

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

  console.log('[Payment Routes] Successfully registered all payment routes');
}
