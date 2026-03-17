import { LocationListPage } from "@/components/location/LocationListPage";

export default function LocationsStatesPage() {
  return (
    <LocationListPage
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
