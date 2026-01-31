/**
 * SUBSCRIPTION EXPIRY HANDLER
 * 
 * Handles automatic downgrade to FREE plan when paid subscriptions expire
 * Ensures platform rule: Every detective MUST always have a subscription
 */

import { db } from "../../db/index.ts";
import { detectives } from "../../shared/schema.ts";
import { sql } from "drizzle-orm";
import { getFreePlanId } from "./freePlan.ts";
import { applyPackageEntitlements } from "./entitlements.ts";

/**
 * Check and downgrade expired subscriptions to FREE plan
 * Should be run daily via cron job or scheduled task
 */
export async function handleExpiredSubscriptions(): Promise<{
  checked: number;
  downgraded: number;
  errors: string[];
}> {
  console.log('[SUBSCRIPTION_EXPIRY] Starting expiry check...');
  
  const errors: string[] = [];
  const freePlanId = await getFreePlanId();
  
  try {
    // Find all detectives with expired subscriptions
    // Criteria: subscription_expires_at < NOW() AND not on FREE plan
    const expiredDetectives = await db.select({
      id: detectives.id,
      businessName: detectives.businessName,
      subscriptionPackageId: detectives.subscriptionPackageId,
      subscriptionExpiresAt: detectives.subscriptionExpiresAt,
    })
    .from(detectives)
    .where(
      sql`${detectives.subscriptionExpiresAt} < NOW() 
          AND ${detectives.subscriptionPackageId} != ${freePlanId}
          AND ${detectives.subscriptionExpiresAt} IS NOT NULL`
    );
    
    console.log(`[SUBSCRIPTION_EXPIRY] Found ${expiredDetectives.length} expired subscription(s)`);
    
    let downgraded = 0;
    
    for (const detective of expiredDetectives) {
      try {
        // Downgrade to FREE plan
        await db.update(detectives)
          .set({
            subscriptionPackageId: freePlanId,
            billingCycle: null,
            subscriptionActivatedAt: new Date(),
            subscriptionExpiresAt: null, // FREE plan never expires
            pendingPackageId: null,
            pendingBillingCycle: null,
            updatedAt: new Date(),
          })
          .where(sql`${detectives.id} = ${detective.id}`);

        // Clear subscription-granted badges (hasBlueTick); does NOT touch blueTickAddon
        await applyPackageEntitlements(detective.id, "expiry");
        
        console.log(`[SUBSCRIPTION_EXPIRY] ✅ Downgraded: ${detective.businessName} (${detective.id}) to FREE plan`);
        downgraded++;
        
      } catch (err: any) {
        const error = `Failed to downgrade ${detective.id}: ${err.message}`;
        console.error(`[SUBSCRIPTION_EXPIRY] ❌ ${error}`);
        errors.push(error);
      }
    }
    
    console.log(`[SUBSCRIPTION_EXPIRY] Completed: ${downgraded}/${expiredDetectives.length} downgraded`);
    
    return {
      checked: expiredDetectives.length,
      downgraded,
      errors,
    };
    
  } catch (err: any) {
    console.error('[SUBSCRIPTION_EXPIRY] Fatal error:', err);
    throw new Error(`Subscription expiry check failed: ${err.message}`);
  }
}

/**
 * Manual trigger for single detective expiry check
 */
export async function checkDetectiveExpiry(detectiveId: string): Promise<boolean> {
  const freePlanId = await getFreePlanId();
  
  const [detective] = await db.select({
    subscriptionPackageId: detectives.subscriptionPackageId,
    subscriptionExpiresAt: detectives.subscriptionExpiresAt,
  })
  .from(detectives)
  .where(sql`${detectives.id} = ${detectiveId}`)
  .limit(1);
  
  if (!detective) {
    throw new Error(`Detective ${detectiveId} not found`);
  }
  
  // Check if expired and not on FREE plan
  if (
    detective.subscriptionExpiresAt && 
    detective.subscriptionExpiresAt < new Date() &&
    detective.subscriptionPackageId !== freePlanId
  ) {
    // Downgrade to FREE
    await db.update(detectives)
      .set({
        subscriptionPackageId: freePlanId,
        billingCycle: null,
        subscriptionActivatedAt: new Date(),
        subscriptionExpiresAt: null,
        pendingPackageId: null,
        pendingBillingCycle: null,
        updatedAt: new Date(),
      })
      .where(sql`${detectives.id} = ${detectiveId}`);

    // Clear subscription-granted badges (hasBlueTick); does NOT touch blueTickAddon
    await applyPackageEntitlements(detectiveId, "expiry");
    
    console.log(`[SUBSCRIPTION_EXPIRY] Detective ${detectiveId} downgraded to FREE plan`);
    return true;
  }
  
  return false;
}
