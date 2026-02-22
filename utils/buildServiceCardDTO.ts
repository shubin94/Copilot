import type { ServiceCardDTO } from "../interfaces/ServiceCardDTO";

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

  const features = detective?.subscriptionPackage?.features || [];
  const canShowPhone = features.includes("contact_phone");
  const canShowEmail = features.includes("contact_email");

  const phone = canShowPhone ? detective?.phone ?? null : null;
  const whatsapp = canShowPhone ? detective?.whatsapp ?? null : null;
  const contactEmail = canShowEmail ? detective?.contactEmail ?? null : null;

  const detectiveName =
    detective?.businessName ??
    detective?.name ??
    service?.detective?.businessName ??
    "Unknown Detective";

  const detectiveAvatar = detective?.logo ?? null;

  const detectiveCountry =
    detective?.country ?? service?.detective?.country ?? null;

  const planBadges = detective?.subscriptionPackage?.badges || null;

  const badgeState = planBadges
    ? {
        showBlueTick: !!planBadges.blueTick,
        showPro: !!planBadges.pro,
        showRecommended: !!planBadges.recommended,
        blueTickLabel: planBadges.blueTick ? "Verified" : null,
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
    detectiveSlug: detective?.slug ?? null,
    detectiveBusinessName: detective?.businessName ?? null,
    badgeState,
    phone,
    whatsapp,
    contactEmail,
    isUnclaimed,
  };
}
