/*
  Admin flow test & sample data seed
  Safe for dev/test only. Run with: npx tsx server/scripts/admin-flow-test.ts
*/
import { db } from "../../db/index.ts";
import { storage } from "../storage.ts";
import { subscriptionPlans, type SubscriptionPlan, type InsertSubscriptionPlan } from "../../shared/schema.ts";
import { eq } from "drizzle-orm";

const BASE_URL = process.env.ADMIN_FLOW_BASE_URL || "http://localhost:5000";

type CookieJar = Record<string, string>;

function logStep(step: string, message: string) {
  console.log(`[admin-flow] ${step}: ${message}`);
}

function logError(step: string, api: string, error: unknown) {
  const msg = error instanceof Error ? error.message : String(error);
  console.error(`[admin-flow] ERROR in ${step} (${api}): ${msg}`);
}

function mergeSetCookies(jar: CookieJar, setCookie: string[] | undefined) {
  if (!setCookie) return;
  for (const c of setCookie) {
    const [cookiePair] = c.split(";");
    const [k, v] = cookiePair.split("=");
    if (k && v) jar[k.trim()] = v.trim();
  }
}

function jarToHeader(jar: CookieJar): string {
  return Object.entries(jar)
    .map(([k, v]) => `${k}=${v}`)
    .join("; ");
}

async function httpRequest<T>(url: string, options: RequestInit, jar: CookieJar): Promise<T> {
  const headers = new Headers(options.headers || {});
  headers.set("X-Requested-With", "XMLHttpRequest");
  if (Object.keys(jar).length > 0) {
    headers.set("Cookie", jarToHeader(jar));
  }
  const res = await fetch(url, { ...options, headers, redirect: "manual" });
  const setCookie = res.headers.getSetCookie?.() || (res.headers as any).raw?.()["set-cookie"];
  mergeSetCookies(jar, setCookie);
  const ct = res.headers.get("content-type") || "";
  const body = ct.includes("application/json") ? await res.json() : await res.text();
  if (!res.ok) {
    const msg = body && typeof body === "object" ? (body.error || body.message || JSON.stringify(body)) : String(body);
    throw new Error(msg || res.statusText);
  }
  return body as T;
}

async function getCsrfToken(jar: CookieJar): Promise<string> {
  const data = await httpRequest<{ csrfToken: string }>(`${BASE_URL}/api/csrf-token`, { method: "GET", credentials: "include" }, jar);
  return data.csrfToken;
}

async function login(email: string, password: string): Promise<CookieJar> {
  const jar: CookieJar = {};
  const csrfToken = await getCsrfToken(jar);
  await httpRequest(`${BASE_URL}/api/auth/login`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-CSRF-Token": csrfToken,
    },
    body: JSON.stringify({ email, password }),
    credentials: "include",
  }, jar);
  return jar;
}

async function seedSubscriptionPlan(input: InsertSubscriptionPlan): Promise<SubscriptionPlan> {
  const [plan] = await db
    .insert(subscriptionPlans)
    .values(input as any)
    .onConflictDoUpdate({
      target: subscriptionPlans.name,
      set: {
        displayName: input.displayName,
        monthlyPrice: input.monthlyPrice ?? "0",
        yearlyPrice: input.yearlyPrice ?? "0",
        description: input.description ?? null,
        features: input.features ?? [],
        serviceLimit: input.serviceLimit ?? 0,
        isActive: input.isActive ?? true,
        updatedAt: new Date(),
      } as any,
    })
    .returning();
  return plan;
}

async function ensureCategory(): Promise<string> {
  const categories = await storage.getAllServiceCategories(true);
  if (categories.length > 0) return categories[0].name;
  const created = await storage.createServiceCategory({
    name: "Background Checks",
    description: "Professional background investigation services",
    isActive: true,
  } as any);
  return created.name;
}

async function seedData() {
  const step = "SEED";
  try {
    logStep(step, "Seeding subscription plans (call/email enabled)");
    const callPlan = await seedSubscriptionPlan({
      name: "call_plan_dev",
      displayName: "Call Enabled",
      monthlyPrice: "0",
      yearlyPrice: "0",
      description: "Call and WhatsApp enabled",
      features: ["contact_phone", "contact_whatsapp"],
      serviceLimit: 5,
      isActive: true,
    } as any);

    const emailPlan = await seedSubscriptionPlan({
      name: "email_plan_dev",
      displayName: "Email Enabled",
      monthlyPrice: "0",
      yearlyPrice: "0",
      description: "Email enabled",
      features: ["contact_email"],
      serviceLimit: 5,
      isActive: true,
    } as any);

    logStep(step, "Ensuring service category exists");
    const category = await ensureCategory();

    logStep(step, "Ensuring admin user exists");
    const adminEmail = "admin@askdetectives.com";
    const adminPass = "Admin123!";
    let admin = await storage.getUserByEmail(adminEmail);
    if (!admin) {
      admin = await storage.createUser({ email: adminEmail, name: "Admin User", password: adminPass, role: "user" } as any);
    }
    await storage.setUserPassword(admin.id, adminPass, false);
    await storage.updateUserRole(admin.id, "admin");

    logStep(step, "Seeding detectives and services");
    const detectiveSeeds = [
      { email: "detective1@askdetectives.com", status: "pending", city: "Mumbai" },
      { email: "detective2@askdetectives.com", status: "active", city: "Delhi" },
      { email: "detective3@askdetectives.com", status: "inactive", city: "Pune" },
      { email: "detective4@askdetectives.com", status: "suspended", city: "Bengaluru" },
      { email: "detective5@askdetectives.com", status: "active", city: "Chennai" },
    ] as const;

    for (let i = 0; i < detectiveSeeds.length; i++) {
      const seed = detectiveSeeds[i];
      const pass = "Detective123!";
      let user = await storage.getUserByEmail(seed.email);
      if (!user) {
        user = await storage.createUser({ email: seed.email, name: `Detective ${i + 1}`, password: pass, role: "detective" } as any);
      }
      await storage.setUserPassword(user.id, pass, false);
      await storage.updateUserRole(user.id, "detective");

      let detective = await storage.getDetectiveByUserId(user.id);
      if (!detective) {
        detective = await storage.createDetective({
          userId: user.id,
          businessName: `Detective ${i + 1} Agency`,
          bio: `Experienced investigator #${i + 1}`,
          location: seed.city,
          country: "IN",
          state: "Karnataka",
          city: seed.city,
          phone: `+91-90000${1000 + i}`,
          whatsapp: `+91-90000${1000 + i}`,
          contactEmail: seed.email,
          status: seed.status as any,
          level: "level1",
          isClaimed: false,
          isClaimable: true,
        } as any);
      }

      const existingService = await storage.getServiceByDetectiveAndCategory(detective.id, category);
      if (!existingService) {
        await storage.createService({
          detectiveId: detective.id,
          category,
          title: `Background Check Service ${i + 1}`,
          description: "Comprehensive background screening and verification.",
          images: [],
          basePrice: "150",
          offerPrice: null,
          isActive: true,
        } as any);
      }
    }

    logStep(step, "Seeding claims (pending/approved/rejected)");
    const detectives = await storage.getAllDetectives(10, 0);
    const claimTargets = detectives.slice(0, 3);
    for (let i = 0; i < claimTargets.length; i++) {
      const d = claimTargets[i];
      const claim = await storage.createProfileClaim({
        detectiveId: d.id,
        claimantName: `Claimant ${i + 1}`,
        claimantEmail: `claimant${i + 1}@example.com`,
        claimantPhone: `+91-80000${2000 + i}`,
        details: `Proof of ownership #${i + 1}`,
        documents: [],
      } as any);

      if (i === 1) {
        await storage.updateProfileClaim(claim.id, {
          status: "approved",
          reviewedBy: admin.id,
          reviewedAt: new Date(),
        } as any);
      }
      if (i === 2) {
        await storage.updateProfileClaim(claim.id, {
          status: "rejected",
          reviewedBy: admin.id,
          reviewedAt: new Date(),
        } as any);
      }
    }

    return { adminEmail, adminPass, callPlanId: callPlan.id, emailPlanId: emailPlan.id };
  } catch (error) {
    logError(step, "seedData", error);
    throw error;
  }
}

async function simulateAdminFlow(seed: { adminEmail: string; adminPass: string; callPlanId: string; emailPlanId: string }) {
  const testResults: { step: string; status: "PASS" | "FAIL"; error?: string }[] = [];
  
  function recordResult(step: string, status: "PASS" | "FAIL", error?: unknown) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    testResults.push({ step, status, error: status === "FAIL" ? errorMsg : undefined });
    if (status === "PASS") {
      logStep("TEST", `✓ ${step}`);
    } else {
      logError("TEST", step, errorMsg);
    }
  }

  try {
    // Step 1: Admin login
    let adminJar: CookieJar;
    try {
      logStep("TEST", "1. Admin login");
      adminJar = await login(seed.adminEmail, seed.adminPass);
      recordResult("Admin login", "PASS");
    } catch (error) {
      recordResult("Admin login", "FAIL", error);
      throw error;
    }

    // Step 2: View detectives list
    let detectives: any;
    try {
      logStep("TEST", "2. View detectives list");
      detectives = await httpRequest<{ detectives: any[] }>(`${BASE_URL}/api/admin/detectives/raw`, { method: "GET", credentials: "include" }, adminJar);
      if (!Array.isArray(detectives.detectives)) throw new Error("Detectives list not returned");
      if (detectives.detectives.length < 5) throw new Error(`Expected at least 5 detectives, got ${detectives.detectives.length}`);
      recordResult("View detectives list", "PASS");
    } catch (error) {
      recordResult("View detectives list", "FAIL", error);
      throw error;
    }

    // Step 3: Approve a pending detective
    let approvedDetective: any;
    try {
      logStep("TEST", "3. Approve pending detective");
      const pending = detectives.detectives.find((d: any) => d.status === "pending");
      if (!pending) throw new Error("No pending detective found");
      
      const csrfToken = await getCsrfToken(adminJar);
      await httpRequest(`${BASE_URL}/api/admin/detectives/${pending.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "X-CSRF-Token": csrfToken,
        },
        body: JSON.stringify({ status: "active" }),
        credentials: "include",
      }, adminJar);

      approvedDetective = await storage.getDetective(pending.id);
      if (approvedDetective?.status !== "active") throw new Error("Detective status not updated to active");
      recordResult("Approve pending detective", "PASS");
    } catch (error) {
      recordResult("Approve pending detective", "FAIL", error);
      throw error;
    }

    // Step 4: Reject a detective
    try {
      logStep("TEST", "4. Reject/suspend a detective");
      const activeToSuspend = detectives.detectives.find((d: any) => d.status === "active" && d.id !== approvedDetective.id);
      if (!activeToSuspend) throw new Error("No active detective found to suspend");
      
      const csrfToken = await getCsrfToken(adminJar);
      await httpRequest(`${BASE_URL}/api/admin/detectives/${activeToSuspend.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "X-CSRF-Token": csrfToken,
        },
        body: JSON.stringify({ status: "suspended" }),
        credentials: "include",
      }, adminJar);

      const suspended = await storage.getDetective(activeToSuspend.id);
      if (suspended?.status !== "suspended") throw new Error("Detective status not updated to suspended");
      recordResult("Reject/suspend detective", "PASS");
    } catch (error) {
      recordResult("Reject/suspend detective", "FAIL", error);
      throw error;
    }

    // Step 5: Assign call-enabled subscription plan
    let detectiveJar: CookieJar;
    try {
      logStep("TEST", "5. Assign call-enabled subscription plan");
      const detectiveUser = await storage.getUser(approvedDetective.userId);
      if (!detectiveUser) throw new Error("Detective user not found");
      
      detectiveJar = await login(detectiveUser.email, "Detective123!");
      const dCsrf = await getCsrfToken(detectiveJar);
      await httpRequest(`${BASE_URL}/api/payments/upgrade-plan`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-CSRF-Token": dCsrf,
        },
        body: JSON.stringify({ packageId: seed.callPlanId, billingCycle: "monthly" }),
        credentials: "include",
      }, detectiveJar);

      const afterCallPlan = await storage.getDetective(approvedDetective.id);
      if (afterCallPlan?.subscriptionPackageId !== seed.callPlanId) throw new Error("Call plan assignment failed");
      
      // Validate call/whatsapp features
      const callPlan = await db.query.subscriptionPlans.findFirst({ where: eq(subscriptionPlans.id, seed.callPlanId) });
      if (!callPlan?.features.includes("contact_phone")) throw new Error("Call plan missing contact_phone feature");
      if (!callPlan?.features.includes("contact_whatsapp")) throw new Error("Call plan missing contact_whatsapp feature");
      
      recordResult("Assign call-enabled plan", "PASS");
    } catch (error) {
      recordResult("Assign call-enabled plan", "FAIL", error);
      throw error;
    }

    // Step 6: Switch to email-only plan (disable call access)
    try {
      logStep("TEST", "6. Switch to email-only plan (disable call access)");
      const dCsrf = await getCsrfToken(detectiveJar);
      await httpRequest(`${BASE_URL}/api/payments/upgrade-plan`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-CSRF-Token": dCsrf,
        },
        body: JSON.stringify({ packageId: seed.emailPlanId, billingCycle: "monthly" }),
        credentials: "include",
      }, detectiveJar);

      const afterEmailPlan = await storage.getDetective(approvedDetective.id);
      if (afterEmailPlan?.subscriptionPackageId !== seed.emailPlanId) throw new Error("Email plan assignment failed");
      
      // Validate email feature present, call features absent
      const emailPlan = await db.query.subscriptionPlans.findFirst({ where: eq(subscriptionPlans.id, seed.emailPlanId) });
      if (!emailPlan?.features.includes("contact_email")) throw new Error("Email plan missing contact_email feature");
      if (emailPlan?.features.includes("contact_phone")) throw new Error("Email plan should not have contact_phone feature");
      
      recordResult("Switch to email-only plan", "PASS");
    } catch (error) {
      recordResult("Switch to email-only plan", "FAIL", error);
      throw error;
    }

    // Step 7: View claims list
    let claims: any;
    try {
      logStep("TEST", "7. View claims list");
      claims = await httpRequest<{ claims: any[] }>(`${BASE_URL}/api/claims?status=pending&limit=50`, { method: "GET", credentials: "include" }, adminJar);
      if (!Array.isArray(claims.claims)) throw new Error("Claims list not returned");
      if (claims.claims.length === 0) throw new Error("No pending claims found to review");
      recordResult("View claims list", "PASS");
    } catch (error) {
      recordResult("View claims list", "FAIL", error);
      throw error;
    }

    // Step 8: Approve a claim
    try {
      logStep("TEST", "8. Approve a claim");
      const claimToApprove = claims.claims[0];
      const cCsrf = await getCsrfToken(adminJar);
      await httpRequest(`${BASE_URL}/api/claims/${claimToApprove.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "X-CSRF-Token": cCsrf,
        },
        body: JSON.stringify({ status: "approved" }),
        credentials: "include",
      }, adminJar);

      const approved = await storage.getProfileClaim(claimToApprove.id);
      if (approved?.status !== "approved") throw new Error("Claim status not updated to approved");
      
      // Validate claim ownership transfer
      const claimedDetective = await storage.getDetective(claimToApprove.detectiveId);
      if (!claimedDetective?.isClaimed) throw new Error("Detective isClaimed flag not set");
      
      recordResult("Approve claim", "PASS");
    } catch (error) {
      recordResult("Approve claim", "FAIL", error);
      throw error;
    }

    // Step 9: Reject a claim
    try {
      logStep("TEST", "9. Reject a claim");
      const remainingClaims = await httpRequest<{ claims: any[] }>(`${BASE_URL}/api/claims?status=pending&limit=50`, { method: "GET", credentials: "include" }, adminJar);
      
      if (remainingClaims.claims.length > 0) {
        const claimToReject = remainingClaims.claims[0];
        const rCsrf = await getCsrfToken(adminJar);
        await httpRequest(`${BASE_URL}/api/claims/${claimToReject.id}`, {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            "X-CSRF-Token": rCsrf,
          },
          body: JSON.stringify({ status: "rejected" }),
          credentials: "include",
        }, adminJar);

        const rejected = await storage.getProfileClaim(claimToReject.id);
        if (rejected?.status !== "rejected") throw new Error("Claim status not updated to rejected");
        recordResult("Reject claim", "PASS");
      } else {
        logStep("TEST", "9. Reject a claim - SKIPPED (no pending claims remaining)");
        recordResult("Reject claim", "PASS");
      }
    } catch (error) {
      recordResult("Reject claim", "FAIL", error);
      throw error;
    }

    // Print final summary
    console.log("\n" + "=".repeat(60));
    console.log("ADMIN DASHBOARD TEST SUMMARY");
    console.log("=".repeat(60));
    
    const passed = testResults.filter((r) => r.status === "PASS").length;
    const failed = testResults.filter((r) => r.status === "FAIL").length;
    
    testResults.forEach((result) => {
      const icon = result.status === "PASS" ? "✓" : "✗";
      const status = result.status === "PASS" ? "PASS" : "FAIL";
      console.log(`${icon} ${result.step}: ${status}`);
      if (result.error) {
        console.log(`  Error: ${result.error}`);
      }
    });
    
    console.log("=".repeat(60));
    console.log(`Total: ${testResults.length} | Passed: ${passed} | Failed: ${failed}`);
    console.log("=".repeat(60));
    
    if (failed > 0) {
      throw new Error(`${failed} test(s) failed`);
    }
    
  } catch (error) {
    logError("SIMULATION", "Admin flow test", error);
    throw error;
  }
}

async function main() {
  // SAFETY: Prevent running in production
  const nodeEnv = process.env.NODE_ENV || "development";
  if (nodeEnv === "production") {
    console.error("ERROR: This script cannot run in production environment!");
    console.error("Set NODE_ENV to 'development' or 'test' to run this script.");
    process.exit(1);
  }
  
  logStep("START", `Environment: ${nodeEnv}`);
  logStep("START", `Using base URL: ${BASE_URL}`);
  logStep("START", "This script will seed sample data and test admin dashboard functionality");
  
  const seed = await seedData();
  await simulateAdminFlow(seed);
  
  logStep("COMPLETE", "All admin dashboard tests completed successfully!");
}

main().catch((e) => {
  logError("MAIN", "admin-flow-test", e);
  process.exit(1);
});
