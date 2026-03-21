import { useState, useEffect, useMemo } from "react";
import { useRoute } from "wouter";
import { Navbar } from "@/components/layout/navbar";
import { Footer } from "@/components/layout/footer";
import { Button } from "@/components/ui/button";
import { SEO } from "@/components/seo";
import { ExternalLink, ChevronDown, SlidersHorizontal, X, Star, ShieldCheck, Zap, Award } from "lucide-react";
import { generateBreadcrumbListSchema } from "@/lib/structured-data";
import { getCountryName } from "@/lib/slug-utils";
import { ServiceCardGrid } from "@/components/common/service-card-grid";
import { ServiceCardSkeleton } from "@/components/home/service-card-skeleton";

// ─── Types ───────────────────────────────────────────────────────────────────

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
  badgeState?: any;
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
  badgeState?: any;
  detective: Detective;
}

interface ServiceLocationMeta {
  country: string;
  countryCode?: string;
  state: string;
  city: string;
  category: string;
  categorySlug?: string;
  total: number;
  found: boolean;
}

// ─── Category Config ──────────────────────────────────────────────────────────

interface CategoryConfig {
  displayName: string;
  pluralName: string;
  dbCategory: string;
  specialist: string;
  descriptions: (city: string, state: string, count: number) => string[];
  faqs: (city: string, state: string, count: number) => Array<{ question: string; answer: string }>;
  keywords: (city: string, state: string) => string[];
}

const CATEGORY_CONFIG: Record<string, CategoryConfig> = {
  "background-checks": {
    displayName: "Background Check",
    pluralName: "Background Check Services",
    dbCategory: "Background Check",
    specialist: "Background Check Specialists",
    descriptions: (city, state, count) => [
      `Searching for professional background check services in ${city}? Our directory features ${count} verified agencies across ${state} offering comprehensive background screenings. Compare pricing, reviews, and expertise to find the perfect match.`,
      `Need background check services in ${city}, ${state}? Connect with experienced professionals offering criminal history searches, employment screening, tenant vetting and more. Find ${count} trusted providers in your area.`,
      `Browse ${count} background check service providers in ${city} with proven expertise in employment screening, legal compliance, and thorough background investigations across ${state}.`,
    ],
    faqs: (city, state, count) => [
      { question: `What background check services are available in ${city}?`, answer: `Professional background check services in ${city} include criminal history searches, employment screening, tenant verification, civil records checks, and more. Our network of ${count} providers offers comprehensive background verification tailored to corporate, legal, and personal needs.` },
      { question: `How long does a background check take in ${city}?`, answer: `Most background check services in ${city} offer results within 24–48 hours for standard searches. Comprehensive checks may take 3–5 business days depending on scope.` },
      { question: `How much do background check services cost in ${city}, ${state}?`, answer: `Background check pricing in ${city} varies by scope. Basic checks start from ₹500–2,000; comprehensive reports range from ₹2,000–10,000+. Compare quotes from our verified providers for the best rate.` },
    ],
    keywords: (city, state) => [`background check services in ${city}`, `background check in ${state}`, "employment screening", "background verification", "criminal history search", "tenant background check"],
  },

  "surveillance": {
    displayName: "Surveillance",
    pluralName: "Surveillance Services",
    dbCategory: "Surveillance",
    specialist: "Surveillance Specialists",
    descriptions: (city, state, count) => [
      `Looking for professional surveillance services in ${city}? Our directory lists ${count} verified surveillance agencies in ${state} offering covert monitoring, evidence gathering, and investigation services.`,
      `Find ${count} trusted surveillance detectives in ${city}, ${state}. Whether for personal, corporate, or legal purposes, our verified investigators use advanced techniques to deliver accurate, court-admissible evidence.`,
      `Compare ${count} surveillance service providers in ${city}. From spousal surveillance to corporate monitoring, our licensed investigators across ${state} offer discreet, professional services.`,
    ],
    faqs: (city, state, count) => [
      { question: `What surveillance services are available in ${city}?`, answer: `Surveillance services in ${city} include spousal/partner surveillance, employee monitoring, corporate surveillance, vehicle tracking, and witness location. Our ${count} verified providers in ${state} use legal, court-admissible methods.` },
      { question: `Is surveillance legal in ${city}, ${state}?`, answer: `Surveillance conducted by licensed private detectives in ${state} is legal when performed within the bounds of local law. Our verified detectives in ${city} operate within all applicable regulations.` },
      { question: `How much does surveillance cost in ${city}?`, answer: `Surveillance services in ${city} are typically charged at hourly rates ranging from ₹1,500–5,000/hour depending on complexity. Contact our verified providers for accurate quotes.` },
    ],
    keywords: (city, state) => [`surveillance services in ${city}`, `private investigator surveillance ${state}`, "covert surveillance", "spousal surveillance", "corporate surveillance", "evidence gathering"],
  },

  "matrimonial-investigation": {
    displayName: "Matrimonial Investigation",
    pluralName: "Matrimonial Investigation Services",
    dbCategory: "Matrimonial Investigation",
    specialist: "Matrimonial Investigation Specialists",
    descriptions: (city, state, count) => [
      `Searching for matrimonial investigation services in ${city}? Our directory features ${count} discreet, verified investigators in ${state} specialising in pre-marriage background checks, spouse verification, and marital investigations.`,
      `Find trusted matrimonial detectives in ${city}, ${state}. With ${count} verified professionals available, get accurate background reports, character verification, and lifestyle checks before or after marriage.`,
      `Browse ${count} matrimonial investigation agencies in ${city}. Our licensed detectives across ${state} provide confidential pre-matrimonial checks, post-marriage surveillance, and character verification.`,
    ],
    faqs: (city, state, count) => [
      { question: `What matrimonial investigation services are available in ${city}?`, answer: `Matrimonial investigation services in ${city} include pre-marriage background checks, spouse character verification, lifestyle investigation, asset verification, and post-marriage surveillance. Our ${count} verified detectives in ${state} maintain strict confidentiality.` },
      { question: `Why should I get a pre-matrimonial investigation in ${city}?`, answer: `A pre-matrimonial investigation in ${city} verifies your prospective partner's background, education, employment history, financial status, and character — giving you peace of mind before a life-changing decision.` },
      { question: `How much does a matrimonial investigation cost in ${city}, ${state}?`, answer: `Matrimonial investigation costs in ${city} typically range from ₹5,000–25,000 depending on the depth of investigation. Contact our verified providers in ${state} for a confidential quote.` },
    ],
    keywords: (city, state) => [`matrimonial investigation in ${city}`, `pre-marriage background check ${state}`, "spouse verification", "matrimonial detective", "pre-matrimonial investigation", "marriage investigation"],
  },

  "corporate-investigation": {
    displayName: "Corporate Investigation",
    pluralName: "Corporate Investigation Services",
    dbCategory: "Corporate Investigation",
    specialist: "Corporate Investigation Specialists",
    descriptions: (city, state, count) => [
      `Looking for corporate investigation services in ${city}? Our directory features ${count} verified corporate investigators in ${state} specialising in fraud detection, employee misconduct, due diligence, and competitive intelligence.`,
      `Find ${count} experienced corporate detectives in ${city}, ${state}. From internal fraud investigations to vendor due diligence and IP theft, our licensed investigators protect your business interests.`,
      `Compare ${count} corporate investigation agencies in ${city}. Our verified professionals across ${state} offer discreet, thorough investigations for businesses of all sizes.`,
    ],
    faqs: (city, state, count) => [
      { question: `What corporate investigation services are available in ${city}?`, answer: `Corporate investigation services in ${city} include employee background checks, fraud investigation, intellectual property theft, vendor due diligence, workplace misconduct investigations, and competitive intelligence. Our ${count} providers in ${state} serve businesses of all sizes.` },
      { question: `How do corporate investigations protect businesses in ${city}?`, answer: `Corporate investigations in ${city} help detect internal fraud, verify vendor integrity, protect trade secrets, gather evidence for litigation, and ensure regulatory compliance — safeguarding your business and reputation.` },
      { question: `How much do corporate investigation services cost in ${city}, ${state}?`, answer: `Corporate investigation costs in ${city} vary by scope and complexity. Projects typically range from ₹15,000–1,00,000+. Our verified investigators in ${state} offer customised quotes based on your specific requirements.` },
    ],
    keywords: (city, state) => [`corporate investigation in ${city}`, `business fraud investigation ${state}`, "due diligence", "employee misconduct", "corporate detective", "fraud investigation"],
  },

  "asset-tracing": {
    displayName: "Asset Tracing",
    pluralName: "Asset Tracing Services",
    dbCategory: "Asset Tracing",
    specialist: "Asset Tracing Specialists",
    descriptions: (city, state, count) => [
      `Looking for asset tracing services in ${city}? Our directory lists ${count} verified asset investigators in ${state} helping individuals, businesses, and legal professionals locate hidden assets, property, and financial accounts.`,
      `Find ${count} expert asset tracing detectives in ${city}, ${state}. Whether for debt recovery, divorce proceedings, or fraud litigation, our licensed investigators locate and document assets accurately.`,
      `Browse ${count} asset tracing agencies in ${city} with expertise in locating hidden properties, bank accounts, vehicles, and business assets. Serving individuals and law firms across ${state}.`,
    ],
    faqs: (city, state, count) => [
      { question: `What asset tracing services are available in ${city}?`, answer: `Asset tracing services in ${city} include locating hidden bank accounts, property searches, vehicle tracing, business asset identification, and overseas asset investigation. Our ${count} verified providers in ${state} work with individuals, law firms, and corporates.` },
      { question: `When do I need asset tracing services in ${city}?`, answer: `Asset tracing in ${city} is commonly used in divorce and matrimonial disputes, debt recovery, fraud litigation, inheritance matters, and pre-litigation due diligence.` },
      { question: `How much does asset tracing cost in ${city}, ${state}?`, answer: `Asset tracing costs in ${city} typically range from ₹10,000–50,000 depending on complexity and jurisdiction. Contact our verified investigators in ${state} for a detailed quote.` },
    ],
    keywords: (city, state) => [`asset tracing in ${city}`, `asset investigation ${state}`, "hidden assets", "property tracing", "debt recovery investigation", "financial investigation"],
  },

  "missing-persons": {
    displayName: "Missing Persons Investigation",
    pluralName: "Missing Persons Investigation Services",
    dbCategory: "Missing Persons Investigation",
    specialist: "Missing Persons Specialists",
    descriptions: (city, state, count) => [
      `Searching for missing persons investigation services in ${city}? Our directory features ${count} verified investigators in ${state} specialising in locating missing individuals, runaways, and estranged family members.`,
      `Find ${count} compassionate missing persons detectives in ${city}, ${state}. Our licensed investigators use professional techniques and extensive databases to locate missing friends, relatives, and individuals.`,
      `Browse ${count} missing persons investigation agencies in ${city}. Our certified detectives across ${state} work swiftly and discreetly to bring families back together.`,
    ],
    faqs: (city, state, count) => [
      { question: `What missing persons services are available in ${city}?`, answer: `Missing persons investigation services in ${city} include locating runaways, tracing estranged family members, finding debtors, and locating witnesses. Our ${count} verified investigators in ${state} use legal databases and field investigation techniques.` },
      { question: `How do I find a missing person in ${city}, ${state}?`, answer: `For missing persons in ${city}, you should file a police report immediately, then hire a licensed private investigator from our verified network in ${state} to conduct a parallel professional investigation — detectives have access to databases and techniques not available to the public.` },
      { question: `How much does a missing persons investigation cost in ${city}?`, answer: `Missing persons investigation costs in ${city} range from ₹8,000–50,000+ depending on the complexity and geographic scope. Contact our verified investigators in ${state} for a compassionate, no-obligation consultation.` },
    ],
    keywords: (city, state) => [`missing persons investigation in ${city}`, `find missing person ${state}`, "locate missing person", "runaway investigation", "missing person detective", "people tracing"],
  },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getDescription(config: CategoryConfig, city: string, state: string, count: number): string {
  const list = config.descriptions(city, state, count);
  const hash = city.split("").reduce((a, c) => a + c.charCodeAt(0), 0);
  return list[hash % list.length];
}

function generateItemListSchema(services: Service[], categoryName: string) {
  return {
    "@context": "https://schema.org",
    "@type": "ItemList",
    "name": categoryName,
    "itemListElement": services.slice(0, 20).map((service, index) => ({
      "@type": "ListItem",
      "position": index + 1,
      "item": {
        "@type": "Service",
        "name": service.title,
        "url": `https://www.askdetectives.com/service/${(service as any).detectiveCountrySlug || (service as any).detectiveCountry?.toLowerCase()}/${(service as any).detectiveStateSlug || (service as any).detectiveState?.toLowerCase().replace(/\s+/g, "-")}/${(service as any).detectiveCitySlug || (service as any).detectiveCity?.toLowerCase().replace(/\s+/g, "-")}/${(service as any).detectiveSlug}/${service.slug}`,
        "description": (service as any).description,
        "image": service.images?.[0] || (service as any).detectiveAvatar || "",
        "price": (service as any).offerPrice || (service as any).basePrice || "Contact",
        "priceCurrency": "INR",
        "provider": {
          "@type": "LocalBusiness",
          "name": (service as any).detectiveBusinessName,
          "logo": (service as any).detectiveAvatar,
          "areaServed": { "@type": "Place", "name": `${(service as any).detectiveCity}, ${(service as any).detectiveState}` },
        },
        "aggregateRating": service.avgRating > 0
          ? { "@type": "AggregateRating", "ratingValue": service.avgRating.toFixed(1), "reviewCount": service.reviewCount }
          : undefined,
      },
    })),
  };
}

// ─── FAQ Item ─────────────────────────────────────────────────────────────────

const FAQItem = ({ question, answer, isOpen, setIsOpen }: { question: string; answer: string; isOpen: boolean; setIsOpen: (v: boolean) => void }) => (
  <div className="border border-gray-200 rounded-lg mb-4">
    <button
      onClick={() => setIsOpen(!isOpen)}
      className="w-full px-6 py-4 text-left font-semibold text-gray-900 hover:bg-gray-50 flex justify-between items-center transition-colors"
    >
      {question}
      <ChevronDown className={`h-5 w-5 transition-transform ${isOpen ? "rotate-180" : ""}`} />
    </button>
    {isOpen && (
      <div className="px-6 py-4 text-gray-700 text-sm bg-gray-50 border-t border-gray-200">{answer}</div>
    )}
  </div>
);

// ─── Generic fallback config for any DB category not in CATEGORY_CONFIG ───────

function buildGenericConfig(displayName: string): CategoryConfig {
  const plural = `${displayName} Services`;
  return {
    displayName,
    pluralName: plural,
    dbCategory: displayName,
    specialist: `${displayName} Specialists`,
    descriptions: (city, state, count) => [
      `Find ${count} verified ${displayName.toLowerCase()} providers in ${city}, ${state}. Browse trusted professionals with reviews and direct contact details.`,
      `Looking for ${displayName.toLowerCase()} in ${city}? Compare ${count} experienced investigators across ${state} offering reliable services.`,
    ],
    faqs: (city, state, count) => [
      { question: `How many ${displayName.toLowerCase()} providers are in ${city}?`, answer: `There are currently ${count} verified ${displayName.toLowerCase()} providers listed in ${city}, ${state} on Ask Detectives.` },
      { question: `How do I hire a ${displayName.toLowerCase()} specialist in ${city}?`, answer: `Browse our directory of ${displayName.toLowerCase()} specialists in ${city}. Compare reviews, pricing, and contact the provider directly.` },
      { question: `Are ${displayName.toLowerCase()} services legal in ${state}?`, answer: `${displayName} services provided by licensed private detectives are legal in ${state}. Always verify your provider's credentials before hiring.` },
    ],
    keywords: (city, state) => [
      `${displayName.toLowerCase()} ${city}`,
      `${displayName.toLowerCase()} ${state}`,
      `${displayName.toLowerCase()} services ${city}`,
      `hire ${displayName.toLowerCase()} ${city}`,
    ],
  };
}

// ─── Filter Sidebar ───────────────────────────────────────────────────────────

interface FilterState {
  minRating: number;
  badges: string[];
  priceType: "all" | "fixed" | "enquiry";
  sortBy: "popular" | "rating" | "reviews";
}

const DEFAULT_FILTERS: FilterState = {
  minRating: 0,
  badges: [],
  priceType: "all",
  sortBy: "popular",
};

function FilterPanel({
  filters,
  onChange,
  totalResults,
  filteredCount,
}: {
  filters: FilterState;
  onChange: (f: FilterState) => void;
  totalResults: number;
  filteredCount: number;
}) {
  const hasActive =
    filters.minRating > 0 ||
    filters.badges.length > 0 ||
    filters.priceType !== "all" ||
    filters.sortBy !== "popular";

  const toggleBadge = (badge: string) => {
    const next = filters.badges.includes(badge)
      ? filters.badges.filter(b => b !== badge)
      : [...filters.badges, badge];
    onChange({ ...filters, badges: next });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <span className="font-semibold text-gray-900 text-sm">
          Filters
          {hasActive && (
            <span className="ml-2 bg-blue-600 text-white text-xs rounded-full px-2 py-0.5">
              {[filters.minRating > 0, filters.badges.length > 0, filters.priceType !== "all"].filter(Boolean).length}
            </span>
          )}
        </span>
        {hasActive && (
          <button
            onClick={() => onChange(DEFAULT_FILTERS)}
            className="text-xs text-blue-600 hover:underline flex items-center gap-1"
          >
            <X className="h-3 w-3" /> Clear all
          </button>
        )}
      </div>

      {/* Results count */}
      <p className="text-xs text-gray-500">
        Showing <span className="font-semibold text-gray-800">{filteredCount}</span> of {totalResults} results
      </p>

      {/* Sort */}
      <div>
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Sort By</p>
        {(["popular", "rating", "reviews"] as const).map(opt => (
          <label key={opt} className="flex items-center gap-2 mb-2 cursor-pointer">
            <input
              type="radio"
              name="sort"
              checked={filters.sortBy === opt}
              onChange={() => onChange({ ...filters, sortBy: opt })}
              className="accent-blue-600"
            />
            <span className="text-sm text-gray-700">
              {opt === "popular" ? "Most Popular" : opt === "rating" ? "Highest Rated" : "Most Reviewed"}
            </span>
          </label>
        ))}
      </div>

      <hr className="border-gray-200" />

      {/* Minimum Rating */}
      <div>
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Minimum Rating</p>
        {[0, 3, 4, 4.5].map(r => (
          <label key={r} className="flex items-center gap-2 mb-2 cursor-pointer">
            <input
              type="radio"
              name="rating"
              checked={filters.minRating === r}
              onChange={() => onChange({ ...filters, minRating: r })}
              className="accent-blue-600"
            />
            <span className="text-sm text-gray-700 flex items-center gap-1">
              {r === 0 ? (
                "Any rating"
              ) : (
                <>
                  <Star className="h-3.5 w-3.5 fill-yellow-400 text-yellow-400" />
                  {r}+ stars
                </>
              )}
            </span>
          </label>
        ))}
      </div>

      <hr className="border-gray-200" />

      {/* Badges */}
      <div>
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Badges</p>
        {[
          { key: "blueTick", label: "Blue Tick Verified", Icon: ShieldCheck, color: "text-blue-600" },
          { key: "pro",      label: "Pro Agency",         Icon: Zap,         color: "text-purple-600" },
          { key: "recommended", label: "Recommended",     Icon: Award,       color: "text-green-600" },
        ].map(({ key, label, Icon, color }) => (
          <label key={key} className="flex items-center gap-2 mb-2 cursor-pointer">
            <input
              type="checkbox"
              checked={filters.badges.includes(key)}
              onChange={() => toggleBadge(key)}
              className="accent-blue-600"
            />
            <Icon className={`h-4 w-4 ${color}`} />
            <span className="text-sm text-gray-700">{label}</span>
          </label>
        ))}
      </div>

      <hr className="border-gray-200" />

      {/* Price Type */}
      <div>
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Pricing</p>
        {(["all", "fixed", "enquiry"] as const).map(opt => (
          <label key={opt} className="flex items-center gap-2 mb-2 cursor-pointer">
            <input
              type="radio"
              name="price"
              checked={filters.priceType === opt}
              onChange={() => onChange({ ...filters, priceType: opt })}
              className="accent-blue-600"
            />
            <span className="text-sm text-gray-700">
              {opt === "all" ? "All" : opt === "fixed" ? "Fixed Price" : "On Enquiry"}
            </span>
          </label>
        ))}
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function ServiceCategoryPage() {
  const [matchCity,    paramsCity]    = useRoute("/locations/:category/:country/:state/:city");
  const [matchState,   paramsState]   = useRoute("/locations/:category/:country/:state");
  const [matchCountry, paramsCountry] = useRoute("/locations/:category/:country");

  const match  = matchCity || matchState || matchCountry;
  const params = paramsCity || paramsState || paramsCountry;

  const categorySlug = params?.category || "";
  const countrySlug  = params?.country  || "";
  const stateSlug    = (paramsCity?.state || paramsState?.state) || "";
  const citySlug     = paramsCity?.city || "";

  const staticConfig = CATEGORY_CONFIG[categorySlug] || null;

  const [services, setServices] = useState<Service[]>([]);
  const [locationMeta, setLocationMeta] = useState<ServiceLocationMeta | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [offset, setOffset] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [expandedFAQs, setExpandedFAQs] = useState<Record<number, boolean>>({ 0: false, 1: false, 2: false });
  const [filters, setFilters] = useState<FilterState>(DEFAULT_FILTERS);
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);

  const apiPath = useMemo(
    () => `/api/services/${encodeURIComponent(categorySlug)}/${[countrySlug, stateSlug, citySlug].filter(Boolean).map(encodeURIComponent).join("/")}`,
    [categorySlug, countrySlug, stateSlug, citySlug]
  );

  const canonicalPath = citySlug
    ? `/locations/${categorySlug}/${countrySlug}/${stateSlug}/${citySlug}/`
    : stateSlug
    ? `/locations/${categorySlug}/${countrySlug}/${stateSlug}/`
    : `/locations/${categorySlug}/${countrySlug}/`;
  const canonicalUrl = `https://www.askdetectives.com${canonicalPath}`;

  useEffect(() => {
    if (!match || !categorySlug || !countrySlug) {
      setError("Invalid service category or location");
      setLoading(false);
      return;
    }

    let cancelled = false;
    const controller = new AbortController();

    const fetch_ = async () => {
      try {
        setLoading(true);
        setError(null);
        setOffset(0);
        const response = await fetch(`${apiPath}?limit=15&offset=0`, { signal: controller.signal });
        if (cancelled) return;
        if (!response.ok) {
          const categoryLabel = staticConfig?.pluralName || categorySlug.replace(/-/g, " ");
          setError(response.status === 404
            ? `No ${categoryLabel.toLowerCase()} found in this location`
            : `Failed to load ${categoryLabel.toLowerCase()} for this location`
          );
          return;
        }
        const data = await response.json();
        setServices(data.services || []);
        setLocationMeta(data.meta);
        setHasMore(data.meta?.hasMore ?? false);
        setOffset(15);
      } catch (err: any) {
        if (err?.name === "AbortError") return;
        setError("An error occurred while loading services");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    fetch_();
    return () => { cancelled = true; controller.abort(); };
  }, [apiPath, match, categorySlug, countrySlug, stateSlug, citySlug]);

  const loadMore = async () => {
    try {
      setLoadingMore(true);
      const response = await fetch(`${apiPath}?limit=15&offset=${offset}`);
      if (!response.ok) return;
      const data = await response.json();
      setServices(prev => [...prev, ...(data.services || [])]);
      setHasMore(data.meta?.hasMore ?? false);
      setOffset(prev => prev + 15);
    } catch {
      // silently fail — user can retry
    } finally {
      setLoadingMore(false);
    }
  };

  // ── Client-side filtering & sorting ─────────────────────────────────────────
  const filteredServices = useMemo(() => {
    let result = services.filter(s => {
      if (filters.minRating > 0 && s.avgRating < filters.minRating) return false;

      const badge = s.badgeState ?? (s.detective as any)?.badgeState;
      if (filters.badges.includes("blueTick") && !badge?.showBlueTick) return false;
      if (filters.badges.includes("pro") && !badge?.showPro) return false;
      if (filters.badges.includes("recommended") && !badge?.showRecommended) return false;

      if (filters.priceType === "fixed" && (s.isOnEnquiry || (!s.basePrice && !s.offerPrice))) return false;
      if (filters.priceType === "enquiry" && !s.isOnEnquiry) return false;

      return true;
    });

    if (filters.sortBy === "rating") {
      result = [...result].sort((a, b) => b.avgRating - a.avgRating);
    } else if (filters.sortBy === "reviews") {
      result = [...result].sort((a, b) => b.reviewCount - a.reviewCount);
    }

    return result;
  }, [services, filters]);

  const cityName    = locationMeta?.city    || citySlug.replace(/-/g, " ");
  const stateName   = locationMeta?.state   || stateSlug.replace(/-/g, " ");
  const countryName = locationMeta?.country || countrySlug.replace(/-/g, " ");

  const locationLabel    = cityName || stateName || countryName;
  const locationSubLabel = cityName ? [cityName, stateName].filter(Boolean).join(", ") : stateName || countryName;

  const config = staticConfig || (locationMeta?.category ? buildGenericConfig(locationMeta.category) : null);

  const dbSeo = (locationMeta as any)?.seo ?? null;

  const _year = new Date().getFullYear();
  const _longTitle  = config ? `Best ${config.pluralName} Detectives Near Me in ${locationSubLabel} - ${_year}` : `Best Detectives Near Me in ${locationSubLabel} - ${_year}`;
  const _shortTitle = config ? `Best ${config.pluralName} Detectives Near Me in ${locationSubLabel}` : `Best Detectives Near Me in ${locationSubLabel}`;
  const seoTitle = dbSeo?.meta_title || (_longTitle.length <= 60 ? _longTitle : _shortTitle);

  const seoDescription = dbSeo?.meta_description || (config
    ? `Find ${services.length}+ verified ${config.displayName.toLowerCase()} detectives near you in ${locationSubLabel}. Read reviews, compare rates & get free quotes today.`
    : `Find ${services.length}+ verified detectives near you in ${locationSubLabel}. Read reviews, compare rates & get free quotes today.`);

  const h1Text = dbSeo?.h1 || (config ? `Best ${config.pluralName} Detectives Near You in ${locationLabel}` : `Best Detectives Near You in ${locationLabel}`);

  const breadcrumbs = config ? [
    { name: "Home",            url: "https://www.askdetectives.com/" },
    { name: "Locations",       url: "https://www.askdetectives.com/locations/" },
    { name: config.pluralName, url: `https://www.askdetectives.com/locations/${categorySlug}/` },
    { name: countryName,       url: `https://www.askdetectives.com/locations/${categorySlug}/${countrySlug}/` },
    ...(stateSlug ? [{ name: stateName, url: `https://www.askdetectives.com/locations/${categorySlug}/${countrySlug}/${stateSlug}/` }] : []),
    ...(citySlug  ? [{ name: cityName,  url: canonicalUrl }] : []),
  ] : [];

  const faqs = config ? config.faqs(locationLabel, stateName || countryName, services.length) : [];
  const keywords = config ? config.keywords(locationLabel, stateName || countryName) : [];

  const allSchemas = config ? [
    generateBreadcrumbListSchema(breadcrumbs),
    generateItemListSchema(services, config.pluralName),
    {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      "mainEntity": faqs.map(faq => ({
        "@type": "Question",
        "name": faq.question,
        "acceptedAnswer": { "@type": "Answer", "text": faq.answer },
      })),
    },
  ] : [];

  if (loading) {
    return (
      <div className="min-h-screen bg-white">
        <SEO title={seoTitle} description={seoDescription} canonical={canonicalUrl} robots="index, follow" />
        <Navbar />
        <main className="container mx-auto px-6 py-8">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3, 4, 5, 6].map(i => <ServiceCardSkeleton key={i} />)}
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  if (!config || error) {
    return (
      <div className="min-h-screen bg-white">
        <SEO title="Services | Ask Detectives" description="Browse detective services." canonical={canonicalUrl} robots="noindex, follow" />
        <Navbar />
        <main className="container mx-auto px-6 py-8">
          <div className="text-center py-12">
            <h1 className="text-3xl font-bold text-gray-900 mb-4">Services Not Found</h1>
            <p className="text-gray-600 mb-8">{error || "This service category is not available."}</p>
            <Button asChild className="bg-blue-600 hover:bg-blue-700">
              <a href="/search">Browse All Services</a>
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
        keywords={keywords}
      />
      <Navbar />
      <main className="container mx-auto px-6 py-8">
        {/* Breadcrumb */}
        <nav className="mb-8">
          <ol className="flex flex-wrap gap-2 text-sm text-gray-600">
            {breadcrumbs.map((crumb, idx) => (
              <li key={idx} className="flex items-center gap-2">
                {idx > 0 && <span>/</span>}
                {idx === breadcrumbs.length - 1 ? (
                  <span className="text-gray-900 font-medium">{crumb.name}</span>
                ) : (
                  <a href={crumb.url} className="text-blue-600 hover:underline">{crumb.name}</a>
                )}
              </li>
            ))}
          </ol>
        </nav>

        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold mb-2">{h1Text}</h1>
          <p className="text-lg text-gray-600 mb-2">
            {getDescription(config, locationLabel, stateName || countryName, services.length)}
          </p>
          <p className="text-sm text-gray-500">{services.length} services available</p>
        </div>

        {/* Mobile filter toggle */}
        <div className="lg:hidden mb-4">
          <button
            onClick={() => setMobileFiltersOpen(v => !v)}
            className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
          >
            <SlidersHorizontal className="h-4 w-4" />
            Filters &amp; Sort
            {(filters.minRating > 0 || filters.badges.length > 0 || filters.priceType !== "all") && (
              <span className="bg-blue-600 text-white text-xs rounded-full px-1.5 py-0.5">
                {[filters.minRating > 0, filters.badges.length > 0, filters.priceType !== "all"].filter(Boolean).length}
              </span>
            )}
          </button>

          {mobileFiltersOpen && (
            <div className="mt-3 p-4 border border-gray-200 rounded-xl bg-white shadow-md">
              <FilterPanel
                filters={filters}
                onChange={setFilters}
                totalResults={services.length}
                filteredCount={filteredServices.length}
              />
            </div>
          )}
        </div>

        {/* Main: sidebar + grid */}
        <div className="flex gap-8 mb-12">
          {/* Desktop sidebar */}
          <aside className="hidden lg:block w-56 flex-shrink-0">
            <div className="sticky top-24 border border-gray-200 rounded-xl p-5 bg-white shadow-sm">
              <FilterPanel
                filters={filters}
                onChange={setFilters}
                totalResults={services.length}
                filteredCount={filteredServices.length}
              />
            </div>
          </aside>

          {/* Service grid */}
          <div className="flex-1 min-w-0">
            {filteredServices.length === 0 && services.length > 0 ? (
              <div className="text-center py-16">
                <p className="text-gray-500 mb-4">No services match your current filters.</p>
                <button
                  onClick={() => setFilters(DEFAULT_FILTERS)}
                  className="text-blue-600 hover:underline text-sm"
                >
                  Clear all filters
                </button>
              </div>
            ) : (
              <ServiceCardGrid
                isLoading={false}
                emptyMessage={`No ${config.pluralName.toLowerCase()} found in this location yet.`}
                services={filteredServices as any[]}
              />
            )}

            {hasMore && (
              <div className="flex justify-center mt-8">
                <Button
                  onClick={loadMore}
                  disabled={loadingMore}
                  variant="outline"
                  className="px-8"
                >
                  {loadingMore ? "Loading..." : "Load More"}
                </Button>
              </div>
            )}
          </div>
        </div>

        {/* Authority link */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 mb-8">
          <h2 className="text-lg font-semibold text-gray-900 mb-2">Explore All Detectives in {locationLabel}</h2>
          <p className="text-gray-700 mb-2">
            Browse all verified private investigators available in {locationSubLabel}.
          </p>
          <a
            href={`/detectives/${[countrySlug, stateSlug, citySlug].filter(Boolean).join("/")}/`}
            className="inline-flex items-center gap-2 text-blue-600 hover:text-blue-800 font-medium transition-colors"
          >
            View All Available Detectives
            <ExternalLink className="h-4 w-4" />
          </a>
        </div>

        {/* FAQ Section */}
        {faqs.length > 0 && (
          <div className="mb-12">
            <h2 className="text-2xl font-bold text-gray-900 mb-6">
              Frequently Asked Questions — {config.pluralName} in {locationLabel}
            </h2>
            {faqs.map((faq, idx) => (
              <FAQItem
                key={idx}
                question={faq.question}
                answer={faq.answer}
                isOpen={!!expandedFAQs[idx]}
                setIsOpen={v => setExpandedFAQs(prev => ({ ...prev, [idx]: v }))}
              />
            ))}
          </div>
        )}
      </main>
      <Footer />
    </div>
  );
}
