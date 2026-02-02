import { Navbar } from "@/components/layout/navbar";
import { Footer } from "@/components/layout/footer";
import { Hero } from "@/components/home/hero";
import { ServiceCard } from "@/components/home/service-card";
import { ServiceCardSkeleton } from "@/components/home/service-card-skeleton";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowRight, AlertCircle, Layers } from "lucide-react";
import { SEO } from "@/components/seo";
import { Link } from "wouter";
import { useSearchServices, useServiceCategories, useSearchDetectives, useSiteSettings } from "@/lib/hooks";
import type { Service, Detective, ServiceCategory } from "@shared/schema";
import { buildBadgesFromEffective } from "@/lib/badges";
import { useEffect, useRef } from "react";

function mapServiceToCard(service: Service & { detective: Detective & { effectiveBadges?: { blueTick?: boolean; pro?: boolean; recommended?: boolean } }; avgRating: number; reviewCount: number }) {
  const badges = buildBadgesFromEffective(service.detective.effectiveBadges, !!service.detective.isVerified);

  const detectiveName = service.detective.businessName || "Unknown Detective";

  // Use actual database images - NO MOCK DATA
  const images = service.images && service.images.length > 0 ? service.images : undefined;
  const serviceImage = images ? images[0] : undefined;
  const detectiveLogo = service.detective.logo || undefined;
  
  return {
    id: service.id,
    detectiveId: service.detective.id,
    images,
    image: serviceImage,
    avatar: detectiveLogo || "",
    name: detectiveName,
    level: service.detective.level ? (service.detective.level === "pro" ? "Pro Level" : (service.detective.level as string).replace("level", "Level ")) : "Level 1",
    levelValue: (() => { const m = String(service.detective.level || "level1").match(/\d+/); return m ? parseInt(m[0], 10) : 1; })(),
    plan: service.detective.subscriptionPlan,
    category: service.category,
    badges,
    title: service.title,
    rating: service.avgRating,
    reviews: service.reviewCount,
    price: Number(service.basePrice),
    offerPrice: service.offerPrice ? Number(service.offerPrice) : null,
    isOnEnquiry: service.isOnEnquiry,
    countryCode: service.detective.country,
    location: service.detective.location || "",
    phone: service.detective.phone || undefined,
    whatsapp: service.detective.whatsapp || undefined,
    contactEmail: service.detective.contactEmail || undefined,
  };
}

export default function Home() {
  const { data: categoriesData, isLoading: isLoadingCategories } = useServiceCategories(true);
  const categories = categoriesData?.categories || [];

  const { data: popularServicesData, isLoading: isLoadingPopular } = useSearchServices({ 
    limit: 8, 
    sortBy: "recent" 
  });

  const popularServices = popularServicesData?.services?.map(mapServiceToCard) || [];
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
        title="FindDetectives - Hire Top Private Investigators" 
        description="The leading marketplace for professional private investigation services. Find verified detectives for surveillance, background checks, and more."
        keywords={["private investigator", "hire detective", "surveillance", "background checks", "infidelity investigation"]}
        canonical={window.location.origin}
        robots="index, follow"
      />
      <Navbar transparentOnHome={true} overlayOnHome={true} />
      
      <main className="flex-1">
        <Hero />

        <div className="bg-gray-50 py-8 border-b border-gray-200">
          <div className="container mx-auto px-6 md:px-12 lg:px-24 flex justify-center gap-8 md:gap-16 grayscale opacity-50">
            <span className="font-bold text-xl">Meta</span>
            <span className="font-bold text-xl">Google</span>
            <span className="font-bold text-xl">Netflix</span>
            <span className="font-bold text-xl">P&G</span>
            <span className="font-bold text-xl">PayPal</span>
          </div>
        </div>

        <section className="py-16">
          <style>{`
            .category-scroll-container {
              scrollbar-width: none;
              -ms-overflow-style: none;
            }
            .category-scroll-container::-webkit-scrollbar {
              display: none;
            }
            .category-card {
              flex: 0 0 calc((100% - 2 * 1.5rem) / 3);
            }
            @media (max-width: 1023px) {
              .category-card {
                flex-basis: calc((100% - 1 * 1.5rem) / 2);
              }
            }
            @media (max-width: 639px) {
              .category-card {
                flex-basis: 100%;
              }
            }
          `}</style>

          <div className="container mx-auto px-6 md:px-12 lg:px-24">
            <div className="flex items-center justify-between mb-8">
              <div>
                <h2 className="text-3xl font-bold font-heading">Browse by Category</h2>
                <p className="text-gray-600 mt-2">Explore professional detective services organized by specialty</p>
              </div>
              <Link href="/categories">
                <Button variant="ghost" className="text-green-600 hover:text-green-700 hover:bg-green-50 font-normal" data-testid="button-view-all-categories">
                  View All <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </Link>
            </div>

            <div ref={scrollContainerRef} className="category-scroll-container overflow-x-auto overflow-y-hidden pb-4">
              <div className="flex gap-6 w-full">
              {isLoadingCategories ? (
                [1, 2, 3].map((i) => (
                  <Card key={i} className="category-card hover:shadow-lg transition-shadow">
                    <CardContent className="p-6">
                    <div className="flex items-start gap-4">
                      <div className="p-3 bg-green-50 rounded-lg">
                        <Layers className="h-6 w-6 text-green-600" />
                      </div>
                      <div className="flex-1 space-y-2">
                        <div className="h-6 bg-gray-200 rounded animate-pulse w-3/4" />
                        <div className="h-4 bg-gray-100 rounded animate-pulse w-full" />
                        <div className="h-4 bg-gray-100 rounded animate-pulse w-2/3" />
                      </div>
                    </div>
                  </CardContent>
                </Card>
                ))
              ) : categories.length > 0 ? (
                categories.map((category: ServiceCategory) => (
                  <Link key={category.id} href={`/search?q=${encodeURIComponent(category.name)}`} className="category-card">
                    <Card className="hover:shadow-lg transition-all hover:border-green-500 cursor-pointer group h-full" data-testid={`card-category-${category.id}`}>
                      <CardContent className="p-6">
                      <div className="flex items-start gap-4">
                        <div className="p-3 bg-green-50 rounded-lg group-hover:bg-green-100 transition-colors">
                          <Layers className="h-6 w-6 text-green-600" />
                        </div>
                        <div className="flex-1">
                          <h3 className="font-bold text-lg text-gray-900 group-hover:text-green-700 transition-colors mb-2" data-testid={`text-category-name-${category.id}`}>
                            {category.name}
                          </h3>
                          <p className="text-sm text-gray-600 line-clamp-2" data-testid={`text-category-description-${category.id}`}>
                            {category.description || "Professional investigation services"}
                          </p>
                          <div className="mt-3 flex items-center text-sm text-green-600 font-medium group-hover:gap-2 transition-all">
                            Explore <ArrowRight className="h-4 w-4 ml-1 group-hover:translate-x-1 transition-transform" />
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                  </Link>
                ))
              ) : (
                <div className="w-full flex flex-col items-center justify-center py-12 text-gray-500 bg-gray-50 rounded-lg border border-dashed border-gray-200" data-testid="empty-categories">
                  <AlertCircle className="h-12 w-12 text-gray-400 mb-3" />
                  <p className="text-sm text-gray-500">No categories yet</p>
                </div>
                )}
              </div>
            </div>
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
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {isLoadingPopular ? (
              [1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
                <ServiceCardSkeleton key={i} />
              ))
            ) : popularServices.length > 0 ? (
              popularServices.slice(0, 8).map((service) => (
                <ServiceCard key={service.id} {...service} />
              ))
            ) : (
              <div className="col-span-full flex flex-col items-center justify-center py-12 text-gray-500 bg-gray-50 rounded-lg border border-dashed border-gray-200" data-testid="empty-popular-services">
                <AlertCircle className="h-12 w-12 text-gray-400 mb-3" />
                <p className="text-sm text-gray-500">No services yet</p>
              </div>
            )}
          </div>
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
                  <Card key={i} className="hover:shadow-lg transition-shadow">
                    <CardContent className="p-6">
                      <div className="h-6 bg-gray-200 rounded animate-pulse w-3/4 mb-2" />
                      <div className="h-4 bg-gray-100 rounded animate-pulse w-1/2" />
                    </CardContent>
                  </Card>
                ))
              ) : (
                featuredDetectives.map((d) => (
                  <Link key={d.id} href={`/p/${d.id}`}>
                    <Card className="hover:shadow-lg transition-shadow cursor-pointer">
                      <CardContent className="p-6">
                        <div className="flex items-center gap-4">
                          <div className="h-12 w-12 rounded-full overflow-hidden bg-gray-100 flex items-center justify-center">
                            {d.logo ? (
                              <img src={d.logo} alt={d.businessName || "Detective"} className="h-12 w-12 object-cover" />
                            ) : (
                              <div className="h-8 w-8 rounded-full bg-gray-200" />
                            )}
                          </div>
                          <div className="flex-1">
                            <div className="font-bold text-lg text-gray-900 hover:underline">{d.businessName || "Unknown Detective"}</div>
                            <div className="text-sm text-gray-600">{d.location || d.country || ""}</div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </Link>
                ))
              )}
            </div>
          </section>
        )}

        <section className="bg-green-50 py-16">
          <div className="container mx-auto px-6 md:px-12 lg:px-24 flex flex-col lg:flex-row items-stretch gap-12">
            <div className="flex-1 space-y-6 flex flex-col justify-center">
              <h2 className="text-3xl md:text-4xl font-bold font-heading">
                The best part? Everything that matters.
              </h2>
              
              <div className="space-y-4">
                <div>
                  <h3 className="flex items-center text-lg font-bold mb-1">
                    <div className="h-6 w-6 rounded-full border border-gray-900 flex items-center justify-center mr-2 text-sm">✓</div>
                    The world's first dedicated detective service platform
                  </h3>
                  <p className="text-gray-600 ml-8">A single place to discover, compare, and hire professional detectives across verified categories.</p>
                </div>
                
                <div>
                  <h3 className="flex items-center text-lg font-bold mb-1">
                    <div className="h-6 w-6 rounded-full border border-gray-900 flex items-center justify-center mr-2 text-sm">✓</div>
                    Trusted detectives, faster results
                  </h3>
                  <p className="text-gray-600 ml-8">Work only with verified and recommended detectives, so you get accurate outcomes without delays.</p>
                </div>
                
                <div>
                  <h3 className="flex items-center text-lg font-bold mb-1">
                    <div className="h-6 w-6 rounded-full border border-gray-900 flex items-center justify-center mr-2 text-sm">✓</div>
                    Talk first. Pay only if it feels right
                  </h3>
                  <p className="text-gray-600 ml-8">Connect directly with the detective, discuss your case, and proceed with payment only when you're confident.</p>
                </div>
                
                <div>
                  <h3 className="flex items-center text-lg font-bold mb-1">
                    <div className="h-6 w-6 rounded-full border border-gray-900 flex items-center justify-center mr-2 text-sm">✓</div>
                    Your review helps others choose better
                  </h3>
                  <p className="text-gray-600 ml-8">Share your experience after the service — your review guides others to make the right decision.</p>
                </div>
              </div>
            </div>
            
            <div className="flex-1 relative min-h-[400px] lg:min-h-full">
              <div className="absolute inset-0 h-full w-full rounded-lg shadow-xl overflow-hidden">
                <img
                  src={featuresImage || "/pub.png"}
                  alt="Professional detectives collaborating on a case"
                  className="h-full w-full object-cover"
                  loading="lazy"
                />
              </div>
            </div>
          </div>
        </section>

      </main>
      
      <Footer />
    </div>
  );
}
