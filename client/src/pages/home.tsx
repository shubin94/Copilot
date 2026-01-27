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
import { useSearchServices, useServiceCategories, useSearchDetectives } from "@/lib/hooks";
import type { Service, Detective, ServiceCategory } from "@shared/schema";

function mapServiceToCard(service: Service & { detective: Detective; avgRating: number; reviewCount: number }) {
  

  const badges: string[] = [];
  
  // BADGE ORDER: 1. Blue Tick, 2. Pro, 3. Recommended, 4. Verified
  
  // Blue Tick Badge - FIRST
  if (service.detective.hasBlueTick && service.detective.subscriptionPackageId) {
    badges.push("blueTick");
  }
  
  // Pro Badge - SECOND (from package badges)
  if (service.detective.subscriptionPackageId && service.detective.subscriptionPackage?.badges) {
    if (typeof service.detective.subscriptionPackage.badges === 'object' && !Array.isArray(service.detective.subscriptionPackage.badges)) {
      if (service.detective.subscriptionPackage.badges['pro']) {
        badges.push("pro");
      }
      if (service.detective.subscriptionPackage.badges['recommended']) {
        badges.push("recommended");
      }
    } else if (Array.isArray(service.detective.subscriptionPackage.badges)) {
      if (service.detective.subscriptionPackage.badges.some((b: string) => b.toLowerCase() === 'pro')) {
        badges.push("pro");
      }
      if (service.detective.subscriptionPackage.badges.some((b: string) => b.toLowerCase() === 'recommended')) {
        badges.push("recommended");
      }
    }
  }
  
  // Verified Badge - FOURTH
  if (service.detective.isVerified) {
    badges.push("verified");
  }

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
    category: service.category,
    badges,
    title: service.title,
    rating: service.avgRating,
    reviews: service.reviewCount,
    price: Number(service.basePrice),
    offerPrice: service.offerPrice ? Number(service.offerPrice) : null,
    countryCode: service.detective.country,
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

  return (
    <div className="min-h-screen flex flex-col font-sans text-gray-900">
      <SEO 
        title="FindDetectives - Hire Top Private Investigators" 
        description="The leading marketplace for professional private investigation services. Find verified detectives for surveillance, background checks, and more."
        keywords={["private investigator", "hire detective", "surveillance", "background checks", "infidelity investigation"]}
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

        <section className="py-16 container mx-auto px-6 md:px-12 lg:px-24">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h2 className="text-3xl font-bold font-heading">Browse by Category</h2>
              <p className="text-gray-600 mt-2">Explore professional detective services organized by specialty</p>
            </div>
            <Link href="/categories">
              <Button variant="ghost" className="text-green-600 hover:text-green-700 hover:bg-green-50" data-testid="button-view-all-categories">
                View All <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {isLoadingCategories ? (
              [1, 2, 3].map((i) => (
                <Card key={i} className="hover:shadow-lg transition-shadow">
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
                <Link key={category.id} href={`/search?q=${encodeURIComponent(category.name)}`}>
                  <Card className="hover:shadow-lg transition-all hover:border-green-500 cursor-pointer group" data-testid={`card-category-${category.id}`}>
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
              <div className="col-span-full flex flex-col items-center justify-center py-12 text-gray-500 bg-gray-50 rounded-lg border border-dashed border-gray-200" data-testid="empty-categories">
                <AlertCircle className="h-12 w-12 text-gray-400 mb-3" />
                <p className="text-sm">No service categories available. Admin needs to create categories first.</p>
              </div>
            )}
          </div>
        </section>

        <section className="py-12 container mx-auto px-6 md:px-12 lg:px-24 bg-gray-50/50">
          <div className="flex items-center justify-between mb-8">
            <h2 className="text-3xl font-bold font-heading">Latest Services</h2>
            <Link href="/search">
              <Button variant="ghost" className="text-green-600 hover:text-green-700 hover:bg-green-50" data-testid="button-view-all-popular">
                View All <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {isLoadingPopular ? (
              [1, 2, 3, 4].map((i) => (
                <ServiceCardSkeleton key={i} />
              ))
            ) : popularServices.length > 0 ? (
              popularServices.map((service) => (
                <ServiceCard key={service.id} {...service} />
              ))
            ) : (
              <div className="col-span-full flex flex-col items-center justify-center py-12 text-gray-500 bg-gray-50 rounded-lg border border-dashed border-gray-200" data-testid="empty-popular-services">
                <AlertCircle className="h-12 w-12 text-gray-400 mb-3" />
                <p className="text-sm">No services available yet.</p>
              </div>
            )}
          </div>
        </section>

        {featuredDetectives.length > 0 && (
          <section className="py-12 container mx-auto px-6 md:px-12 lg:px-24">
            <div className="flex items-center justify-between mb-8">
              <h2 className="text-3xl font-bold font-heading">Featured Detectives</h2>
              <Link href="/search">
                <Button variant="ghost" className="text-green-600 hover:text-green-700 hover:bg-green-50">
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
                The best part? Everything.
              </h2>
              
              <div className="space-y-4">
                <div>
                  <h3 className="flex items-center text-lg font-bold mb-1">
                    <div className="h-6 w-6 rounded-full border border-gray-900 flex items-center justify-center mr-2 text-sm">✓</div>
                    Stick to your budget
                  </h3>
                  <p className="text-gray-600 ml-8">Find the right service for every price point. No hourly rates, just project-based pricing.</p>
                </div>
                
                <div>
                  <h3 className="flex items-center text-lg font-bold mb-1">
                    <div className="h-6 w-6 rounded-full border border-gray-900 flex items-center justify-center mr-2 text-sm">✓</div>
                    Get quality work done quickly
                  </h3>
                  <p className="text-gray-600 ml-8">Hand your project over to a talented detective in minutes, get long-lasting results.</p>
                </div>
                
                <div>
                  <h3 className="flex items-center text-lg font-bold mb-1">
                    <div className="h-6 w-6 rounded-full border border-gray-900 flex items-center justify-center mr-2 text-sm">✓</div>
                    Pay when you're happy
                  </h3>
                  <p className="text-gray-600 ml-8">Upfront quotes mean no surprises. Payments only get released when you approve.</p>
                </div>
                
                <div>
                  <h3 className="flex items-center text-lg font-bold mb-1">
                    <div className="h-6 w-6 rounded-full border border-gray-900 flex items-center justify-center mr-2 text-sm">✓</div>
                    Count on 24/7 support
                  </h3>
                  <p className="text-gray-600 ml-8">Our round-the-clock support team is available to help anytime, anywhere.</p>
                </div>
              </div>
            </div>
            
            <div className="flex-1 relative min-h-[400px] lg:min-h-full">
              <div className="absolute inset-0 h-full w-full bg-gradient-to-br from-blue-100 to-green-50 rounded-lg shadow-xl flex items-center justify-center">
                <div className="text-center text-gray-400">
                  <Layers className="h-20 w-20 mx-auto mb-4 opacity-30" />
                  <p className="text-sm">Marketing Image Placeholder</p>
                </div>
              </div>
            </div>
          </div>
        </section>

      </main>
      
      <Footer />
    </div>
  );
}
