// Free Plan Service - Ensures every detective has a subscription
import { db } from "../../db/index.ts";
import { subscriptionPlans } from "../../shared/schema.ts";
import { eq, and } from "drizzle-orm";

let cachedFreePlanId: string | null = null;

/**
 * Get FREE plan ID (cached for performance)
 * FREE plan = price 0, active, acts as default fallback
 */
export async function getFreePlanId(): Promise<string> {
  if (cachedFreePlanId) {
    return cachedFreePlanId;
  }

  const [freePlan] = await db
    .select()
    .from(subscriptionPlans)
    .where(
      and(
        eq(subscriptionPlans.monthlyPrice, "0"),
        eq(subscriptionPlans.isActive, true)
      )
    )
    .limit(1);

  if (!freePlan) {
    throw new Error(
      "[CRITICAL] FREE plan not found in database. Platform cannot operate without a free plan."
    );
  }

  cachedFreePlanId = freePlan.id;
  console.log(`[FREE_PLAN] Cached free plan ID: ${cachedFreePlanId} (${freePlan.name})`);
  
  return cachedFreePlanId;
}

/**
 * Clear cache (useful after plan updates)
 */
export function clearFreePlanCache(): void {
  cachedFreePlanId = null;
}

/**
 * Ensure detective has a subscription plan
 * If NULL, automatically assign FREE plan
 */
export async function ensureDetectiveHasPlan(detectiveId: string, currentPackageId: string | null): Promise<string> {
  if (currentPackageId) {
    return currentPackageId; // Already has a plan
  }

  const freePlanId = await getFreePlanId();
  console.log(`[SUBSCRIPTION_SAFETY] Detective ${detectiveId} has NULL subscription, assigning FREE plan: ${freePlanId}`);
  
  return freePlanId;
}
