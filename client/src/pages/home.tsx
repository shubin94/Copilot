import { Navbar } from "@/components/layout/navbar";
import { Footer } from "@/components/layout/footer";
import { Hero } from "@/components/home/hero";
import { ServiceCardGrid } from "@/components/common/service-card-grid";
import { DetectiveCard } from "@/components/DetectiveCard";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowRight, AlertCircle, Layers } from "lucide-react";
import { SEO } from "@/components/seo";
import { Link } from "wouter";
import { useServiceCategories, useSearchDetectives, useSiteSettings, useFeaturedHomeServices } from "@/lib/hooks";
import { useCurrency } from "@/lib/currency-context";
import type { ServiceCategory } from "@shared/schema";
import { useEffect, useRef } from "react";

export default function Home() {
  // ...existing code...

  const { data: categoriesData, isLoading: isLoadingCategories } = useServiceCategories(true);
  const categories = categoriesData?.categories || [];

  // Get selected country from context, but only use it if not GLOBAL and no manual filter applied
  const { selectedCountry } = useCurrency();
  const countryForApi = selectedCountry && selectedCountry.code !== "GLOBAL" ? selectedCountry.code : undefined;

  const { data: popularServicesData, isLoading: isLoadingPopular } = useFeaturedHomeServices(countryForApi);

  const popularServices = popularServicesData?.services || [];
  const { data: featuredDetectivesData, isLoading: isLoadingDetectives } = useSearchDetectives({ status: "active", limit: 4 });
  const featuredDetectives = featuredDetectivesData?.detectives || [];
  const { data: siteData } = useSiteSettings();
  const featuresImage = siteData?.settings?.featuresImage;

  const scrollContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container || categories.length === 0) return;

    const scrollInterval = setInterval(() => {
      const scrollAmount = container.offsetWidth * 0.33; // Scroll one card width (approx 1/3 of viewport)
      const maxScroll = container.scrollWidth - container.offsetWidth;
      
      if (container.scrollLeft >= maxScroll - 10) {
        // Reset to start
        container.scrollTo({ left: 0, behavior: 'smooth' });
      } else {
        // Scroll to next
        container.scrollBy({ left: scrollAmount, behavior: 'smooth' });
      }
    }, 5000); // Every 5 seconds

    return () => clearInterval(scrollInterval);
  }, [categories.length]);

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
        <h1 className="sr-only">
          Find Trusted Private Investigators & Detective Agencies Worldwide
        </h1>
        <Hero />

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

        {/* ...removed location/feature section... */}
      </main>
      
      {/* ...existing code... */}
      <Footer />
    </div>
  );
}
