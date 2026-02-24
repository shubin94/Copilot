/**
 * HomepageLocationGrid Component
 * 
 * Server-side rendered, SEO-friendly location browsing section for homepage.
 * Displays top countries, popular cities, and states in a clean grid layout.
 * 
 * Requirements:
 * - Flat grid layout (no nested indentation)
 * - Responsive: 3-4 columns desktop, 2 tablet, 1 mobile
 * - Max ~30 total links
 * - Standard <a> tags for crawlability
 * - SSR-friendly (no client-side data fetching)
 */

import { ArrowRight } from "lucide-react";
import { generateSlug } from "@/lib/slug-utils";

interface LocationLink {
  name: string;
  country?: string;
  state?: string;
  city?: string;
  detectiveCount: number;
}

interface HomepageLocationGridProps {
  topCountries: Array<{ country: string; detectiveCount: number }>;
  popularCities: Array<{ country: string; state: string; city: string; detectiveCount: number }>;
  topStates?: Array<{ country: string; state: string; detectiveCount: number }>;
}

/**
 * Generate detective location URL from components
 */
function buildLocationUrl(
  country?: string,
  state?: string,
  city?: string
): string {
  const parts: string[] = [];
  
  if (country) {
    parts.push(generateSlug(country));
  }
  if (state) {
    parts.push(generateSlug(state));
  }
  if (city) {
    parts.push(generateSlug(city));
  }

  return `/detectives/${parts.join("/")}`;
}

/**
 * Individual location link component
 */
function LocationLink({
  label,
  url,
  isPrimary = false,
}: {
  label: string;
  url: string;
  isPrimary?: boolean;
}) {
  return (
    <a
      href={url}
      className={`
        text-blue-600 hover:text-blue-800 hover:underline
        transition-colors duration-200
        inline-flex items-center gap-1
        ${isPrimary ? "font-semibold text-base" : "text-sm"}
      `}
    >
      {label}
      <ArrowRight className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity" />
    </a>
  );
}

/**
 * Homepage Location Grid - Main Component
 * Displays location links in a clean, responsive grid
 */
export function HomepageLocationGrid({
  topCountries,
  popularCities,
  topStates,
}: HomepageLocationGridProps) {
  if (!topCountries?.length && !popularCities?.length) {
    return null;
  }

  return (
    <section
      id="homepage-location-grid"
      className="py-16 bg-gray-50 border-t border-gray-200"
      aria-label="Find Private Detectives by Location"
    >
      <div className="container mx-auto px-6 md:px-12 lg:px-24">
        {/* Section Title */}
        <div className="mb-12">
          <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-3">
            Find Private Detectives by Location
          </h2>
          <p className="text-base text-gray-600 max-w-2xl">
            Browse vetted private investigators and detective services in your area. 
            Search by country, state, or city to find the right professional.
          </p>
        </div>

        {/* Top Countries Subsection */}
        {topCountries?.length > 0 && (
          <div className="mb-12">
            <h3 className="text-lg font-bold text-gray-900 mb-4 pb-2 border-b border-gray-300">
              Popular Countries
            </h3>
            <nav
              className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4"
              aria-label="Popular countries with detectives"
            >
              {topCountries.map((country) => {
                const url = buildLocationUrl(country.country);
                return (
                  <div
                    key={country.country}
                    className="flex items-center gap-3 p-3 rounded-lg hover:bg-white transition-colors duration-200 group"
                  >
                    <div className="flex-1">
                      <LocationLink
                        label={country.country}
                        url={url}
                        isPrimary={true}
                      />
                      <p className="text-xs text-gray-500 mt-1">
                        {country.detectiveCount} detective{country.detectiveCount !== 1 ? "s" : ""}
                      </p>
                    </div>
                  </div>
                );
              })}
            </nav>
          </div>
        )}

        {/* Popular Cities Subsection */}
        {popularCities?.length > 0 && (
          <div className="mb-12">
            <h3 className="text-lg font-bold text-gray-900 mb-4 pb-2 border-b border-gray-300">
              Popular Cities
            </h3>
            <nav
              className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4"
              aria-label="Popular cities with detective services"
            >
              {popularCities.map((location) => {
                const url = buildLocationUrl(
                  location.country,
                  location.state,
                  location.city
                );
                const label = `${location.city}, ${location.state}`;
                
                return (
                  <div
                    key={`${location.country}|${location.state}|${location.city}`}
                    className="flex items-center gap-3 p-3 rounded-lg hover:bg-white transition-colors duration-200 group"
                  >
                    <div className="flex-1">
                      <LocationLink label={label} url={url} isPrimary={true} />
                      <p className="text-xs text-gray-500 mt-1">
                        {location.detectiveCount} detective{location.detectiveCount !== 1 ? "s" : ""}
                      </p>
                    </div>
                  </div>
                );
              })}
            </nav>
          </div>
        )}

        {/* Top States Subsection (Optional) */}
        {topStates?.length > 0 && (
          <div className="mb-8">
            <h3 className="text-sm font-bold text-gray-700 mb-3 pb-2 border-b border-gray-200">
              More States & Regions
            </h3>
            <nav
              className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2"
              aria-label="Additional states and regions"
            >
              {topStates.map((location) => {
                const url = buildLocationUrl(location.country, location.state);
                return (
                  <a
                    key={`${location.country}|${location.state}`}
                    href={url}
                    className="text-xs text-blue-600 hover:text-blue-800 hover:underline transition-colors duration-200 py-1"
                    title={`Find detectives in ${location.state}, ${location.country}`}
                  >
                    {location.state}
                  </a>
                );
              })}
            </nav>
          </div>
        )}

        {/* CTA to Browse All */}
        <div className="mt-8 pt-8 border-t border-gray-300 text-center">
          <a
            href="/detectives"
            className="inline-flex items-center gap-2 text-green-600 hover:text-green-700 font-semibold transition-colors"
          >
            Browse All Detectives
            <ArrowRight className="h-4 w-4" />
          </a>
        </div>
      </div>
    </section>
  );
}
