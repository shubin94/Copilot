import { ServiceCard } from "@/components/home/service-card";
import { computeServiceBadges } from "@/lib/service-badges";
import { buildServiceUrl, generateSlug } from "@/lib/slug-utils";
import type { Detective, Service } from "@shared/schema";

interface RelatedService {
  id: string;
  slug?: string;
  title: string;
  category?: string;
  basePrice: number;
  offerPrice?: number | null;
  isOnEnquiry?: boolean;
  images?: string[];
  avatar: string;
  name: string;
  level?: string;
  rating: number;
  reviews: number;
  detectiveId?: string;
  detectiveSlug?: string;
  detectiveBusinessName?: string;
  detectiveCountry?: string;
  detectiveState?: string;
  detectiveCity?: string;
  badgeState?: any;
  isUnclaimed?: boolean;
  countryCode?: string;
  phone?: string;
  whatsapp?: string;
  contactEmail?: string;
}

interface RelatedServicesProps {
  services: RelatedService[];
  currentServiceTitle?: string;
}

function mapServiceToCard(service: Service & { detective: Detective & { effectiveBadges?: { blueTick?: boolean; pro?: boolean; recommended?: boolean } }; avgRating: number; reviewCount: number; planName?: string }) {
  const badgeState = computeServiceBadges({
    isVerified: service.detective.isVerified,
    effectiveBadges: service.detective.effectiveBadges,
  });

  const detectiveName = service.detective.businessName || "Unknown Detective";
  const serviceSlug = service.slug || generateSlug(service.title || "service");
  const servicePath = buildServiceUrl(
    {
      country: service.detective.country,
      state: service.detective.state,
      city: service.detective.city,
      slug: service.detective.slug,
      businessName: service.detective.businessName,
    },
    { slug: serviceSlug }
  );
  const canonicalUrl = `https://www.askdetectives.com${servicePath}`;

  const images = service.images && service.images.length > 0 ? service.images : undefined;
  const serviceImage = images ? images[0] : undefined;
  const detectiveLogo = service.detective.logo || undefined;

  return {
    id: service.id,
    slug: service.slug,
    canonicalUrl,
    detectiveId: service.detective.id,
    images,
    image: serviceImage,
    avatar: detectiveLogo || "",
    name: detectiveName,
    level: service.detective.level ? (service.detective.level === "pro" ? "Pro Level" : (service.detective.level as string).replace("level", "Level ")) : "Level 1",
    levelValue: (() => { const m = String(service.detective.level || "level1").match(/\d+/); return m ? parseInt(m[0], 10) : 1; })(),
    category: service.category,
    badgeState,
    title: service.title,
    rating: service.avgRating,
    reviews: service.reviewCount,
    price: Number(service.basePrice),
    offerPrice: service.offerPrice ? Number(service.offerPrice) : null,
    isOnEnquiry: service.isOnEnquiry,
    countryCode: service.detective.country,
    phone: service.detective.phone || undefined,
    whatsapp: service.detective.whatsapp || undefined,
    contactEmail: service.detective.contactEmail || undefined,
    detectiveCountry: service.detective.country,
    detectiveState: service.detective.state,
    detectiveCity: service.detective.city,
    detectiveSlug: service.detective.slug,
    detectiveBusinessName: service.detective.businessName,
  };
}

export function RelatedServices({ services, currentServiceTitle }: RelatedServicesProps) {
  if (!services || services.length === 0) return null;

  return (
    <div className="mt-12 mb-8">
      <h2 className="text-2xl font-bold mb-6">Similar Services You May Like</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {services.map((service) => (
          <ServiceCard key={service.id} {...mapServiceToCard(service as any)} />
        ))}
      </div>
    </div>
  );
}
