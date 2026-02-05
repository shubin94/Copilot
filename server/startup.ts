import { db } from "../db/index.ts";
import { appPolicies, siteSettings } from "../shared/schema.ts";
import { inArray, sql } from "drizzle-orm";
import { config } from "./config.ts";

export async function validateDatabase(): Promise<void> {
  const requiredPolicies = [
    "pagination_default_limit",
    "pagination_default_offset",
    "visibility_requirements",
    "post_approval_status",
    "pricing_constraints",
  ];

  const policyRows = await db.select().from(appPolicies).where(inArray(appPolicies.key, requiredPolicies));
  const present = new Set(policyRows.map((r: any) => r.key));
  const missingPolicies = requiredPolicies.filter(k => !present.has(k));

  const [{ count: settingsCount }] = await db.select({ count: sql<number>`count(*)` }).from(siteSettings);
  const hasSiteSettings = Number(settingsCount) > 0;

  if (config.env.isProd) {
    if (missingPolicies.length > 0) {
      throw new Error(`Missing required policies: ${missingPolicies.join(", ")}`);
    }
    if (!hasSiteSettings) {
      throw new Error("Missing required site settings row");
    }
  } else {
    if (missingPolicies.length > 0) {
      console.warn(`[startup] Missing policies (dev/test): ${missingPolicies.join(", ")}`);
    }
    if (!hasSiteSettings) {
      console.warn("[startup] Missing site settings row (dev/test)");
    }
  }
}
