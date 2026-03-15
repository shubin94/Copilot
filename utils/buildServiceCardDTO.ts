import type { ServiceCardDTO } from "../interfaces/ServiceCardDTO.js";

type BuildServiceCardDTOParams = {
  service: any;
  detective?: any;
  avgRating?: number | null;
  reviewCount?: number;
  maskContacts?: boolean;
};

export function buildServiceCardDTO({
  service,
  detective,
  avgRating = null,
  reviewCount = 0,
}: BuildServiceCardDTOParams): ServiceCardDTO {
  const priceDisplay = service?.isOnEnquiry
    ? "On Enquiry"
    : String(service?.offerPrice ?? service?.basePrice ?? "");

  // Contact masking is already handled by maskDetectiveContactsPublic
  // Just pass through whatever contacts the detective has
  const phone = detective?.phone ?? null;
  const whatsapp = detective?.whatsapp ?? null;
  const contactEmail = detective?.contactEmail ?? detective?.email ?? null;

  const detectiveName =
    detective?.businessName ??
    detective?.name ??
    service?.detective?.businessName ??
    "Unknown Detective";

  const detectiveAvatar = detective?.logo ?? null;

  const detectiveCountry =
    detective?.country ?? service?.detective?.country ?? null;

  // Use effectiveBadges if present, else fallback to subscriptionPackage.badges
  const badges = detective?.effectiveBadges ?? detective?.subscriptionPackage?.badges ?? null;

  const badgeState = badges
    ? {
        showBlueTick: !!badges.blueTick,
        showPro: !!badges.pro,
        showRecommended: !!badges.recommended,
        blueTickLabel: badges.blueTick ? "Verified" : null,
      }
    : null;
  const isUnclaimed = !!detective?.isUnclaimed;

  return {
    id: String(service?.id ?? ""),
    slug: service?.slug ?? null,
    title: String(service?.title ?? ""),
    images: Array.isArray(service?.images) ? service.images : [],
    priceDisplay,
    avgRating,
    reviewCount,
    detectiveName,
    detectiveAvatar,
    detectiveCountry,
    detectiveState: detective?.state ?? null,
    detectiveCity: detective?.city ?? null,
    detectiveCountrySlug: detective?.countrySlug ?? null,
    detectiveStateSlug: detective?.stateSlug ?? null,
    detectiveCitySlug: detective?.citySlug ?? null,
    detectiveSlug: detective?.slug ?? null,
    detectiveBusinessName: detective?.businessName ?? null,
    badgeState,
    phone,
    whatsapp,
    contactEmail,
    isUnclaimed,
    detectiveLevel: detective?.level ?? null,
  };
}
