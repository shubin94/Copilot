import { useState, useEffect, useMemo } from "react";
import { useRoute } from "wouter";
import { Link } from "wouter";
import { Navbar } from "@/components/layout/navbar";
import { Footer } from "@/components/layout/footer";
import { Skeleton } from "@/components/ui/skeleton";
import { SEO } from "@/components/seo";
import { Button } from "@/components/ui/button";
import { ChevronDown } from "lucide-react";
import { DetectiveCard } from "@/components/DetectiveCard";
import { generateBreadcrumbListSchema, generateFAQPageSchema } from "@/lib/structured-data";
import { getDetectiveProfileUrl } from "@/lib/utils";
import { LocationContent } from "../components/LocationContent";
import { CityFAQ } from "../components/CityFAQ";

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
  avgRating?: number;
  reviewCount?: number;
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
  relatedType?: "states" | "cities";
  relatedLocations?: Array<{ slug: string; name: string }>;
  seoMetadata?: {
    metaTitle: string | null;
    metaDescription: string | null;
    h1: string | null;
  };
}

let initialHydrationCityPageData: CityPageData | null = typeof window !== "undefined"
  ? (((window as any).__CITY_PAGE_DATA__ as CityPageData | undefined) ?? null)
  : null;
let initialHydrationSeoData: { title?: string; description?: string; h1?: string } | null = typeof window !== "undefined"
  ? (((window as any).__SEO_DATA__ as { title?: string; description?: string; h1?: string } | undefined) ?? null)
  : null;
let initialHydrationOffset = typeof window !== "undefined"
  ? Number(new URLSearchParams(window.location.search).get("offset") || 0)
  : 0;

const consumeInitialCityPageData = () => {
  const data = initialHydrationCityPageData;
  initialHydrationCityPageData = null;
  return data;
};

const consumeInitialSeoData = () => {
  const data = initialHydrationSeoData;
  initialHydrationSeoData = null;
  return data;
};

const consumeInitialOffset = () => {
  const offset = initialHydrationOffset;
  initialHydrationOffset = 0;
  return offset;
};

interface RelatedLocation {
  name: string;
  slug: string;
  detectiveCount?: number;
}

// Dynamic content generator for unique location descriptions
const generateLocationDescription = (locationDisplayName: string, detectiveCount: number): string => {
  // 15 unique variants grouped by detective count to reduce thin/duplicate content
  // Each varies: sentence structure, terminology (PI/investigator/detective/agency), CTA phrasing
  const hash = locationDisplayName.split("").reduce((acc, char) => acc + char.charCodeAt(0), 0);

  if (detectiveCount <= 9) {
    // Small directory — emphasise quality, curation, and specialisation
    const variants = [
      `Looking for a reliable private investigator in ${locationDisplayName}? Ask Detectives lists ${detectiveCount} carefully curated detectives, each verified for credentials and professionalism. Find the right specialist for your case — background checks, surveillance, matrimonial, or corporate investigations.`,
      `${locationDisplayName} has a select group of ${detectiveCount} licensed private investigators listed on Ask Detectives. While the directory is focused, every listed detective has been vetted for credentials and client satisfaction. Quality over quantity — find the right PI for your needs.`,
      `Need a discreet private detective in ${locationDisplayName}? Ask Detectives features ${detectiveCount} verified investigators serving this area. Each professional has been reviewed for licencing and case expertise, ensuring you connect with a trusted specialist for your investigation.`,
      `Ask Detectives connects you with ${detectiveCount} verified private investigation professionals in ${locationDisplayName}. Whether your case involves fraud, missing persons, background verification, or matrimonial checks — browse profiles, read reviews, and hire with confidence.`,
      `Finding the right detective agency in ${locationDisplayName} starts here. Ask Detectives lists ${detectiveCount} licensed private investigators with verified credentials. Compare their specialisations and client ratings to choose the best fit for your case.`,
    ];
    return variants[hash % variants.length];
  } else if (detectiveCount <= 49) {
    // Growing directory — emphasise variety, range of specialisations
    const variants = [
      `Browse ${detectiveCount} experienced private detectives in ${locationDisplayName} on Ask Detectives. From background checks and surveillance to corporate fraud and matrimonial investigations, our growing directory covers a wide range of specialisations. Compare profiles, ratings, and fees to hire the right professional.`,
      `Ask Detectives lists ${detectiveCount} verified private investigators across ${locationDisplayName}, covering personal, legal, and corporate investigation services. Filter by specialisation, check client reviews, and contact detectives directly — all in one place.`,
      `With ${detectiveCount} licensed investigation agencies and solo PIs listed in ${locationDisplayName}, Ask Detectives makes it easy to find the right match for your case. Browse specialisations from asset tracing to employee screening, and compare reviews before reaching out.`,
      `${locationDisplayName}'s private investigation community is well-represented on Ask Detectives, with ${detectiveCount} verified professionals ready to assist. Whether you need urgent surveillance, a corporate due diligence report, or a background check — find an expert who fits your timeline and budget.`,
      `Searching for a trustworthy investigator in ${locationDisplayName}? Ask Detectives features ${detectiveCount} licensed PIs with verified credentials and real client reviews. Our directory covers a diverse range of case types, helping you match your specific investigation needs to the right professional.`,
    ];
    return variants[hash % variants.length];
  } else {
    // Large directory — emphasise comprehensive coverage, comparison, and platform authority
    const variants = [
      `Ask Detectives is ${locationDisplayName}'s most comprehensive directory of private investigators, listing ${detectiveCount} verified professionals. Compare ratings, specialisations, and pricing across top detective agencies and independent PIs — then connect directly with the right investigator for your case.`,
      `With ${detectiveCount} licensed private investigators listed in ${locationDisplayName}, Ask Detectives gives you the widest choice of verified investigation professionals in the area. Filter by service type, read verified reviews, and hire with confidence knowing every listed detective has been checked.`,
      `${locationDisplayName} has a thriving community of private investigation professionals. Ask Detectives lists ${detectiveCount} verified detectives — from large agencies to specialist solo investigators — covering every case type from surveillance and background checks to corporate forensics and missing persons.`,
      `Hire a top-rated private detective in ${locationDisplayName} from a pool of ${detectiveCount} verified professionals on Ask Detectives. Our platform makes it easy to compare experience, case specialisations, client ratings, and fees before committing — giving you full confidence in your hiring decision.`,
      `Ask Detectives offers the most complete listing of private investigation services in ${locationDisplayName}, with ${detectiveCount} verified investigators available. Whether you're an individual, a legal firm, or a business, find a specialist detective matching your exact requirements and budget.`,
    ];
    return variants[hash % variants.length];
  }
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

// Format detective count for display
const formatDetectiveCount = (count: number): string => {
  if (count === 1) return "1 Detective";
  return `${count} Detectives`;
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
  const [, paramsCountry] = useRoute("/detectives/:country");
  
  // Use the matched route params
  const matchedParams = match ? params : (matchState ? paramsState : paramsCountry);
  const [ssrData] = useState<CityPageData | null>(() => consumeInitialCityPageData());
  const [detectives, setDetectives] = useState<Detective[]>(() => ssrData?.detectives || []);
  const [currentOffset, setCurrentOffset] = useState<number>(() => ssrData?.detectives?.length || 0);
  const [totalCount, setTotalCount] = useState<number>(() => ssrData?.count || ssrData?.detectives?.length || 0);
  const [locationMeta, setLocationMeta] = useState<LocationMeta | null>(() => ssrData ? {
    country: ssrData.location.country,
    state: ssrData.location.state,
    city: ssrData.location.city,
  } : null);
  const [relatedLocations, setRelatedLocations] = useState<RelatedLocation[]>(() => Array.isArray(ssrData?.relatedLocations) ? ssrData.relatedLocations : []);
  const [seoMetadata, setSeoMetadata] = useState<{ metaTitle: string | null; metaDescription: string | null; h1: string | null } | null>(() => ssrData?.seoMetadata || null);
  const [clientSeoData, setClientSeoData] = useState<{ title?: string; description?: string; h1?: string } | null>(() => consumeInitialSeoData());
  const [loading, setLoading] = useState(() => !ssrData);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedFAQs, setExpandedFAQs] = useState<{ [key: number]: boolean }>({ 0: false, 1: false, 2: false });
  const [currentOffsetValue, setCurrentOffsetValue] = useState(() => consumeInitialOffset());
  const [topLocations, setTopLocations] = useState<Array<{ name: string; slug: string; countrySlug?: string; stateSlug?: string; detectiveCount: number }>>([]);
  const [topLocationsLoading, setTopLocationsLoading] = useState(false);

  const countrySlug = matchedParams?.country || "";
  const stateSlug = (matchedParams as any)?.state || "";
  const citySlug = (matchedParams as any)?.city || "";
  const isCountryLevel = !!countrySlug && !stateSlug;
  const isStateLevel = !!countrySlug && !!stateSlug && !citySlug;
  const isCityLevel = !!countrySlug && !!stateSlug && !!citySlug;

  const canonicalPath = isCityLevel
    ? `/detectives/${countrySlug}/${stateSlug}/${citySlug}/`
    : isStateLevel
    ? `/detectives/${countrySlug}/${stateSlug}/`
    : `/detectives/${countrySlug}/`;
  const canonicalUrl = `https://www.askdetectives.com${canonicalPath}`;
  const locationApiPath = useMemo(
    () =>
      `/api/detectives/location/${[countrySlug, stateSlug, citySlug]
        .filter((segment) => !!segment)
        .map((segment) => encodeURIComponent(segment))
        .join("/")}`,
    [countrySlug, stateSlug, citySlug]
  );

  useEffect(() => {
    if (ssrData) {
      return;
    }

    const fetchLocationDetectives = async () => {
      // Create AbortController for request timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000); // 25s timeout (backend has 20s internal timeout)
      
      try {
        setLoading(true);
        setError(null);

        const response = await fetch(`${locationApiPath}?limit=15&offset=0`, {
          signal: controller.signal,
          credentials: "include",
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          if (response.status === 404) {
            setError(`Location not found: ${[citySlug, stateSlug, countrySlug].filter(Boolean).join(", ")}`);
          } else if (response.status === 504) {
            setError("Request timed out. The location has too many detectives to load quickly. Please try again.");
          } else {
            setError("Failed to load detectives for this location");
          }
          setLoading(false);
          return;
        }

        const data = await response.json();
        const nextDetectives = Array.isArray(data?.detectives) ? data.detectives : [];
        setDetectives(nextDetectives);
        setCurrentOffset(nextDetectives.length);
        setTotalCount(typeof data.total === "number" ? data.total : nextDetectives.length);
        setLocationMeta(data.meta);
        setRelatedLocations(Array.isArray(data.relatedLocations) ? data.relatedLocations : []);
        setSeoMetadata(data.seoMetadata || null);
      } catch (err) {
        clearTimeout(timeoutId);
        console.error("Error fetching location detectives:", err);
        if (err instanceof Error && err.name === 'AbortError') {
          setError("Request timed out. Please try again.");
        } else {
          setError("An error occurred while loading detectives");
        }
      } finally {
        setLoading(false);
      }
    };

    if (countrySlug) {
      fetchLocationDetectives();
    }
  }, [countrySlug, stateSlug, citySlug, ssrData]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const searchParams = new URLSearchParams(window.location.search);
    setCurrentOffsetValue(Number(searchParams.get("offset") || 0));
  }, []);

  // Fetch contextual top locations based on page level
  useEffect(() => {
    const fetchTopLocations = async () => {
      if (loading || !countrySlug) return;

      try {
        setTopLocationsLoading(true);
        let endpoint = "";
        
        if (isCityLevel) {
          // City page: fetch other cities in the same state
          endpoint = `/api/locations/other-cities/${encodeURIComponent(countrySlug)}/${encodeURIComponent(stateSlug)}/${encodeURIComponent(citySlug)}?limit=9`;
        } else if (isStateLevel) {
          // State page: fetch top cities in the state
          endpoint = `/api/locations/top-cities/${encodeURIComponent(countrySlug)}/${encodeURIComponent(stateSlug)}?limit=9`;
        } else if (isCountryLevel) {
          // Country page: fetch top states in the country
          endpoint = `/api/locations/top-states/${encodeURIComponent(countrySlug)}?limit=9`;
        }

        if (endpoint) {
          const response = await fetch(endpoint, { credentials: "include" });
          if (response.ok) {
            const data = await response.json();
            
            if (isCityLevel || isStateLevel) {
              setTopLocations(data.cities || []);
            } else {
              setTopLocations(data.states || []);
            }
          }
        }
      } catch (err) {
        console.error("Error fetching top locations:", err);
      } finally {
        setTopLocationsLoading(false);
      }
    };

    fetchTopLocations();
  }, [loading, countrySlug, stateSlug, citySlug, isCountryLevel, isStateLevel, isCityLevel]);

  const handleLoadMore = async () => {
    if (loadingMore || currentOffset >= totalCount) {
      return;
    }

    // Create AbortController for request timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000); // 25s timeout

    try {
      setLoadingMore(true);
      const response = await fetch(`${locationApiPath}?limit=15&offset=${currentOffset}`, {
        signal: controller.signal,
        credentials: "include",
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        if (response.status === 504) {
          throw new Error("Request timed out. Please try again.");
        }
        throw new Error("Failed to load more detectives");
      }

      const data = await response.json();
      const newDetectives: Detective[] = Array.isArray(data?.detectives) ? data.detectives : [];

      setDetectives((prev) => [...prev, ...newDetectives]);
      setCurrentOffset((prev) => prev + newDetectives.length);
      setTotalCount(typeof data.total === "number" ? data.total : totalCount);
    } catch (err) {
      clearTimeout(timeoutId);
      console.error("Error loading more detectives:", err);
    } finally {
      setLoadingMore(false);
    }
  };

  // SEO Metadata - Ensure non-empty fallbacks
  const cityName = locationMeta?.city || (citySlug ? citySlug.replace(/-/g, " ").replace(/\b\w/g, (l: string) => l.toUpperCase()) : "");
  const stateName = locationMeta?.state || (stateSlug ? stateSlug.replace(/-/g, " ").replace(/\b\w/g, (l: string) => l.toUpperCase()) : "");
  const countryName = locationMeta?.country || (countrySlug ? countrySlug.replace(/-/g, " ").replace(/\b\w/g, (l: string) => l.toUpperCase()) : "India");
  
  const locationLabel = isCityLevel && cityName && stateName
    ? `${cityName}, ${stateName}`
    : isStateLevel && stateName && countryName
    ? `${stateName}, ${countryName}`
    : countryName || "India";
    
  const locationDisplayName = isCityLevel && cityName && stateName && countryName
    ? `${cityName}, ${stateName}, ${countryName}`
    : isStateLevel && stateName && countryName
    ? `${stateName}, ${countryName}`
    : countryName || "India";
  
  // Enhanced SEO Title and Description with current year - Always have fallbacks
  const currentYear = new Date().getUTCFullYear();
  const defaultSeoTitle = isCityLevel && cityName && stateName
    ? `Top 10 Best Private Detectives in ${cityName}, ${stateName} (${currentYear})`
    : isStateLevel && stateName && countryName
    ? `Top Private Detectives in ${stateName}, ${countryName} (${currentYear})`
    : `Top Private Detectives in ${countryName || "India"} (${currentYear})`;
    
  const defaultSeoDescription = `Browse trusted detective agencies in ${locationLabel}. Compare ratings, services, and contact vetted professionals today.${detectives.length > 0 ? ` ${detectives.length} licensed detectives available.` : ''}`;
  
  const defaultH1Text = isCityLevel && cityName && stateName && countryName
    ? `Best Private Detectives in ${cityName}, ${stateName}, ${countryName}`
    : isStateLevel && stateName && countryName
    ? `Best Private Detectives in ${stateName}, ${countryName}`
    : `Best Private Detectives in ${countryName || "India"}`;

  // Read SEO data from server-injected script (SSR with database overrides)
  // SEO Title priority: SSR data > API override > default
  const seoTitle = clientSeoData?.title && clientSeoData.title.trim() !== ""
    ? clientSeoData.title
    : (seoMetadata?.metaTitle && seoMetadata.metaTitle.trim() !== "") 
    ? seoMetadata.metaTitle 
    : defaultSeoTitle;
  
  // SEO Description priority: SSR data > API override > default
  const seoDescription = clientSeoData?.description && clientSeoData.description.trim() !== ""
    ? clientSeoData.description
    : (seoMetadata?.metaDescription && seoMetadata.metaDescription.trim() !== "") 
    ? seoMetadata.metaDescription 
    : defaultSeoDescription;
  
  // H1 priority: SSR data > API override > default
  const h1Text = clientSeoData?.h1 && clientSeoData.h1.trim() !== ""
    ? clientSeoData.h1
    : (seoMetadata?.h1 && seoMetadata.h1.trim() !== "") 
    ? seoMetadata.h1 
    : defaultH1Text;

  const relatedHeading = isCountryLevel
    ? `Other States in ${countryName}`
    : `Other Cities in ${stateName}`;

  const relatedDescription = isCountryLevel
    ? `Find detectives and investigation services in other states within ${countryName}:`
    : `Find detectives and investigation services in other cities within ${stateName}:`;

  const relatedViewAllLabel = isCountryLevel
    ? `View all states in ${countryName}`
    : `View all cities in ${stateName}`;

  const relatedViewAllHref = isCountryLevel
    ? `/detectives/${countrySlug}/`
    : `/detectives/${countrySlug}/${stateSlug}/`;

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
      question: `What is the availability of private investigators in ${locationDisplayName}?`,
      answer: `There are currently ${detectives.length} licensed private investigators and detectives available in ${locationDisplayName}. ${verifiedCount} of them are verified professionals. Our network operates 24/7 for emergency and time-sensitive investigations.`
    },
    {
      question: `Which investigation services are offered by detectives in ${locationDisplayName}?`,
      answer: `Licensed detectives in ${locationDisplayName} offer comprehensive investigation services including: ${topSpecialties.length > 0 ? topSpecialties.join(", ") + "," : ""} background checks, surveillance, asset searches, skip tracing, legal discovery, fraud investigation, infidelity investigations, corporate investigations, and more. All services are confidential and fully licensed.`
    },
    {
      question: `How can I verify if a detective in ${locationDisplayName} is licensed and insured?`,
      answer: `${verificationRate}% of detectives in our ${locationDisplayName} network are verified with active, government-issued private investigator licenses. Look for the blue verification checkmark badge on detective profiles in ${locationDisplayName}. All verified detectives have passed background checks and maintain active state PI licenses.`
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

  // Calculate pagination links for SEO
  const pageSize = 15;

  const pagination = {
    prevUrl: currentOffsetValue > 0
      ? `${canonicalPath}?offset=${Math.max(0, currentOffsetValue - pageSize)}`
      : undefined,
    nextUrl: currentOffsetValue + pageSize < totalCount
      ? `${canonicalPath}?offset=${currentOffsetValue + pageSize}`
      : undefined
  };

  return (
    <div className="min-h-screen bg-white">
      <SEO 
        title={seoTitle}
        description={seoDescription}
        canonical={canonicalUrl}
        robots="index, follow"
        schema={allSchemas}
        breadcrumbs={breadcrumbs}
        pagination={pagination}
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
          {(isCityLevel || isStateLevel) && (
            <div className="text-sm text-gray-600 mb-2">
              <a href={`/detectives/${countrySlug}/`} className="text-blue-600 hover:underline">
                {countryName}
              </a>
              {isCityLevel && (
                <>
                  <span className="mx-2">›</span>
                  <a href={`/detectives/${countrySlug}/${stateSlug}/`} className="text-blue-600 hover:underline">
                    {stateName}
                  </a>
                </>
              )}
            </div>
          )}
          <h1 className="text-4xl font-bold mb-2">{h1Text}</h1>
          <p className="text-lg text-gray-600 mb-2">
            Find experienced, licensed private investigators and detective services in {locationDisplayName}.
          </p>
          <p className="text-sm text-gray-500">
            {loading ? "Loading..." : `${detectives.length} detectives available`}
          </p>
        </div>

        {/* Dynamic City Description Section */}
        {!loading && detectives.length > 0 && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 mb-8">
            <p className="text-gray-700 leading-relaxed">
              {generateLocationDescription(locationDisplayName, detectives.length)}
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
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
              {detectives.map((d, i) => (
                <DetectiveCard key={d.id} detective={d} isPriority={i === 0} />
              ))}
            </div>
            {detectives.length < totalCount && (
              <div className="mb-12 text-center">
                <Button onClick={handleLoadMore} disabled={loadingMore}>
                  {loadingMore ? "Loading..." : "Load More"}
                </Button>
              </div>
            )}
          </>
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

        {/* Top Locations Section - Contextual internal linking */}
        {!loading && detectives.length > 0 && topLocations.length > 0 && (
          <div className="mt-12 pt-8 border-t border-gray-200">
            <h2 className="text-2xl font-bold mb-6">
              {isCountryLevel && `Top States in ${countryName}`}
              {isStateLevel && `Top Cities in ${stateName}`}
              {isCityLevel && `Other Cities in ${stateName}`}
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {topLocations.map((location, idx) => {
                const locationHref = isCountryLevel
                  ? `/detectives/${countrySlug}/${location.slug}/`
                  : `/detectives/${countrySlug}/${stateSlug}/${location.slug}/`;

                return (
                  <Link key={idx} href={locationHref}>
                    <div className="block rounded-lg border border-green-100 bg-green-50 px-4 py-3 transition-colors hover:bg-green-100 cursor-pointer">
                      <div className="text-sm font-semibold text-green-900">
                        {location.name}
                      </div>
                      <div className="text-xs text-green-700">
                        {formatDetectiveCount(location.detectiveCount)}
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        )}

        {/* Related Locations Section */}
        {relatedLocations.length > 0 && (
          <div className="mt-12 pt-8 border-t border-gray-200">
            <h2 className="text-2xl font-bold mb-6">
              {relatedHeading}
            </h2>
            <p className="text-gray-600 mb-6">
              {relatedDescription}
            </p>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
              {relatedLocations.map((location, idx) => {
                const locationHref = isCountryLevel
                  ? `/detectives/${countrySlug}/${location.slug}/`
                  : `/detectives/${countrySlug}/${stateSlug}/${location.slug}/`;

                return (
                  <Button
                    key={idx}
                    asChild
                    variant="outline"
                    className="h-auto py-3 text-center"
                  >
                    <a href={locationHref}>
                      {location.name}
                    </a>
                  </Button>
                );
              })}
            </div>
            <div className="mt-6 text-center">
              <Button asChild variant="ghost">
                <a href={relatedViewAllHref}>
                  {relatedViewAllLabel}
                </a>
              </Button>
            </div>
          </div>
        )}

        {/* FAQ Section with JSON-LD Schema */}
        {!loading && detectives.length > 0 && (
          <>
            <div className="mt-12 pt-8 border-t border-gray-200">
              <div className="max-w-2xl mx-auto">
                <h2 className="text-2xl font-bold mb-2">
                  Frequently Asked Questions
                </h2>
                <p className="text-gray-600 mb-6">
                  Learn more about private detective services in {locationDisplayName}
                </p>

                <FAQItem
                  question={`How many detectives are in ${locationDisplayName}?`}
                  answer={`There are currently ${detectives.length} licensed detectives available in ${locationDisplayName} on Ask Detectives. Our network continues to grow with verified professionals offering specialized investigation services. All detectives are screened for credentials and professional standing.`}
                  isOpen={expandedFAQs[0]}
                  setIsOpen={(open) => setExpandedFAQs({ ...expandedFAQs, 0: open })}
                />

                <FAQItem
                  question={`What services do detectives in ${locationDisplayName} provide?`}
                  answer={`Detectives in ${locationDisplayName} specialize in various services including: ${topSpecialties.length > 0 ? topSpecialties.join(", ") + "," : ""} background checks, surveillance, skip tracing, legal discovery, fraud investigation, worker's compensation investigation, and corporate intelligence gathering. All services are confidential and conducted by licensed professionals with years of experience.`}
                  isOpen={expandedFAQs[1]}
                  setIsOpen={(open) => setExpandedFAQs({ ...expandedFAQs, 1: open })}
                />

                <FAQItem
                  question={`Are detectives in ${locationDisplayName} verified?`}
                  answer={`Yes, ${verificationRate}% of detectives in our ${locationDisplayName} network are verified professionals with proper licensing and credentials. We verify all detectives to ensure you're working with trusted, insured, and qualified investigators. Check the blue checkmark icon on each profile to confirm verification status. All verified detectives have passed background checks and maintain professional liability insurance.`}
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
