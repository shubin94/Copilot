import { getCountryName } from "@/lib/slug-utils";
import { computeServiceBadges } from "@/lib/service-badges";
import { getDetectiveProfileUrl } from "@/lib/utils";

type DetectiveLike = Record<string, any> | null | undefined;

export function resolveAverageServiceRating(services: Array<Record<string, any>> | null | undefined): number | null {
  if (!Array.isArray(services) || services.length === 0) return null;
  const ratedValues = services
    .map((service) => Number(service?.avgRating))
    .filter((value) => Number.isFinite(value) && value > 0);

  if (ratedValues.length === 0) return null;
  const average = ratedValues.reduce((sum, value) => sum + value, 0) / ratedValues.length;
  return Number(average.toFixed(1));
}

export function slugifySegment(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function resolveDetectiveName(detective: DetectiveLike): string {
  if (!detective) return "Detective";
  return (
    detective.businessName ||
    detective.business_name ||
    detective.name ||
    detective.title ||
    `${detective.firstName || ""} ${detective.lastName || ""}`.trim() ||
    "Detective"
  );
}

export function resolveMemberSinceLabel(
  detective: DetectiveLike,
  formatter: Intl.DateTimeFormat
): string | null {
  if (!detective) return null;
  const rawValue =
    detective.createdAt ||
    detective.created_at ||
    detective.memberSince ||
    detective.member_since ||
    null;
  if (!rawValue) return null;
  const parsed = new Date(rawValue);
  if (Number.isNaN(parsed.getTime())) return null;
  return formatter.format(parsed);
}

export function buildDetectiveSeoContext(
  detective: DetectiveLike,
  detectiveName: string,
  locationPath: string
): {
  countryNameForDisplay: string;
  location: string;
  countrySlug: string;
  stateSlug: string;
  citySlug: string;
  canonicalUrl: string;
  breadcrumbs: Array<{ name: string; url: string }>;
} {
  const countryNameForDisplay = detective?.country
    ? getCountryName(String(detective.country))
    : (detective?.country || "");
  const location = detective?.city && countryNameForDisplay
    ? `${detective.city}, ${countryNameForDisplay}`
    : detective?.location || countryNameForDisplay || "";

  const countryName = detective?.country ? getCountryName(String(detective.country)) : "";
  const countrySlug = countryName ? slugifySegment(countryName) : "";
  const stateSlug = detective?.state ? slugifySegment(String(detective.state)) : "";
  const citySlug = detective?.city ? slugifySegment(String(detective.city)) : "";
  const canonicalUrl = detective
    ? `https://www.askdetectives.com${getDetectiveProfileUrl(detective as any)}`
    : `https://www.askdetectives.com${locationPath}`;

  const breadcrumbs: Array<{ name: string; url: string }> = [{ name: "Home", url: "/" }];

  if (countryName && countrySlug) {
    breadcrumbs.push({ name: countryName, url: `/detectives/${countrySlug}/` });
  }

  if (detective?.state && stateSlug && countrySlug) {
    breadcrumbs.push({ name: String(detective.state), url: `/detectives/${countrySlug}/${stateSlug}/` });
  }

  if (detective?.city && citySlug && stateSlug && countrySlug) {
    breadcrumbs.push({ name: String(detective.city), url: `/detectives/${countrySlug}/${stateSlug}/${citySlug}/` });
  }

  breadcrumbs.push({ name: detectiveName, url: canonicalUrl });

  return {
    countryNameForDisplay,
    location,
    countrySlug,
    stateSlug,
    citySlug,
    canonicalUrl,
    breadcrumbs,
  };
}

export function resolveDetectiveBadgeState(detective: DetectiveLike) {
  if (!detective) return undefined;

  const apiBadges = detective.effectiveBadges;
  const fromApi = apiBadges && typeof apiBadges === "object" ? apiBadges : {};

  // SINGLE SOURCE OF TRUTH: only use effectiveBadges computed by the backend.
  // Never fall back to raw DB fields (hasBlueTick, level, blueTickAddon) —
  // those don't respect subscription expiry and cause stale badge display.
  const effectiveBadges = {
    blueTick: Boolean(fromApi.blueTick ?? fromApi.blue_tick ?? false),
    pro: Boolean(fromApi.pro ?? false),
    recommended: Boolean(fromApi.recommended ?? fromApi.isRecommended ?? false),
  };

  return computeServiceBadges({
    isVerified: Boolean(detective.isVerified ?? detective.is_verified ?? false),
    effectiveBadges,
  });
}
