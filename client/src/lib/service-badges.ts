/**
 * Shared service badge computation used across list cards and detail pages.
 */

export interface ServiceBadgeInput {
  isVerified?: boolean;
  effectiveBadges?: {
    blueTick?: boolean;
    pro?: boolean;
    recommended?: boolean;
  } | null;
}

export interface ServiceBadgeState {
  showBlueTick: boolean;
  blueTickLabel: string;
  showPro: boolean;
  showRecommended: boolean;
}

export function computeServiceBadges(input: ServiceBadgeInput | null | undefined): ServiceBadgeState {
  const showBlueTick = !!(input?.isVerified || input?.effectiveBadges?.blueTick);
  return {
    showBlueTick,
    blueTickLabel: "Verified",
    showPro: !!input?.effectiveBadges?.pro,
    showRecommended: !!input?.effectiveBadges?.recommended,
  };
}
