import { Navbar } from "@/components/layout/navbar";
import { Footer } from "@/components/layout/footer";
import { Hero } from "@/components/home/hero";
import { ServiceCardGrid } from "@/components/common/service-card-grid";
import { DetectiveCard } from "@/components/DetectiveCard";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowRight, CheckCircle2, Sparkles, Layers } from "lucide-react";
import { SEO } from "@/components/seo";
import { Link } from "wouter";
import { useServiceCategories, useSearchDetectives, useSiteSettings, useFeaturedHomeServices } from "@/lib/hooks";
import { useCurrency } from "@/lib/currency-context";
import type { ServiceCategory } from "@shared/schema";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";

export default function Home() {
  // ...existing code...

  const { data: categoriesData, isLoading: isLoadingCategories } = useServiceCategories(true);
  const categories = (categoriesData?.categories || []) as ServiceCategory[];

  // Get selected country from context, but only use it if not GLOBAL and no manual filter applied
  const { selectedCountry } = useCurrency();
  const countryForApi = selectedCountry && selectedCountry.code !== "GLOBAL" ? selectedCountry.code : undefined;

  const { data: popularServicesData, isLoading: isLoadingPopular } = useFeaturedHomeServices(countryForApi);

  const popularServices = popularServicesData?.services || [];
  const { data: featuredDetectivesData, isLoading: isLoadingDetectives } = useSearchDetectives({ status: "active", limit: 4 });
  const featuredDetectives = featuredDetectivesData?.detectives || [];
  const { data: siteData } = useSiteSettings();
  const featuresImage = siteData?.settings?.featuresImage;

  const [topLocations, setTopLocations] = useState<{
    countries: Array<{ name: string; slug: string; detectiveCount: number }>;
    states: Array<{ name: string; slug: string; countrySlug: string; detectiveCount: number }>;
    cities: Array<{ name: string; slug: string; stateSlug: string; countrySlug: string; detectiveCount: number }>;
  } | null>(null);
  const [topLocationsLoading, setTopLocationsLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    const fetchTopLocations = async () => {
      try {
        setTopLocationsLoading(true);
        const data = await api.get<{
          countries: Array<{ name: string; slug: string; detectiveCount: number }>;
          states: Array<{ name: string; slug: string; countrySlug: string; detectiveCount: number }>;
          cities: Array<{ name: string; slug: string; stateSlug: string; countrySlug: string; detectiveCount: number }>;
        }>("/api/locations/top?limitCountries=8&limitStates=8&limitCities=8");
        if (!isMounted) return;
        setTopLocations(data);
      } catch (error) {
        console.error("[Home] Failed to load top locations:", error);
        if (!isMounted) return;
        setTopLocations(null);
      } finally {
        if (!isMounted) return;
        setTopLocationsLoading(false);
      }
    };

    fetchTopLocations();
    return () => {
      isMounted = false;
    };
  }, []);

  const topCountries = (topLocations?.countries || []).filter((item) => item.detectiveCount > 0);
  const topStates = (topLocations?.states || []).filter((item) => item.detectiveCount > 0);
  const topCities = (topLocations?.cities || []).filter((item) => item.detectiveCount > 0);
  const hasTopLocations = topCountries.length > 0 || topStates.length > 0 || topCities.length > 0;

  const formatDetectiveCount = (count: number) =>
    `${count} Detective${count === 1 ? "" : "s"}`;

  return (
    <div className="min-h-screen flex flex-col font-sans text-gray-900">
      <SEO 
        title="Find Detectives - Hire Top Private Investigators | AskDetectives" 
        description="The world's first dedicated detective service platform. A single place to discover, compare, and hire professional detectives across verified categories"
        keywords={["private investigator", "hire detective", "surveillance", "background checks", "infidelity investigation"]}
        canonical="https://www.askdetectives.com"
        robots="index, follow"
      />
      <Navbar transparentOnHome={true} overlayOnHome={true} />
      
      <main className="flex-1">
        <Hero />

        <section className="py-10 container mx-auto px-6 md:px-12 lg:px-24">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl md:text-3xl font-bold font-heading">Browse Categories</h2>
            <Link href="/categories">
              <Button variant="ghost" className="text-green-600 hover:text-green-700 hover:bg-green-50 font-normal">
                View All <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {isLoadingCategories
              ? Array.from({ length: 6 }).map((_, index) => (
                  <Card
                    key={`category-skeleton-${index}`}
                    className="hover:shadow-lg transition-shadow"
                  >
                    <CardContent className="p-6">
                      <div className="flex items-start gap-4">
                        <div className="p-3 bg-gray-100 rounded-lg w-12 h-12" />
                        <div className="flex-1 space-y-2">
                          <div className="h-6 bg-gray-200 rounded animate-pulse w-3/4" />
                          <div className="h-4 bg-gray-100 rounded animate-pulse w-full" />
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))
              : categories.map((category) => (
                  <Link
                    key={category.id}
                    href={`/search?category=${encodeURIComponent(category.name)}`}
                  >
                    <Card className="hover:shadow-lg transition-all hover:border-green-500 cursor-pointer group h-full">
                      <CardContent className="p-6 flex flex-col h-full">
                        <div className="p-3 bg-green-50 rounded-lg group-hover:bg-green-100 transition-colors w-fit mb-4">
                          <Layers className="h-6 w-6 text-green-600" />
                        </div>
                        <div className="flex-1">
                          <h3 className="font-bold text-lg text-gray-900 group-hover:text-green-700 transition-colors mb-2">
                            {category.name}
                          </h3>
                          <p className="text-sm text-gray-600 line-clamp-2">
                            {category.description || "Professional investigation services"}
                          </p>
                        </div>
                      </CardContent>
                    </Card>
                  </Link>
                ))}
          </div>
        </section>

        <section className="py-12 container mx-auto px-6 md:px-12 lg:px-24 bg-gray-50/50">
          <div className="flex items-center justify-between mb-8">
            <h2 className="text-3xl font-bold font-heading">Latest Services</h2>
            <Link href="/search">
              <Button variant="ghost" className="text-green-600 hover:text-green-700 hover:bg-green-50 font-normal" data-testid="button-view-all-popular">
                View All <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
          </div>
          <ServiceCardGrid
            services={popularServices.slice(0, 8)}
            isLoading={isLoadingPopular}
            emptyMessage="No services yet."
          />
        </section>

        {featuredDetectives.length > 0 && (
          <section className="py-12 container mx-auto px-6 md:px-12 lg:px-24">
            <div className="flex items-center justify-between mb-8">
              <h2 className="text-3xl font-bold font-heading">Featured Detectives</h2>
              <Link href="/search">
                <Button variant="ghost" className="text-green-600 hover:text-green-700 hover:bg-green-50 font-normal">
                  Explore <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </Link>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {isLoadingDetectives ? (
                [1, 2, 3, 4].map((i) => (
                  <Card key={i} className="hover:shadow-lg transition-shadow h-40">
                    <CardContent className="p-6 h-full flex items-center">
                      <div className="h-6 bg-gray-200 rounded animate-pulse w-3/4" />
                    </CardContent>
                  </Card>
                ))
              ) : (
                featuredDetectives.map((d) => {
                  return (
                    <div key={d.id}>
                      <DetectiveCard detective={d} variant="homeFeatured" />
                    </div>
                  );
                })
              )}
            </div>
          </section>
        )}

        <section className="py-14 container mx-auto px-6 md:px-12 lg:px-24">
          <div className="grid md:grid-cols-2 gap-10 items-center">
            <div className="space-y-6">
              <div className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
                <Sparkles className="h-4 w-4" />
                Why AskDetectives
              </div>
              <h2 className="text-3xl md:text-4xl font-bold font-heading text-gray-900">
                Clear answers, verified pros, and faster outcomes.
              </h2>
              <p className="text-base md:text-lg text-gray-600">
                We bring vetted investigators into one trusted marketplace so you can compare,
                contact, and hire with confidence - without the guesswork.
              </p>
              <div className="rounded-2xl border border-emerald-100 bg-white p-6 shadow-sm">
                <div className="space-y-3">
                  {[
                    "Verified profiles with real-world expertise",
                    "Transparent pricing and category-based discovery",
                    "Location-based matching for faster response",
                  ].map((item) => (
                    <div key={item} className="flex items-start gap-3 text-sm text-gray-700">
                      <CheckCircle2 className="h-5 w-5 text-emerald-600 mt-0.5" />
                      <span>{item}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="relative">
              <div className="absolute -inset-6 rounded-3xl bg-gradient-to-tr from-emerald-100 via-white to-slate-100 blur-2xl opacity-70" />
              <div className="relative overflow-hidden rounded-3xl border border-emerald-100 bg-white shadow-lg">
                {featuresImage ? (
                  <img
                    src={featuresImage}
                    alt="Investigation insights"
                    className="h-full w-full object-cover"
                    loading="lazy"
                  />
                ) : (
                  <div className="aspect-[4/3] flex items-center justify-center bg-gradient-to-br from-slate-50 to-emerald-100">
                    <div className="text-sm text-emerald-900/70">
                      Upload a features image in Admin Settings
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </section>

        <section className="py-12 container mx-auto px-6 md:px-12 lg:px-24 bg-gray-50/50">
          <div className="flex items-center justify-between mb-8">
            <h2 className="text-3xl font-bold font-heading">Top Locations</h2>
          </div>

          {topLocationsLoading ? (
            <div className="text-sm text-gray-600">Loading top locations...</div>
          ) : hasTopLocations ? (
            <div className="space-y-10">
                {topCountries.length > 0 && (
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">Top Countries</h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                      {topCountries.map((item) => (
                        <Link key={`country-${item.slug}`} href={`/detectives/${item.slug}`}>
                          <a className="block rounded-lg border border-green-100 bg-green-50 px-4 py-3 transition-colors hover:bg-green-100">
                            <div className="text-sm font-semibold text-green-900">
                              {item.name}
                            </div>
                            <div className="text-xs text-green-700">
                              {formatDetectiveCount(item.detectiveCount)}
                            </div>
                          </a>
                        </Link>
                      ))}
                    </div>
                  </div>
                )}

                {topStates.length > 0 && (
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">Top States</h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                      {topStates.map((item) => (
                        <Link key={`state-${item.countrySlug}-${item.slug}`} href={`/detectives/${item.countrySlug}/${item.slug}`}>
                          <a className="block rounded-lg border border-green-100 bg-green-50 px-4 py-3 transition-colors hover:bg-green-100">
                            <div className="text-sm font-semibold text-green-900">
                              {item.name}
                            </div>
                            <div className="text-xs text-green-700">
                              {formatDetectiveCount(item.detectiveCount)}
                            </div>
                          </a>
                        </Link>
                      ))}
                    </div>
                  </div>
                )}

                {topCities.length > 0 && (
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">Top Cities</h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                      {topCities.map((item) => (
                        <Link key={`city-${item.countrySlug}-${item.stateSlug}-${item.slug}`} href={`/detectives/${item.countrySlug}/${item.stateSlug}/${item.slug}`}>
                          <a className="block rounded-lg border border-green-100 bg-green-50 px-4 py-3 transition-colors hover:bg-green-100">
                            <div className="text-sm font-semibold text-green-900">
                              {item.name}
                            </div>
                            <div className="text-xs text-green-700">
                              {formatDetectiveCount(item.detectiveCount)}
                            </div>
                          </a>
                        </Link>
                      ))}
                    </div>
                  </div>
                )}
              </div>
          ) : (
            <div className="text-sm text-gray-500">No locations data available.</div>
          )}
        </section>

        {/* ...removed location/feature section... */}
      </main>
      
      {/* ...existing code... */}
      <Footer />
    </div>
  );
}
