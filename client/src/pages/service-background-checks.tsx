import { useState, useEffect } from "react";
import { useRoute } from "wouter";
import { Navbar } from "@/components/layout/navbar";
import { Footer } from "@/components/layout/footer";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { SEO } from "@/components/seo";
import { Button } from "@/components/ui/button";
import { Star, MapPin, ExternalLink, ChevronDown, ShoppingCart } from "lucide-react";
import { generateBreadcrumbListSchema } from "@/lib/structured-data";
import { DetectiveBadges } from "@/components/detectives/DetectiveBadges";

interface Detective {
  id: string;
  businessName?: string;
  slug?: string;
  logo?: string;
  country?: string;
  state?: string;
  city?: string;
  isVerified?: boolean;
  level?: string;
  phone?: string;
  whatsapp?: string;
  contactEmail?: string;
}

interface Service {
  id: string;
  title: string;
  slug: string;
  category: string;
  description: string;
  basePrice?: number;
  offerPrice?: number;
  isOnEnquiry?: boolean;
  images?: string[];
  avgRating: number;
  reviewCount: number;
  detective: Detective;
}

interface ServiceLocationMeta {
  country: string;
  countryCode?: string;
  state: string;
  city: string;
  category: string;
  total: number;
  found: boolean;
}

// Dynamic content generator for service + location descriptions
const generateServiceLocationDescription = (cityName: string, stateName: string, serviceCount: number): string => {
  const descriptions = [
    `Searching for professional background check services in ${cityName}? Our directory features ${serviceCount} verified agencies across ${stateName} offering comprehensive background screenings. Compare pricing, reviews, and expertise to find the perfect match for your needs.`,
    `Need background check services in ${cityName}, ${stateName}? Connect with experienced professionals offering thorough background verification, criminal history searches, employment screening, and tenant vetting. Find ${serviceCount} trusted providers in your area.`,
    `Browse ${serviceCount} background check service providers in ${cityName} with proven expertise in employment screening, legal compliance, and thorough background investigations. All services available throughout ${stateName} with verified credentials.`,
    `Looking for reliable background check services in ${cityName}? Our network includes ${serviceCount} licensed professionals offering fast turnaround times, accurate reports, and confidential processing for corporate and personal background verification needs.`,
    `Hire professional background check services in ${cityName} from ${serviceCount} certified providers serving ${stateName}. Compare ratings, pricing, and service features to get the most reliable background verification for employment, legal, or personal matters.`,
  ];
  
  // Deterministic selection based on city name hash
  const hash = cityName.split("").reduce((acc, char) => acc + char.charCodeAt(0), 0);
  return descriptions[hash % descriptions.length];
};

// Generate ItemList schema for services
const generateServiceItemListSchema = (services: Service[]): Record<string, any> => {
  return {
    "@context": "https://schema.org",
    "@type": "ItemList",
    "name": "Background Check Services",
    "itemListElement": services.slice(0, 20).map((service, index) => ({
      "@type": "ListItem",
      "position": index + 1,
      "item": {
        "@type": "Service",
        "name": service.title,
        "url": `https://www.askdetectives.com/service/${service.detective.country?.toLowerCase()}/${service.detective.state?.toLowerCase().replace(/\s+/g, '-')}/${service.detective.city?.toLowerCase().replace(/\s+/g, '-')}/${service.detective.slug}/${service.slug}`,
        "description": service.description,
        "image": service.images?.[0] || service.detective.logo || "",
        "price": service.offerPrice || service.basePrice || "Contact",
        "priceCurrency": "INR",
        "provider": {
          "@type": "LocalBusiness",
          "name": service.detective.businessName,
          "logo": service.detective.logo,
          "areaServed": {
            "@type": "Place",
            "name": `${service.detective.city}, ${service.detective.state}`
          }
        },
        "aggregateRating": {
          "@type": "AggregateRating",
          "ratingValue": service.avgRating > 0 ? service.avgRating.toFixed(1) : "0",
          "reviewCount": service.reviewCount
        }
      }
    }))
  };
};

// FAQ items for background checks service
const getBackgroundCheckFAQs = (cityName: string, stateName: string, _detectives: Detective[], serviceCount: number) => [
  {
    question: `What background check services are available in ${cityName}?`,
    answer: `Professional background check services in ${cityName} include criminal history searches, employment screening, tenant verification, civil records checks, database searches, and more. Our network of ${serviceCount} providers offers comprehensive background verification tailored to corporate, legal, and personal needs.`,
  },
  {
    question: `How long does a background check take in ${cityName}?`,
    answer: `Most background check services in ${cityName} offer results within 24-48 hours for standard searches. Comprehensive background checks may take 3-5 business days depending on the scope. All providers in our network maintain strict confidentiality and comply with local regulations.`,
  },
  {
    question: `How much do background check services cost in ${cityName}, ${stateName}?`,
    answer: `Background check service pricing in ${cityName} varies based on scope and package. Basic checks start from ₹500-2,000, while comprehensive reports may range from ₹2,000-10,000+. Compare quotes from our verified providers to get the best rate for your specific requirements.`,
  },
];

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

export default function ServiceBackgroundChecksPage() {
  // Route: /services/background-checks/:country/:state/:city/
  const [match, params] = useRoute("/services/background-checks/:country/:state/:city");
  
  const [services, setServices] = useState<Service[]>([]);
  const [locationMeta, setLocationMeta] = useState<ServiceLocationMeta | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedFAQs, setExpandedFAQs] = useState<{ [key: number]: boolean }>({ 0: false, 1: false, 2: false });

  const countrySlug = params?.country || "";
  const stateSlug = params?.state || "";
  const citySlug = params?.city || "";

  const canonicalPath = `/services/background-checks/${countrySlug}/${stateSlug}/${citySlug}/`;
  const canonicalUrl = `https://www.askdetectives.com${canonicalPath}`;
  const apiPath = `/api/services/background-checks/${[countrySlug, stateSlug, citySlug]
    .filter((segment) => !!segment)
    .map((segment) => encodeURIComponent(segment))
    .join("/")}`;

  useEffect(() => {
    const fetchServicesByLocation = async () => {
      try {
        setLoading(true);
        setError(null);

        // Fetch background check services for this location
        const response = await fetch(apiPath);

        if (!response.ok) {
          if (response.status === 404) {
            setError(`No background check services found in ${[citySlug, stateSlug, countrySlug].filter(Boolean).join(", ")}`);
          } else {
            setError("Failed to load background check services for this location");
          }
          setLoading(false);
          return;
        }

        const data = await response.json();
        setServices(data.services || []);
        setLocationMeta(data.meta);
      } catch (err) {
        console.error("Error fetching services:", err);
        setError("An error occurred while loading services");
      } finally {
        setLoading(false);
      }
    };

    if (!match || !countrySlug || !stateSlug || !citySlug) {
      setError("Invalid location path");
      setLoading(false);
      return;
    }

    fetchServicesByLocation();
  }, [countrySlug, stateSlug, citySlug, apiPath, match]);

  // SEO Metadata
  const cityName = locationMeta?.city || citySlug?.replace(/-/g, " ") || "";
  const stateName = locationMeta?.state || stateSlug?.replace(/-/g, " ") || "";
  const countryName = locationMeta?.country || countrySlug?.replace(/-/g, " ") || "";
  
  // Generate SEO title and description
  const seoTitle = `Background Check Services in ${cityName}, ${stateName} | Verified Detectives`;
  const seoDescription = `Find trusted background check services in ${cityName}, ${stateName}. Compare verified detectives, reviews & contact details. ${services.length} providers available.`;
  const h1Text = `Background Check Services in ${cityName}`;

  // Breadcrumbs for navigation
  const breadcrumbs = [
    { name: "Home", url: "https://www.askdetectives.com/" },
    { name: "Services", url: "https://www.askdetectives.com/services/" },
    { name: "Background Checks", url: "https://www.askdetectives.com/services/background-checks/" },
    { name: countryName, url: `https://www.askdetectives.com/services/background-checks/${countrySlug}/` },
    { name: stateName, url: `https://www.askdetectives.com/services/background-checks/${countrySlug}/${stateSlug}/` },
    { name: cityName, url: canonicalUrl },
  ];

  // FAQ content for this location
  const faqs = getBackgroundCheckFAQs(cityName, stateName, services.map(s => s.detective), services.length);

  // Generate FAQ schema
  const faqSchema = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    "mainEntity": faqs.map(faq => ({
      "@type": "Question",
      "name": faq.question,
      "acceptedAnswer": {
        "@type": "Answer",
        "text": faq.answer
      }
    }))
  };

  // Generate BreadcrumbList schema
  const breadcrumbSchema = generateBreadcrumbListSchema(breadcrumbs);

  // Generate ItemList schema for services
  const itemListSchema = generateServiceItemListSchema(services);

  // Combine all schemas
  const allSchemas = [
    breadcrumbSchema,
    itemListSchema,
    faqSchema
  ];

  // Loading skeleton
  if (loading) {
    return (
      <div className="min-h-screen bg-white">
        <SEO 
          title={seoTitle}
          description={seoDescription}
          canonical={canonicalUrl}
          robots="index, follow"
        />
        <Navbar />
        <main className="container mx-auto px-6 py-8">
          <div className="space-y-6">
            {[1, 2, 3].map((i) => (
              <Card key={i} className="overflow-hidden">
                <CardContent className="p-6">
                  <div className="flex gap-6">
                    <Skeleton className="w-24 h-24 rounded" />
                    <div className="flex-1 space-y-3">
                      <Skeleton className="h-6 w-3/4" />
                      <Skeleton className="h-4 w-full" />
                      <Skeleton className="h-4 w-2/3" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="min-h-screen bg-white">
        <SEO 
          title={`Background Check Services | Ask Detectives`}
          description="Browse background check services from verified detectives."
          canonical={canonicalUrl}
          robots="noindex, follow"
        />
        <Navbar />
        <main className="container mx-auto px-6 md:px-12 lg:px-24 py-12 mt-16">
          <div className="text-center py-12">
            <h1 className="text-3xl font-bold text-gray-900 mb-4">Services Not Found</h1>
            <p className="text-gray-600 mb-8">{error}</p>
            <Button asChild className="bg-blue-600 hover:bg-blue-700">
              <a href="/search">Browse All Services</a>
            </Button>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  // Main content
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
          `background check services in ${cityName}`,
          `background check in ${stateName}`,
          "employment screening",
          "background verification",
          "criminal history search",
          "tenant background check",
        ]}
      />
      <Navbar />
      <main className="container mx-auto px-6 md:px-12 lg:px-24 py-8">
        {/* Breadcrumb Navigation */}
        <nav className="mb-8 text-sm text-gray-600">
          <a href="/" className="hover:text-blue-600">Home</a>
          {breadcrumbs.slice(1, -1).map((crumb, idx) => (
            <span key={idx}>
              <span className="mx-2">/</span>
              <a href={crumb.url} className="hover:text-blue-600">{crumb.name}</a>
            </span>
          ))}
          <span className="mx-2">/</span>
          <span className="text-gray-900">{cityName}</span>
        </nav>

        {/* Page Header */}
        <div className="mb-12">
          <h1 className="text-4xl md:text-5xl font-bold text-gray-900 mb-4">{h1Text}</h1>
          <p className="text-lg text-gray-600 mb-6 max-w-3xl">
            {generateServiceLocationDescription(cityName, stateName, services.length)}
          </p>
          <div className="flex flex-wrap gap-4 items-center">
            <Badge variant="secondary" className="text-base">
              {services.length} Services Available
            </Badge>
            <Badge variant="secondary" className="text-base">
              Background Check Specialists
            </Badge>
          </div>
        </div>

        {/* Explore All Detectives Authority Link */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 mb-12">
          <h2 className="text-xl font-semibold text-gray-900 mb-3">Explore All Detectives in {cityName}</h2>
          <p className="text-gray-700 mb-4">
            Browse all verified private investigators available in {cityName}, {stateName}.
          </p>
          <a
            href={`/detectives/${countrySlug}/${stateSlug}/${citySlug}/`}
            className="inline-flex items-center gap-2 text-blue-600 hover:text-blue-800 font-medium transition-colors"
            aria-label={`View all detectives in ${cityName}, ${stateName}`}
          >
            View All Available Detectives
            <ExternalLink className="h-4 w-4" />
          </a>
        </div>

        {/* Services Grid */}
        <div className="grid gap-6 mb-12">
          {services.map((service) => (
            <Card key={service.id} className="overflow-hidden hover:shadow-lg transition-shadow">
              <CardContent className="p-6">
                <div className="flex flex-col md:flex-row gap-6">
                  {/* Service Image/Logo */}
                  <div className="flex-shrink-0">
                    {service.images?.[0] ? (
                      <img 
                        src={service.images[0]} 
                        alt="Service preview"
                        width={128}
                        height={128}
                        className="w-32 h-32 object-cover rounded-lg"
                      />
                    ) : service.detective.logo ? (
                      <img 
                        src={service.detective.logo}
                        alt="Detective logo"
                        width={128}
                        height={128}
                        className="w-32 h-32 object-cover rounded-lg"
                      />
                    ) : (
                      <div className="w-32 h-32 bg-gray-200 rounded-lg flex items-center justify-center">
                        <ShoppingCart className="h-8 w-8 text-gray-400" />
                      </div>
                    )}
                  </div>

                  {/* Service Details */}
                  <div className="flex-1">
                    <div className="mb-2">
                      <div className="flex items-start justify-between mb-2">
                        <h3 className="text-xl font-bold text-gray-900 flex-1">{service.title}</h3>
                        {service.detective.isVerified && (
                          <Badge className="bg-blue-100 text-blue-800 ml-2">✓ Verified</Badge>
                        )}
                      </div>
                      
                      {/* Detective Name and Location */}
                      <div className="flex items-center gap-1 mb-2">
                        <span className="font-medium">{service.detective.businessName}</span>
                        <DetectiveBadges badgeState={service.badgeState} />
                      </div>
                      <div className="flex items-center text-sm text-gray-600 mb-3">
                        <MapPin className="h-4 w-4 mr-1" />
                        {service.detective.city}, {service.detective.state}
                      </div>
                    </div>

                    {/* Rating */}
                    {service.avgRating > 0 && (
                      <div className="flex items-center mb-3">
                        <div className="flex">
                          {[...Array(5)].map((_, i) => (
                            <Star
                              key={i}
                              className={`h-4 w-4 ${
                                i < Math.floor(service.avgRating) ? 'fill-yellow-400 text-yellow-400' : 'text-gray-300'
                              }`}
                            />
                          ))}
                        </div>
                        <span className="ml-2 text-sm text-gray-600">
                          {service.avgRating.toFixed(1)} ({service.reviewCount} reviews)
                        </span>
                      </div>
                    )}

                    {/* Description */}
                    <p className="text-gray-700 text-sm mb-4 line-clamp-3">
                      {service.description}
                    </p>

                    {/* Pricing and Action */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        {service.basePrice && (
                          <>
                            {service.offerPrice ? (
                              <>
                                <span className="text-xl font-bold text-gray-900">₹{service.offerPrice.toFixed(0)}</span>
                                <span className="text-sm text-gray-500 line-through">₹{service.basePrice.toFixed(0)}</span>
                              </>
                            ) : (
                              <span className="text-xl font-bold text-gray-900">₹{service.basePrice.toFixed(0)}</span>
                            )}
                          </>
                        )}
                        {service.isOnEnquiry && (
                          <Badge variant="outline">On Enquiry</Badge>
                        )}
                      </div>
                      <Button asChild className="bg-blue-600 hover:bg-blue-700">
                        <a href={`/service/${service.detective.country?.toLowerCase()}/${service.detective.state?.toLowerCase().replace(/\s+/g, '-')}/${service.detective.city?.toLowerCase().replace(/\s+/g, '-')}/${service.detective.slug}/${service.slug}`}>
                          View Details
                        </a>
                      </Button>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* FAQ Section */}
        <div className="mb-12">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">Frequently Asked Questions</h2>
          {faqs.map((faq, idx) => (
            <FAQItem
              key={idx}
              question={faq.question}
              answer={faq.answer}
              isOpen={expandedFAQs[idx] || false}
              setIsOpen={(open) =>
                setExpandedFAQs((prev) => ({ ...prev, [idx]: open }))
              }
            />
          ))}
        </div>
      </main>
      <Footer />
    </div>
  );
}
