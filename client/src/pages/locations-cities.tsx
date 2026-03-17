import { LocationListPage } from "@/components/location/LocationListPage";

export default function LocationsCitiesPage() {
  return (
    <LocationListPage
      title="All Cities with Detectives"
      description="Browse all cities where active detectives are available on AskDetectives."
      canonical="https://www.askdetectives.com/locations/cities"
      apiEndpoint="/api/locations/cities-list?limit=2000"
      itemKey={(item) => `city-service-${item.serviceId || item.slug}`}
      itemProps={(item) => ({
        id: item.serviceId || item.slug,
        slug: item.serviceSlug || item.slug,
        detectiveBusinessName: item.detectiveBusinessName || 'Local Detective',
        detectiveCity: item.detectiveCity || item.name,
        detectiveState: item.detectiveState || item.stateSlug,
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
