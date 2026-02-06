/**
 * ENTITLEMENT SYSTEM
 * Applies subscription package badges to detective (subscription-granted Blue Tick only).
 * Does NOT touch blueTickAddon — add-on is independent and survives expiry/downgrade.
 */

import { storage } from "../storage.ts";

export interface EffectiveBadges {
  blueTick: boolean;
  pro: boolean;
  recommended: boolean;
}

/**
 * Compute badge entitlement from detective and optional subscription package.
 * Respects: active subscription only (not expired), blueTickAddon OR package.badges.blueTick.
 */
export function computeEffectiveBadges(
  detective: {
    subscriptionPackageId?: string | null;
    subscriptionExpiresAt?: Date | string | null;
    hasBlueTick?: boolean;
    blueTickAddon?: boolean;
  },
  subscriptionPackage?: { badges?: unknown; name?: string | null } | null
): EffectiveBadges {
  const now = new Date();
  const expiresAt = detective.subscriptionExpiresAt ? new Date(detective.subscriptionExpiresAt) : null;
  const isFreePlan = subscriptionPackage?.name === "free";
  const activeSubscription = !!(
    detective.subscriptionPackageId &&
    (isFreePlan || !expiresAt || expiresAt > now)
  );

  let packageBadges: Record<string, boolean> = {};
  if (activeSubscription && subscriptionPackage?.badges) {
    const b = subscriptionPackage.badges;
    if (typeof b === "object" && b !== null && !Array.isArray(b)) {
      packageBadges = b as Record<string, boolean>;
    } else if (Array.isArray(b)) {
      (b as string[]).forEach((k: string) => { packageBadges[k] = true; });
    }
  }

  // Blue tick is ONLY shown if:
  // 1. User has separate blue tick addon (blueTickAddon = true), OR
  // 2. User has active subscription AND package includes blue tick
  // IMPORTANT: Do NOT use hasBlueTick field as it persists after downgrade
  const blueTickFromPackage = packageBadges.blueTick === true;
  const blueTickAddon = (detective as any).blueTickAddon === true;
  const effectiveBlueTick = blueTickAddon || (activeSubscription && blueTickFromPackage);

  return {
    blueTick: effectiveBlueTick,
    pro: activeSubscription && (packageBadges.pro === true),
    recommended: activeSubscription && (packageBadges.recommended === true),
  };
}

/**
 * Apply package entitlements to a detective.
 * Only syncs hasBlueTick from package.badges.blueTick. Never modifies blueTickAddon.
 * Call after: payment activation, renewal; and after expiry/downgrade (to clear subscription Blue Tick).
 */
export async function applyPackageEntitlements(
  detectiveId: string,
  reason: "activation" | "renewal" | "downgrade" | "expiry"
): Promise<void> {
  const detective = await storage.getDetective(detectiveId);

  if (!detective) {
    console.warn(`[ENTITLEMENT] Detective not found: ${detectiveId}`);
    return;
  }

  let activePackageId = detective.subscriptionPackageId;

  const now = new Date();
  if (detective.subscriptionExpiresAt && new Date(detective.subscriptionExpiresAt) < now) {
    activePackageId = null;
    console.log(`[ENTITLEMENT] Subscription expired for detective ${detectiveId}, downgrading to FREE`);
  }

  let packageBadges: Record<string, boolean> = {};

  if (activePackageId) {
    const activePackage = await storage.getSubscriptionPlanById(activePackageId);
    if (activePackage && activePackage.badges) {
      packageBadges = (activePackage.badges as Record<string, boolean>) || {};
    }
  }

  const updatePayload: Record<string, unknown> = {};

  const shouldHaveBlueTick = packageBadges.blueTick === true;

  if (shouldHaveBlueTick && !detective.hasBlueTick) {
    console.log(`[ENTITLEMENT_APPLY] Granting Blue Tick (subscription) to detective ${detectiveId}`, {
      packageId: activePackageId,
      reason,
    });
    updatePayload.hasBlueTick = true;
    updatePayload.blueTickActivatedAt = new Date();
  } else if (!shouldHaveBlueTick && detective.hasBlueTick) {
    console.log(`[ENTITLEMENT_REMOVE] Removing Blue Tick (subscription) from detective ${detectiveId}`, {
      packageId: activePackageId,
      reason,
    });
    updatePayload.hasBlueTick = false;
    updatePayload.blueTickActivatedAt = null;
  }

  if (Object.keys(updatePayload).length > 0) {
    await storage.updateDetectiveAdmin(detectiveId, updatePayload as any);
    console.log(`[ENTITLEMENT] Entitlements updated for detective ${detectiveId}`, {
      changes: updatePayload,
      reason,
      packageId: activePackageId,
    });
  }
}
