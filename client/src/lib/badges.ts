/**
 * Badge display consistency: order and labels used across service cards,
 * detective profile, search, snippets, and favorites.
 * Only show badges that effectiveBadges / isVerified allow.
 */

export const BADGE_ORDER = ["verified", "blueTick", "pro", "recommended"] as const;
export type BadgeKey = (typeof BADGE_ORDER)[number];

export const BADGE_LABELS: Record<BadgeKey, string> = {
  verified: "Verified",
  blueTick: "Blue Tick",
  pro: "Pro",
  recommended: "Recommended",
};

export interface EffectiveBadgesLike {
  blueTick?: boolean;
  pro?: boolean;
  recommended?: boolean;
}

/**
 * Build badge keys array in standard order: Verified → Blue Tick → Pro → Recommended.
 * Only includes badges the detective is entitled to (effectiveBadges + isVerified).
 */
export function buildBadgesFromEffective(
  effectiveBadges: EffectiveBadgesLike | undefined | null,
  isVerified: boolean
): string[] {
  const out: string[] = [];
  if (isVerified) out.push("verified");
  if (effectiveBadges?.blueTick) out.push("blueTick");
  if (effectiveBadges?.pro) out.push("pro");
  if (effectiveBadges?.recommended) out.push("recommended");
  return out;
}
