import { LocationListPage } from "@/components/location/LocationListPage";

interface StateItem {
  serviceId?: string;
  slug?: string;
  serviceSlug?: string;
  detectiveBusinessName?: string;
  detectiveState?: string;
  detectiveCountry?: string;
  countrySlug?: string;
  detectiveAvatar?: string;
  title?: string;
  avgRating?: number;
  reviewCount?: number;
  priceDisplay?: string;
  badgeState?: unknown;
}

export default function LocationsStatesPage() {
  return (
    <LocationListPage<StateItem>
      title="All States with Detectives"
      description="Browse all states where active detectives are available on AskDetectives."
      canonical="https://www.askdetectives.com/locations/states"
      apiEndpoint="/api/locations/states-list?limit=1000"
      itemKey={(item) => `state-service-${item.serviceId || item.slug}`}
      itemProps={(item) => ({
        id: item.serviceId || item.slug,
        slug: item.serviceSlug || item.slug,
        detectiveBusinessName: item.detectiveBusinessName || 'Local Detective',
        detectiveState: item.detectiveState || item.slug,
        detectiveCountry: item.detectiveCountry || item.countrySlug,
        detectiveAvatar: item.detectiveAvatar,
        title: item.title || 'Local Detective',
        avgRating: item.avgRating,
        reviewCount: item.reviewCount,
        priceDisplay: item.priceDisplay,
        badgeState: item.badgeState,
      })}
    />
  );
}
