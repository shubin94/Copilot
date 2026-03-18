import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MapPin, Clock, Zap } from "lucide-react";
import { ArrowRight } from "lucide-react";
import { getDetectiveProfileUrl } from "@/lib/utils";
import { computeServiceBadges } from "@/lib/service-badges";
import { DetectiveBadges } from "@/components/detectives/DetectiveBadges";

function formatLastActive(lastActive: string | Date | null | undefined): string | null {
  if (!lastActive) return null;
  const date = new Date(lastActive);
  if (isNaN(date.getTime())) return null;
  const diffMs = Date.now() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (diffDays < 0) return null;
  if (diffDays === 0) return "Active today";
  if (diffDays === 1) return "Active yesterday";
  if (diffDays < 7) return `Active ${diffDays} days ago`;
  if (diffDays < 30) return `Active ${Math.floor(diffDays / 7)} week${Math.floor(diffDays / 7) > 1 ? "s" : ""} ago`;
  return null; // too old to show
}

function formatResponseTime(avgResponseTime: number | null | undefined): string | null {
  if (!avgResponseTime || avgResponseTime <= 0) return null;
  if (avgResponseTime < 1) return "Responds within 1 hour";
  if (avgResponseTime < 24) return `Responds within ${Math.round(avgResponseTime)} hour${Math.round(avgResponseTime) > 1 ? "s" : ""}`;
  const days = Math.round(avgResponseTime / 24);
  return `Responds within ${days} day${days > 1 ? "s" : ""}`;
}

interface Detective {
  id: string;
  businessName?: string | null;
  slug?: string | null;
  logo?: string | null;
  city?: string | null;
  state?: string | null;
  country?: string | null;
  isVerified?: boolean;
  effectiveBadges?: { blueTick?: boolean; pro?: boolean; recommended?: boolean };
  level?: string;
  phone?: string | null;
  whatsapp?: string | null;
  contactEmail?: string | null;
  email?: string | null;
  bio?: string | null;
  avgRating?: number;
  reviewCount?: number;
  lastActive?: string | Date | null;
  avgResponseTime?: number | null;
  badgeState?: {
    showBlueTick?: boolean;
    showPro?: boolean;
    showRecommended?: boolean;
    blueTickLabel?: string | null;
  };
  subscriptionPackage?: {
    badges?: {
      blueTick?: boolean;
      pro?: boolean;
      recommended?: boolean;
    };
  };
  // Allow additional properties from database/API responses
  [key: string]: any;
}

interface DetectiveCardProps {
  detective: Detective;
  variant?: "city" | "homeFeatured" | "newsFeatured";
  isPriority?: boolean;
}

export function DetectiveCard({ detective, variant = "city", isPriority = false }: DetectiveCardProps) {
  const detectiveUrl = getDetectiveProfileUrl(detective);

  const initials = detective.businessName
    ? detective.businessName
        .split(" ")
        .map(word => word[0])
        .join("")
        .toUpperCase()
        .slice(0, 2)
    : "PI";

  const contactEmail = detective.contactEmail || detective.email || null;
  const hasPhoneContact = Boolean(detective.phone || detective.whatsapp);
  const hasEmailContact = Boolean(contactEmail);
  const contactButtonText = hasPhoneContact
    ? "Call Now"
    : hasEmailContact
    ? "Email Now"
    : null;
  const contactHref = hasPhoneContact
    ? `tel:${detective.phone || detective.whatsapp}`
    : hasEmailContact
    ? `mailto:${contactEmail}`
    : null;
  const normalizedAvgRating = Number(detective.avgRating ?? 0);
  const normalizedReviewCount = Number(detective.reviewCount ?? 0);
  const showReviews =
    Number.isFinite(normalizedAvgRating) &&
    Number.isFinite(normalizedReviewCount) &&
    normalizedAvgRating > 0 &&
    normalizedReviewCount > 0;

  // Single source of truth for badge state across all variants.
  // Priority: pre-computed badgeState → effectiveBadges (from API) → subscriptionPackage.badges → hasBlueTick/level fields
  const preComputed = detective.badgeState
    ? { ...detective.badgeState, blueTickLabel: detective.badgeState.blueTickLabel ?? undefined }
    : undefined;
  // SINGLE SOURCE OF TRUTH: only use effectiveBadges from the backend API.
  // Never compute from raw fields — those don't respect subscription expiry.
  const badgeState = preComputed ?? computeServiceBadges({
    isVerified: detective.isVerified || false,
    effectiveBadges: detective.effectiveBadges ?? { blueTick: false, pro: false, recommended: false },
  });

  if (variant === "homeFeatured") {

    return (
      <Card
        className="hover:shadow-lg transition-shadow cursor-pointer"
        onClick={() => window.location.href = getDetectiveProfileUrl(detective)}
      >
        <CardContent className="p-6">
          <div className="flex gap-3 items-start">
            <div className="h-14 w-14 rounded-full overflow-hidden bg-gray-100 flex-shrink-0 flex items-center justify-center">
              {detective.logo ? (
                <img src={detective.logo} alt="Detective logo" width={56} height={56} loading="lazy" decoding="async" className="h-14 w-14 object-cover" />
              ) : (
                <div className="h-10 w-10 rounded-full bg-gray-200" />
              )}
            </div>
            <div className="flex-1">
              <span className="font-medium leading-snug">
                {detective.businessName || "Unknown Detective"}
                <DetectiveBadges badgeState={badgeState} />
              </span>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (variant === "newsFeatured") {
    return (
      <>
        <div className="flex gap-4 mb-4">
          <img
            src={detective.logo || "/placeholder-avatar.png"}
            alt="Detective logo"
            width={64}
            height={64}
            loading="lazy"
            decoding="async"
            className="h-16 w-16 rounded-full object-cover border border-gray-200"
          />
          <div className="flex-1">
            <span className="font-bold text-sm leading-snug">
              {detective.businessName || "Detective"}
              <DetectiveBadges badgeState={badgeState} />
            </span>
          </div>
        </div>

        {detective.city && (
          <div className="flex items-center gap-2 text-sm text-gray-600 mb-4">
            <MapPin className="h-4 w-4" />
            <span>
              {detective.city}, {detective.state}
            </span>
          </div>
        )}

        <Button
          asChild
          className="w-full bg-blue-600 hover:bg-blue-700 text-white"
        >
          <a
            href={getDetectiveProfileUrl(detective)}
            className="flex items-center justify-center gap-2"
          >
            View Services
            <ArrowRight className="h-4 w-4" />
          </a>
        </Button>
      </>
    );
  }

  return (
    <Card
      className="h-full flex flex-col rounded-xl border border-gray-200 bg-white hover:shadow-xl shadow-md transition-all duration-300 overflow-hidden"
    >
      <CardContent className="p-5 flex flex-col gap-4 h-full">
        <div className="w-20 h-20 rounded-full overflow-hidden bg-gray-100 border border-gray-200 flex items-center justify-center flex-shrink-0">
          {detective.logo ? (
            <img
              src={detective.logo}
              alt="Detective logo"
              width={80}
              height={80}
              loading={isPriority ? "eager" : "lazy"}
              decoding="async"
              {...(isPriority ? ({ fetchpriority: "high" } as React.ImgHTMLAttributes<HTMLImageElement>) : {})}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-green-100 to-green-200 flex items-center justify-center text-sm font-bold text-green-700">
              {initials}
            </div>
          )}
        </div>

        <div>
          <span className="text-lg font-semibold text-gray-900 leading-snug">
            {detective.businessName || "Private Detective Service"}
            <DetectiveBadges badgeState={badgeState} />
          </span>
        </div>

        <span className="text-xs font-bold text-green-600 bg-green-50 px-2 py-1 rounded inline-block w-fit">
          {detective.level || "1"}
        </span>

        {(detective.city || detective.state) && (
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <MapPin className="h-4 w-4 flex-shrink-0" />
            <span className="line-clamp-1">
              {[
                detective.city,
                detective.state,
                detective.country
              ].filter(Boolean).join(", ")}
            </span>
          </div>
        )}

        {detective.bio && (
          <p className="text-sm text-gray-600 line-clamp-2">
            {detective.bio}
          </p>
        )}

        {showReviews && (
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1">
              {[...Array(5)].map((_, i) => (
                <span key={i} className={i < Math.round(normalizedAvgRating) ? "text-yellow-400" : "text-gray-300"}>
                  ★
                </span>
              ))}
            </div>
            <span className="text-xs text-gray-500">
              ({normalizedReviewCount} reviews)
            </span>
          </div>
        )}

        {(formatLastActive(detective.lastActive) || formatResponseTime(detective.avgResponseTime)) && (
          <div className="flex flex-col gap-1">
            {formatLastActive(detective.lastActive) && (
              <div className="flex items-center gap-1.5 text-xs text-gray-500">
                <Clock className="h-3.5 w-3.5 flex-shrink-0" />
                <span>{formatLastActive(detective.lastActive)}</span>
              </div>
            )}
            {formatResponseTime(detective.avgResponseTime) && (
              <div className="flex items-center gap-1.5 text-xs text-green-600 font-medium">
                <Zap className="h-3.5 w-3.5 flex-shrink-0" />
                <span>{formatResponseTime(detective.avgResponseTime)}</span>
              </div>
            )}
          </div>
        )}

        <div className="flex-1" />

        <div className="flex gap-2 pt-4 border-t border-gray-100">
          {contactButtonText && contactHref ? (
            <a
              href={contactHref}
              className="flex-1 bg-green-600 hover:bg-green-700 text-white font-medium py-2 px-3 rounded-lg text-sm text-center transition-colors duration-200 flex items-center justify-center gap-2"
            >
              {contactButtonText}
            </a>
          ) : (
            <div className="flex-1" />
          )}

          <a
            href={detectiveUrl}
            className="flex-1 border border-green-600 text-green-700 hover:bg-green-50 font-medium py-2 px-3 rounded-lg text-sm text-center transition-colors duration-200 flex items-center justify-center gap-2"
          >
            View Services
          </a>
        </div>
      </CardContent>
    </Card>
  );
}