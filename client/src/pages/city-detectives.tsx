import { useState, useEffect } from "react";
import { useRoute } from "wouter";
import { Navbar } from "@/components/layout/navbar";
import { Footer } from "@/components/layout/footer";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { SEO } from "@/components/seo";
import { Button } from "@/components/ui/button";
import { MapPin, ExternalLink, ChevronDown } from "lucide-react";
import { generateBreadcrumbListSchema, generateFAQPageSchema } from "@/lib/structured-data";
import { getDetectiveProfileUrl } from "@/lib/utils";

interface Detective {
  id: string;
  businessName?: string;
  slug?: string;
  logo?: string;
  city?: string;
  state?: string;
  country?: string;
  businessType?: string;
  isVerified?: boolean;
  effectiveBadges?: { blueTick?: boolean; pro?: boolean; recommended?: boolean };
  level?: string;
  phone?: string;
  whatsapp?: string;
  contactEmail?: string;
}

interface LocationMeta {
  country: string;
  state?: string;
  city?: string;
}

interface CityPageData {
  location: LocationMeta;
  detectives: Detective[];
  count: number;
}

// Check for SSR data injected by server
const getSSRData = (): CityPageData | null => {
  if (typeof window !== 'undefined' && (window as any).__CITY_PAGE_DATA__) {
    console.log('[CityDetectivesPage] Using SSR data from server');
    return (window as any).__CITY_PAGE_DATA__;
  }
  return null;
};

interface RelatedCity {
  name: string;
  slug: string;
  detectiveCount?: number;
}

// Dynamic content generator for unique city descriptions
const generateCityDescription = (cityName: string, stateName: string, detectiveCount: number): string => {
  const descriptions = [
    `Searching for professional private investigation services in ${cityName}? Our directory features vetted agencies across ${stateName} specializing in corporate, legal, and personal cases. With ${detectiveCount} licensed detectives available, you'll find the expertise you need for your investigation.`,
    `Need a trusted private investigator in ${cityName}, ${stateName}? Connect with experienced detectives who handle everything from background checks to surveillance. Our network of ${detectiveCount} registered professionals provides confidential, reliable investigation services tailored to your needs.`,
    `Browse ${detectiveCount} certified detectives in ${cityName} offering specialized investigation services throughout ${stateName}. Whether you require legal discovery assistance, corporate investigations, or personal security services, find qualified professionals ready to help.`,
    `Looking for private detective services in ${cityName}? Our comprehensive directory showcases ${detectiveCount} licensed investigators serving the ${stateName} area with expertise in fraud investigation, skip tracing, and witness interviews. All detectives are verified and insured.`,
    `Hire a private investigator in ${cityName} with proven experience and verified credentials. Our network includes ${detectiveCount} professional detectives across ${stateName} offering 24/7 investigation services for legal, corporate, and personal matters.`,
  ];
  
  // Use deterministic random selection based on city hash
  const hash = cityName.split("").reduce((acc, char) => acc + char.charCodeAt(0), 0);
  return descriptions[hash % descriptions.length];
};

// Extract unique specialties/business types from detectives
const getTopSpecialties = (detectives: Detective[], limit: number = 3): string[] => {
  const specialties = new Map<string, number>();
  
  detectives.forEach((detective) => {
    if (detective.businessType) {
      const type = detective.businessType.trim();
      specialties.set(type, (specialties.get(type) || 0) + 1);
    }
  });
  
  return Array.from(specialties.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([type]) => type);
};

// Collapsible FAQ Item Component
const FAQItem = ({ question, answer, isOpen, setIsOpen }: { question: string; answer: string; isOpen: boolean; setIsOpen: (open: boolean) => void }) => (
  <div className="border border-gray-200 rounded-lg mb-4">
    <button
      onClick={() => setIsOpen(!isOpen)}
      className="w-full px-6 py-4 text-left font-semibold text-gray-900 hover:bg-gray-50 flex justify-between items-center transition-colors"
    >
      {question}
      <ChevronDown className={`h-5 w-5 transition-transform ${isOpen ? "rotate-180" : ""}`} />
    </button>
    {isOpen && (
      <div className="px-6 py-4 text-gray-700 text-sm bg-gray-50 border-t border-gray-200">
        {answer}
      </div>
    )}
  </div>
);

export default function CityDetectivesPage() {
  // Support routes: /detectives/:country, /detectives/:country/:state, /detectives/:country/:state/:city
  const [match, params] = useRoute("/detectives/:country/:state/:city");
  const [matchState, paramsState] = useRoute("/detectives/:country/:state");
  const [matchCountry, paramsCountry] = useRoute("/detectives/:country");
  
  // Use the matched route params
  const matchedParams = match ? params : (matchState ? paramsState : paramsCountry);
  
  const [detectives, setDetectives] = useState<Detective[]>([]);
  const [locationMeta, setLocationMeta] = useState<LocationMeta | null>(null);
  const [relatedCities, setRelatedCities] = useState<RelatedCity[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedFAQs, setExpandedFAQs] = useState<{ [key: number]: boolean }>({ 0: false, 1: false, 2: false });

  const countrySlug = matchedParams?.country || "";
  const stateSlug = matchedParams?.state || "";
  const citySlug = matchedParams?.city || "";
  const isCountryLevel = !!countrySlug && !stateSlug;
  const isStateLevel = !!countrySlug && !!stateSlug && !citySlug;
  const isCityLevel = !!countrySlug && !!stateSlug && !!citySlug;

  const canonicalPath = isCityLevel
    ? `/detectives/${countrySlug}/${stateSlug}/${citySlug}/`
    : isStateLevel
    ? `/detectives/${countrySlug}/${stateSlug}/`
    : `/detectives/${countrySlug}/`;
  const canonicalUrl = `https://www.askdetectives.com${canonicalPath}`;
  const locationApiPath = `/api/detectives/location/${[countrySlug, stateSlug, citySlug]
    .filter((segment) => !!segment)
    .map((segment) => encodeURIComponent(segment))
    .join("/")}`;
  const stateApiPath = `/api/detectives/location/${[countrySlug, stateSlug]
    .filter((segment) => !!segment)
    .map((segment) => encodeURIComponent(segment))
    .join("/")}`;

  useEffect(() => {
    const fetchLocationDetectives = async () => {
      try {
        setLoading(true);
        setError(null);

        // Check if SSR data is available from server
        const ssrData = getSSRData();
        if (ssrData) {
          console.log('[CityDetectivesPage] Using SSR data from server-side injection');
          setDetectives(ssrData.detectives);
          setLocationMeta({
            country: ssrData.location.country,
            state: ssrData.location.state,
            city: ssrData.location.city,
          });
          setLoading(false);
          return;
        }

        // If no SSR data, fetch from API (for direct navigation or client-side clicks)
        // Fetch detectives for this location
        const response = await fetch(locationApiPath);

        if (!response.ok) {
          if (response.status === 404) {
            setError(`Location not found: ${[citySlug, stateSlug, countrySlug].filter(Boolean).join(", ")}`);
          } else {
            setError("Failed to load detectives for this location");
          }
          setLoading(false);
          return;
        }

        const data = await response.json();
        setDetectives(data.detectives || []);
        setLocationMeta(data.meta);

        // Fetch related cities in the same state for cross-linking
        if (stateSlug) {
          try {
            const citiesResponse = await fetch(stateApiPath);
            if (citiesResponse.ok) {
              const citiesData = await citiesResponse.json();
              setRelatedCities([]);
            }
          } catch (err) {
            console.error("Failed to fetch related cities:", err);
          }
        }
      } catch (err) {
        console.error("Error fetching location detectives:", err);
        setError("An error occurred while loading detectives");
      } finally {
        setLoading(false);
      }
    };

    if (countrySlug) {
      fetchLocationDetectives();
    }
  }, [countrySlug, stateSlug, citySlug, locationApiPath, stateApiPath]);

  // SEO Metadata
  const cityName = locationMeta?.city || citySlug?.replace(/-/g, " ") || "";
  const stateName = locationMeta?.state || stateSlug?.replace(/-/g, " ") || "";
  const countryName = locationMeta?.country || countrySlug?.replace(/-/g, " ") || "";
  const locationLabel = isCityLevel
    ? `${cityName}, ${stateName}`
    : isStateLevel
    ? `${stateName}, ${countryName}`
    : countryName;
  
  // Enhanced SEO Title and Description with current year
  const currentYear = new Date().getFullYear();
  const seoTitle = isCityLevel
    ? `Top 10 Best Private Detectives in ${cityName}, ${stateName} (${currentYear})`
    : isStateLevel
    ? `Top Private Detectives in ${stateName}, ${countryName} (${currentYear})`
    : `Top Private Detectives in ${countryName} (${currentYear})`;
  const seoDescription = `Browse trusted detective agencies in ${locationLabel}. Compare ratings, services, and contact vetted professionals today. ${detectives.length} licensed detectives available.`;
  const h1Text = isCityLevel
    ? `Best Private Detectives in ${cityName}, ${stateName}`
    : isStateLevel
    ? `Best Private Detectives in ${stateName}, ${countryName}`
    : `Best Private Detectives in ${countryName}`;

  const breadcrumbs = [{ name: "Home", url: "https://www.askdetectives.com/" }];
  if (countryName && countrySlug) {
    breadcrumbs.push({
      name: countryName,
      url: `https://www.askdetectives.com/detectives/${countrySlug}/`,
    });
  }
  if (stateName && stateSlug) {
    breadcrumbs.push({
      name: stateName,
      url: `https://www.askdetectives.com/detectives/${countrySlug}/${stateSlug}/`,
    });
  }
  if (cityName && citySlug) {
    breadcrumbs.push({
      name: cityName,
      url: canonicalUrl,
    });
  }

  // Get unique specialties from detectives in this city
  const topSpecialties = getTopSpecialties(detectives, 3);
  const verifiedCount = detectives.filter((d) => d.isVerified).length;
  const verificationRate = detectives.length > 0 ? Math.round((verifiedCount / detectives.length) * 100) : 0;

  // JSON-LD Schemas for SearchResultsPage + BreadcrumbList + FAQPage
  const searchResultsSchema = {
    "@context": "https://schema.org",
    "@type": "SearchResultsPage",
    "name": seoTitle,
    "description": seoDescription,
    "url": canonicalUrl,
    "mainEntity": isCityLevel
      ? {
          "@type": "Place",
          "name": cityName,
          "containedInPlace": {
            "@type": "State",
            "name": stateName,
            "containedInPlace": {
              "@type": "Country",
              "name": countryName,
            },
          },
        }
      : isStateLevel
      ? {
          "@type": "State",
          "name": stateName,
          "containedInPlace": {
            "@type": "Country",
            "name": countryName,
          },
        }
      : {
          "@type": "Country",
          "name": countryName,
        },
    "itemListElement": detectives.slice(0, 10).map((detective, index) => ({
      "@type": "ListItem",
      "position": index + 1,
      "name": detective.businessName || "Detective Service",
      "url": `https://www.askdetectives.com${getDetectiveProfileUrl(detective)}`,
    })),
  };

  // BreadcrumbList Schema - Essential for site hierarchy recognition
  const breadcrumbListSchema = generateBreadcrumbListSchema(breadcrumbs);

  // FAQ Schema for rich snippets
  const faqSchema = generateFAQPageSchema([
    {
      question: `What is the availability of private investigators in ${cityName}?`,
      answer: `There are currently ${detectives.length} licensed private investigators and detectives available in ${cityName}, ${stateName}. ${verifiedCount} of them are verified professionals. Our network operates 24/7 for emergency and time-sensitive investigations.`
    },
    {
      question: `Which investigation services are offered by detectives in ${cityName}?`,
      answer: `Licensed detectives in ${cityName} offer comprehensive investigation services including: ${topSpecialties.length > 0 ? topSpecialties.join(", ") + "," : ""} background checks, surveillance, asset searches, skip tracing, legal discovery, fraud investigation, infidelity investigations, corporate investigations, and more. All services are confidential and fully licensed.`
    },
    {
      question: `How can I verify if a detective in ${cityName} is licensed and insured?`,
      answer: `${verificationRate}% of detectives in our ${cityName} network are verified with active, government-issued private investigator licenses. Look for the blue verification checkmark badge on detective profiles in ${cityName}. All verified detectives have passed background checks and maintain active state PI licenses.`
    }
  ]);

  // Combine all schemas into an array for rich snippet coverage
  const allSchemas = [
    breadcrumbListSchema,
    searchResultsSchema,
    faqSchema
  ];

  if (error) {
    return (
      <div className="min-h-screen bg-white">
        <SEO 
          title="Location Not Found | Ask Detectives"
          description="The detective location you're looking for was not found."
          robots="noindex, follow"
        />
        <Navbar />
        <main className="container mx-auto px-6 py-12">
          <div className="text-center">
            <h1 className="text-3xl font-bold mb-4">Location Not Found</h1>
            <p className="text-gray-600 mb-8">{error}</p>
            <Button asChild className="bg-blue-600 hover:bg-blue-700">
              <a href="/search">Browse All Detectives</a>
            </Button>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white">
      <SEO 
        title={seoTitle}
        description={seoDescription}
        canonical={canonicalUrl}
        robots="index, follow"
        schema={allSchemas}
        breadcrumbs={breadcrumbs}
        keywords={[
          `detectives in ${cityName}`,
          `private investigators ${stateName}`,
          "detective services",
          "licensed investigators",
          "professional investigation",
          topSpecialties.length > 0 ? topSpecialties[0] : "",
        ].filter(Boolean)}
      />
      <Navbar />
      <main className="container mx-auto px-6 py-8">
        {/* Breadcrumb Navigation */}
        <nav className="mb-8">
          <ol className="flex flex-wrap gap-2 text-sm text-gray-600">
            {breadcrumbs.map((crumb, idx) => (
              <li key={idx} className="flex items-center gap-2">
                {idx > 0 && <span>/</span>}
                {idx === breadcrumbs.length - 1 ? (
                  <span className="text-gray-900 font-medium">{crumb.name}</span>
                ) : (
                  <a href={crumb.url} className="text-blue-600 hover:underline">
                    {crumb.name}
                  </a>
                )}
              </li>
            ))}
          </ol>
        </nav>

        {/* Hero Section */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold mb-2">{h1Text}</h1>
          <p className="text-lg text-gray-600 mb-2">
            Find experienced, licensed private investigators and detective services in {locationLabel}.
          </p>
          <p className="text-sm text-gray-500">
            {loading ? "Loading..." : `${detectives.length} detectives available`}
          </p>
        </div>

        {/* Dynamic City Description Section */}
        {!loading && detectives.length > 0 && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 mb-8">
            <p className="text-gray-700 leading-relaxed">
              {generateCityDescription(cityName, stateName, detectives.length)}
            </p>
          </div>
        )}

        {/* Detectives Grid */}
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-12">
            {[...Array(6)].map((_, i) => (
              <Skeleton key={i} className="h-80 w-full rounded-lg" />
            ))}
          </div>
        ) : detectives.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-12">
            {detectives.map((detective) => {
              const detectiveUrl = getDetectiveProfileUrl(detective);
              
              // Generate initials fallback for logo
              const initials = detective.businessName
                ? detective.businessName
                    .split(" ")
                    .map(word => word[0])
                    .join("")
                    .toUpperCase()
                    .slice(0, 2)
                : "PI";

              // Check for contact info
              const hasPhone = detective.phone || detective.whatsapp;
              const contactButtonText = detective.phone ? "Call Now" : detective.whatsapp ? "Contact" : "Email Now";
              const contactHref = detective.phone 
                ? `tel:${detective.phone}` 
                : detective.whatsapp 
                ? `https://wa.me/${detective.whatsapp}` 
                : detective.contactEmail 
                ? `mailto:${detective.contactEmail}` 
                : "#";

              return (
                <Card 
                  key={detective.id} 
                  className="h-full flex flex-col rounded-xl border border-gray-200 bg-white hover:shadow-xl shadow-md transition-all duration-300 overflow-hidden"
                >
                  <CardContent className="p-5 flex flex-col gap-4 h-full">
                    {/* Logo */}
                    <div className="w-20 h-20 rounded-full overflow-hidden bg-gray-100 border border-gray-200 flex items-center justify-center flex-shrink-0">
                      {detective.logo ? (
                        <img
                          src={detective.logo}
                          alt={detective.businessName || "Detective"}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full bg-gradient-to-br from-green-100 to-green-200 flex items-center justify-center text-sm font-bold text-green-700">
                          {initials}
                        </div>
                      )}
                    </div>

                    {/* Business Name with Badge Icons */}
                    <div className="flex items-center gap-2 flex-wrap">
                      <a 
                        href={detectiveUrl}
                        className="text-lg font-semibold text-gray-900 hover:underline line-clamp-1"
                      >
                        {detective.businessName || "Private Detective Service"}
                      </a>
                      <span className="inline-flex items-center gap-1 ml-1 align-middle">
                        {/* Blue Tick Badge (from isVerified or effectiveBadges.blueTick) */}
                        {(detective.isVerified || detective.effectiveBadges?.blueTick) && (
                          <img src="/blue-tick.png" alt="Verified" className="h-4 w-4 inline-block align-middle" />
                        )}
                        {/* Pro Badge */}
                        {detective.effectiveBadges?.pro && (
                          <img src="/crown.png" alt="Pro" className="h-4 w-4 inline-block align-middle" />
                        )}
                        {/* Recommended Badge */}
                        {detective.effectiveBadges?.recommended && (
                          <span className="text-[10px] bg-green-100 px-1 rounded inline-block">
                            Recommended
                          </span>
                        )}
                      </span>
                    </div>

                    {/* Level */}
                    <span className="text-xs font-bold text-green-600 bg-green-50 px-2 py-1 rounded inline-block w-fit">
                      {detective.level || "1"}
                    </span>

                    {/* Location */}
                    {(detective.city || detective.state) && (
                      <div className="flex items-center gap-2 text-sm text-gray-500">
                        <MapPin className="h-4 w-4 flex-shrink-0" />
                        <span className="line-clamp-1">
                          {[detective.city, detective.state].filter(Boolean).join(", ")}
                        </span>
                      </div>
                    )}

                    {/* About Preview */}
                    {detective.bio && (
                      <p className="text-sm text-gray-600 line-clamp-2">
                        {detective.bio}
                      </p>
                    )}

                    {/* Rating Section */}
                    {detective.avgRating && detective.reviewCount && (
                      <div className="flex items-center gap-3">
                        <div className="flex items-center gap-1">
                          {[...Array(5)].map((_, i) => (
                            <span key={i} className={i < Math.round(detective.avgRating) ? "text-yellow-400" : "text-gray-300"}>
                              ★
                            </span>
                          ))}
                        </div>
                        <span className="text-xs text-gray-500">
                          ({detective.reviewCount} reviews)
                        </span>
                      </div>
                    )}

                    {/* Spacer */}
                    <div className="flex-1" />

                    {/* Buttons Section */}
                    <div className="flex gap-2 pt-4 border-t border-gray-100">
                      {/* Contact Button */}
                      {hasPhone || detective.contactEmail ? (
                        <a
                          href={contactHref}
                          className="flex-1 bg-green-600 hover:bg-green-700 text-white font-medium py-2 px-3 rounded-lg text-sm text-center transition-colors duration-200 flex items-center justify-center gap-2"
                        >
                          {contactButtonText}
                        </a>
                      ) : (
                        <div className="flex-1" />
                      )}

                      {/* View Profile Button */}
                      <a
                        href={detectiveUrl}
                        className="flex-1 border border-green-600 text-green-700 hover:bg-green-50 font-medium py-2 px-3 rounded-lg text-sm text-center transition-colors duration-200 flex items-center justify-center gap-2"
                      >
                        View Profile
                      </a>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        ) : (
          <div className="bg-gray-50 rounded-lg p-8 mb-12 text-center">
            <h2 className="text-xl font-semibold mb-2 text-gray-900">
              No detectives found in {locationLabel} yet
            </h2>
            <p className="text-gray-600 mb-4">
              Browse other locations or search across all detectives.
            </p>
            <div className="flex gap-4 justify-center flex-wrap">
              {stateSlug ? (
                <Button asChild variant="outline">
                  <a href={`/detectives/${countrySlug}/${stateSlug}/`}>
                    Browse {stateName}
                  </a>
                </Button>
              ) : null}
              <Button asChild>
                <a href="/search">Search All Detectives</a>
              </Button>
            </div>
          </div>
        )}

        {/* Related Cities Section */}
        {isCityLevel && detectives.length > 0 && (
          <div className="mt-12 pt-8 border-t border-gray-200">
            <h2 className="text-2xl font-bold mb-6">
              Other Cities in {stateName}
            </h2>
            <p className="text-gray-600 mb-6">
              Find detectives and investigation services in other cities within {stateName}:
            </p>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
              {/* Sample related cities - in production, this would come from API */}
              {["New York City", "Buffalo", "Rochester", "Syracuse", "Albany", "Yonkers", "New Rochelle", "Utica"].map((city, idx) => {
                const citySlugFormat = city.toLowerCase().replace(/\s+/g, "-");
                return (
                  <Button
                    key={idx}
                    asChild
                    variant="outline"
                    className="h-auto py-3 text-center"
                  >
                    <a href={`/detectives/${countrySlug}/${stateSlug}/${citySlugFormat}/`}>
                      {city}
                    </a>
                  </Button>
                );
              })}
            </div>
            <div className="mt-6 text-center">
              <Button asChild variant="ghost">
                <a href={`/detectives/${countrySlug}/${stateSlug}/`}>
                  View all cities in {stateName}
                </a>
              </Button>
            </div>
          </div>
        )}

        {/* FAQ Section with JSON-LD Schema */}
        {!loading && detectives.length > 0 && (
          <>
            <div className="mt-12 pt-8 border-t border-gray-200">
              <h2 className="text-2xl font-bold mb-2">
                Frequently Asked Questions
              </h2>
              <p className="text-gray-600 mb-6">
                Learn more about private detective services in {cityName}, {stateName}
              </p>

              <div className="max-w-2xl mx-auto">
                <FAQItem
                  question={`How many detectives are in ${cityName}?`}
                  answer={`There are currently ${detectives.length} licensed detectives available in ${cityName}, ${stateName} on Ask Detectives. Our network continues to grow with verified professionals offering specialized investigation services. All detectives are screened for credentials and professional standing.`}
                  isOpen={expandedFAQs[0]}
                  setIsOpen={(open) => setExpandedFAQs({ ...expandedFAQs, 0: open })}
                />
                
                <FAQItem
                  question={`What services do detectives in ${cityName} provide?`}
                  answer={`Detectives in ${cityName} specialize in various services including: ${topSpecialties.length > 0 ? topSpecialties.join(", ") + "," : ""} background checks, surveillance, skip tracing, legal discovery, fraud investigation, worker's compensation investigation, and corporate intelligence gathering. All services are confidential and conducted by licensed professionals with years of experience.`}
                  isOpen={expandedFAQs[1]}
                  setIsOpen={(open) => setExpandedFAQs({ ...expandedFAQs, 1: open })}
                />
                
                <FAQItem
                  question={`Are detectives in ${stateName} verified?`}
                  answer={`Yes, ${verificationRate}% of detectives in our ${cityName} network are verified professionals with proper licensing and credentials. We verify all detectives to ensure you're working with trusted, insured, and qualified investigators. Check the blue checkmark icon on each profile to confirm verification status. All verified detectives have passed background checks and maintain professional liability insurance.`}
                  isOpen={expandedFAQs[2]}
                  setIsOpen={(open) => setExpandedFAQs({ ...expandedFAQs, 2: open })}
                />
              </div>

              <div className="mt-8 bg-gray-50 rounded-lg p-6 text-center">
                <p className="text-gray-700 mb-4">
                  Have more questions? Our team is here to help.
                </p>
                <Button asChild className="bg-blue-600 hover:bg-blue-700">
                  <a href="/contact">Contact Us</a>
                </Button>
              </div>
            </div>
          </>
        )}
      </main>
      <Footer />
    </div>
  );
}
