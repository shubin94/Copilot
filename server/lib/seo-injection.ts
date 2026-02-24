/**
 * Server-Side SEO Meta Tag Injection
 * 
 * Intercepts requests to detective profile pages and injects:
 * - Dynamic title
 * - Meta descriptions
 * - Open Graph tags
 * - Twitter Card tags
 * - JSON-LD structured data (LocalBusiness schema)
 */

import { db, pool } from "../../db/index.ts";
import { detectives, reviews, services, subscriptionPlans, countries, states, cities } from "../../shared/schema.ts";
import { eq, and, isNotNull, sql, or } from "drizzle-orm";
import { avg, count } from "drizzle-orm";
import { computeEffectiveBadges } from "../services/entitlements.ts";

export async function getDetectiveBySlugForSEO(
  country: string,
  state: string,
  city: string,
  slug: string
): Promise<any | null> {
  try {
    // Generate slugs from input (same logic as server/routes.ts)
    const generateSlug = (text: string): string => {
      if (!text) return "";
      return text
        .toLowerCase()
        .trim()
        .replace(/[^\w\s-]/g, "")
        .replace(/\s+/g, "-")
        .replace(/-+/g, "-")
        .replace(/^-+|-+$/g, "");
    };

    // Get country code
    const COUNTRY_CODE_MAP: Record<string, string> = {
      'IN': 'India', 'US': 'United States', 'UK': 'United Kingdom', 'GB': 'United Kingdom',
      'CA': 'Canada', 'AU': 'Australia', 'DE': 'Germany', 'FR': 'France', 'IT': 'Italy',
      'ES': 'Spain', 'NZ': 'New Zealand', 'IE': 'Ireland', 'SG': 'Singapore', 'MY': 'Malaysia',
      'PH': 'Philippines', 'TH': 'Thailand', 'VN': 'Vietnam', 'PK': 'Pakistan', 'BD': 'Bangladesh',
      'ZA': 'South Africa', 'AE': 'United Arab Emirates', 'KW': 'Kuwait', 'SA': 'Saudi Arabia',
      'QA': 'Qatar', 'OM': 'Oman', 'JP': 'Japan', 'CN': 'China', 'HK': 'Hong Kong', 'MX': 'Mexico',
      'BR': 'Brazil', 'AR': 'Argentina', 'CL': 'Chile',
    };

    const countryCode = country.toUpperCase().length === 2 
      ? country.toUpperCase() 
      : Object.entries(COUNTRY_CODE_MAP).find(([_, name]) => 
          name.toLowerCase().replace(/\s+/g, "-") === country.toLowerCase()
        )?.[0] || country.toUpperCase();

    const requestedStateSlug = generateSlug(state);
    const requestedCitySlug = generateSlug(city);

    // Query detective with ratings
    const detectiveRows = await db
      .select({
        id: detectives.id,
        businessName: detectives.businessName,
        bio: detectives.bio,
        logo: detectives.logo,
        country: detectives.country,
        state: detectives.state,
        city: detectives.city,
        location: detectives.location,
        phone: detectives.phone,
        whatsapp: detectives.whatsapp,
        contactEmail: detectives.contactEmail,
        businessWebsite: detectives.businessWebsite,
        slug: detectives.slug,
      })
      .from(detectives)
      .where(eq(detectives.slug, slug));

    if (detectiveRows.length === 0) {
      return null;
    }

    // Match by location slugs
    const detective = detectiveRows.find((row) => {
      const rowStateSlug = generateSlug(row.state || "");
      const rowCitySlug = generateSlug(row.city || "");
      return rowStateSlug === requestedStateSlug && rowCitySlug === requestedCitySlug;
    }) || (detectiveRows.length === 1 ? detectiveRows[0] : null);

    if (!detective) {
      return null;
    }

    // Fetch average rating by joining services → reviews
    let avgRating = 0;
    let reviewCount = 0;
    try {
      console.log(`[SEO] Fetching ratings for detective ID: ${detective.id}`);
      
      // Query: Detective → Services → Reviews
      const ratingData = await db.select({
        avgRating: avg(reviews.rating),
        reviewCount: count(reviews.id),
      })
        .from(services)
        .innerJoin(reviews, eq(reviews.serviceId, services.id))
        .where(
          and(
            eq(services.detectiveId, detective.id),
            isNotNull(reviews.rating),
            eq(reviews.isPublished, true)
          )
        );
      
      if (ratingData.length > 0 && ratingData[0]) {
        const data = ratingData[0];
        avgRating = data.avgRating ? Number(data.avgRating) : 0;
        reviewCount = data.reviewCount ? Number(data.reviewCount) : 0;
        console.log(`[SEO] Found ${reviewCount} reviews with avg rating ${avgRating} for detective: ${detective.businessName}`);
      } else {
        console.log(`[SEO] No published reviews found for detective: ${detective.businessName}`);
      }
    } catch (error) {
      console.error(`[SEO] ERROR fetching ratings for detective ${detective.id}:`, {
        message: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
      // Don't fail - continue with avgRating = 0
    }

    return {
      ...detective,
      avgRating: Number(avgRating),
      reviewCount,
    };
  } catch (error) {
    const errorDetails = error instanceof Error 
      ? { message: error.message, stack: error.stack }
      : { message: String(error) };
    console.error("[SEO] CRITICAL ERROR fetching detective for SEO:", errorDetails);
    return null;
  }
}

/**
 * Generates SEO meta tags HTML string
 */
export function generateSeoMetaTags(detective: any, canonicalUrl: string): string {
  const name = detective.businessName || `${detective.firstName} ${detective.lastName}`.trim() || 'Detective';
  const location = detective.city && detective.state 
    ? `${detective.city}, ${detective.state}`
    : detective.city || detective.location || '';
  
  const shortDescription = detective.bio 
    ? detective.bio.substring(0, 155) // Meta description limit
    : `Professional private investigator services in ${location}`;

  const metaTags = [
    `<title>${escapeHtml(name)} - Private Detective${location ? ` in ${location}` : ''} | Ask Detectives</title>`,
    `<meta name="description" content="${escapeHtml(shortDescription)}" />`,
    `<meta property="og:title" content="${escapeHtml(name)} - Private Detective${location ? ` in ${location}` : ''}" />`,
    `<meta property="og:description" content="${escapeHtml(shortDescription)}" />`,
    `<meta property="og:url" content="${escapeHtml(canonicalUrl)}" />`,
    `<meta property="og:type" content="profile" />`,
    detective.logo ? `<meta property="og:image" content="${escapeHtml(detective.logo)}" />` : '',
    `<meta name="twitter:title" content="${escapeHtml(name)} - Private Detective${location ? ` in ${location}` : ''}" />`,
    `<meta name="twitter:description" content="${escapeHtml(shortDescription)}" />`,
    detective.logo ? `<meta name="twitter:image" content="${escapeHtml(detective.logo)}" />` : '',
    `<link rel="canonical" href="${escapeHtml(canonicalUrl)}" />`,
  ].filter(tag => tag.length > 0).join('\n    ');

  return metaTags;
}

/**
 * Maps country codes to lowercase slugs for canonical URLs
 */
export function getCountrySlug(country: string): string {
  if (!country) return "";
  
  // If already lowercase with hyphens, return as-is
  if (country === country.toLowerCase() && !country.match(/^[A-Z]{2}$/)) {
    return country;
  }
  
  // Map country codes to slugs
  const codeToSlug: Record<string, string> = {
    'IN': 'india',
    'US': 'united-states',
    'GB': 'united-kingdom',
    'UK': 'united-kingdom',
    'CA': 'canada',
    'AU': 'australia',
    'DE': 'germany',
    'FR': 'france',
    'IT': 'italy',
    'ES': 'spain',
    'NZ': 'new-zealand',
    'IE': 'ireland',
    'SG': 'singapore',
    'MY': 'malaysia',
    'PH': 'philippines',
    'TH': 'thailand',
    'VN': 'vietnam',
    'PK': 'pakistan',
    'BD': 'bangladesh',
    'ZA': 'south-africa',
    'AE': 'united-arab-emirates',
    'KW': 'kuwait',
    'SA': 'saudi-arabia',
    'QA': 'qatar',
    'OM': 'oman',
    'JP': 'japan',
    'CN': 'china',
    'HK': 'hong-kong',
    'MX': 'mexico',
    'BR': 'brazil',
    'AR': 'argentina',
    'CL': 'chile',
  };
  
  return codeToSlug[country.toUpperCase()] || country.toLowerCase().replace(/\s+/g, '-');
}

/**
 * Maps country codes to human-readable country names for breadcrumb labels
 */
function getCountryName(country: string): string {
  if (!country) return "";
  
  // Map country codes to display names
  const codeToName: Record<string, string> = {
    'IN': 'India',
    'US': 'United States',
    'GB': 'United Kingdom',
    'UK': 'United Kingdom',
    'CA': 'Canada',
    'AU': 'Australia',
    'DE': 'Germany',
    'FR': 'France',
    'IT': 'Italy',
    'ES': 'Spain',
    'NZ': 'New Zealand',
    'IE': 'Ireland',
    'SG': 'Singapore',
    'MY': 'Malaysia',
    'PH': 'Philippines',
    'TH': 'Thailand',
    'VN': 'Vietnam',
    'PK': 'Pakistan',
    'BD': 'Bangladesh',
    'ZA': 'South Africa',
    'AE': 'United Arab Emirates',
    'KW': 'Kuwait',
    'SA': 'Saudi Arabia',
    'QA': 'Qatar',
    'OM': 'Oman',
    'JP': 'Japan',
    'CN': 'China',
    'HK': 'Hong Kong',
    'MX': 'Mexico',
    'BR': 'Brazil',
    'AR': 'Argentina',
    'CL': 'Chile',
  };
  
  return codeToName[country.toUpperCase()] || country;
}

/**
 * Generates JSON-LD LocalBusiness schema for detective profile
 * 
 * Conditional properties (only included if they have valid values):
 * - aggregateRating: Only if reviewCount > 0
 * - priceRange: Only if detective.priceRange exists
 * - sameAs: Only if website/social links exist
 * 
 * All numeric values are properly typed (not strings)
 */
function generateDetectiveLocalBusinessSchema(detective: any, canonicalUrl: string): string {
  const name = detective.businessName || `${detective.firstName} ${detective.lastName}`.trim() || 'Detective';
  const location = detective.city && detective.state 
    ? `${detective.city}, ${detective.state}`
    : detective.city || detective.location || '';

  // Build base schema with required properties
  const localBusiness: Record<string, any> = {
    "@context": "https://schema.org",
    "@type": "LocalBusiness",
    "@id": canonicalUrl,
    "name": name,
    "description": detective.bio || `Professional private investigator in ${location}`,
    "url": canonicalUrl,
  };

  // Add address if available
  if (location) {
    localBusiness.address = {
      "@type": "PostalAddress",
      "addressLocality": detective.city || "",
      "addressRegion": detective.state || "",
      "addressCountry": detective.country || "",
    };
  }

  // Add phone
  if (detective.phone) {
    localBusiness.telephone = detective.phone;
  }

  // Add contact email
  if (detective.contactEmail) {
    localBusiness.email = detective.contactEmail;
  }

  // Add website
  if (detective.businessWebsite) {
    localBusiness.url = detective.businessWebsite;
  }

  // Add logo/image
  if (detective.logo) {
    localBusiness.image = detective.logo;
    localBusiness.logo = {
      "@type": "ImageObject",
      "url": detective.logo,
    };
  }

  // Add area served
  if (location) {
    localBusiness.areaServed = location;
  }

  // Add aggregate rating ONLY if reviewCount > 0
  // Ensure ratingValue is numeric (not string) and reviewCount is integer
  if (detective.reviewCount && Number(detective.reviewCount) > 0) {
    const ratingValue = Number(detective.avgRating);
    const reviewCount = Number(detective.reviewCount);
    
    // Only add if both values are valid numbers
    if (!isNaN(ratingValue) && !isNaN(reviewCount)) {
      localBusiness.aggregateRating = {
        "@type": "AggregateRating",
        "ratingValue": ratingValue,
        "reviewCount": reviewCount,
      };
    }
  }

  // Add price range ONLY if it exists in detective data
  if (detective.priceRange) {
    localBusiness.priceRange = detective.priceRange;
  }

  return JSON.stringify(localBusiness, null, 2);
}

/**
 * Generates JSON-LD BreadcrumbList schema for detective profile
 */
function generateDetectiveBreadcrumbSchema(detective: any, canonicalUrl: string): string {
  const name = detective.businessName || `${detective.firstName} ${detective.lastName}`.trim() || 'Detective';
  const countrySlug = getCountrySlug(detective.country);
  const stateSlug = detective.state?.toLowerCase().replace(/\s+/g, '-') || '';
  const citySlug = detective.city?.toLowerCase().replace(/\s+/g, '-') || '';

  const breadcrumbs: any = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    "itemListElement": [
      {
        "@type": "ListItem",
        "position": 1,
        "name": "Home",
        "item": "https://www.askdetectives.com",
      },
      {
        "@type": "ListItem",
        "position": 2,
        "name": getCountryName(detective.country) || "Detectives",
        "item": `https://www.askdetectives.com/detectives/${countrySlug}/`,
      },
    ],
  };

  if (stateSlug) {
    breadcrumbs.itemListElement.push({
      "@type": "ListItem",
      "position": 3,
      "name": detective.state,
      "item": `https://www.askdetectives.com/detectives/${countrySlug}/${stateSlug}/`,
    });
  }

  if (citySlug) {
    breadcrumbs.itemListElement.push({
      "@type": "ListItem",
      "position": breadcrumbs.itemListElement.length + 1,
      "name": detective.city,
      "item": `https://www.askdetectives.com/detectives/${countrySlug}/${stateSlug}/${citySlug}/`,
    });
  }

  breadcrumbs.itemListElement.push({
    "@type": "ListItem",
    "position": breadcrumbs.itemListElement.length + 1,
    "name": name,
    "item": canonicalUrl,
  });

  return JSON.stringify(breadcrumbs, null, 2);
}

/**
 * Generates JSON-LD structured data for detective profile
 * Returns object with localBusiness and breadcrumbs as separate JSON strings
 */
export function generateDetectiveJsonLd(detective: any, canonicalUrl: string): { localBusiness: string; breadcrumbs: string } {
  return {
    localBusiness: generateDetectiveLocalBusinessSchema(detective, canonicalUrl),
    breadcrumbs: generateDetectiveBreadcrumbSchema(detective, canonicalUrl),
  };
}

/**
 * Injects SEO tags into HTML template
 * STEP 1: Removes all default meta tags first to prevent duplicates
 * STEP 2: Injects fresh SEO tags at injection points
 */
export function injectSeoTags(htmlContent: string, detective: any, canonicalUrl: string): string {
  // STEP 1: Remove all existing default meta tags
  let modified = removeDefaultMetaTags(htmlContent);

  // STEP 2: Inject new SEO tags
  const metaTags = generateSeoMetaTags(detective, canonicalUrl);
  const metaTagsArray = metaTags.split('\n');
  const titleTag = metaTagsArray[0];
  const otherTags = metaTagsArray.slice(1).join('\n    ');

  // Inject title at SEO_TITLE_INJECTION_POINT
  modified = modified.replace(
    /<!-- SEO_TITLE_INJECTION_POINT -->/,
    `<!-- SEO_TITLE_INJECTION_POINT -->\n    ${titleTag}`
  );

  // Inject meta tags at SEO_META_INJECTION_POINT
  modified = modified.replace(
    /<!-- SEO_META_INJECTION_POINT -->/,
    `<!-- SEO_META_INJECTION_POINT -->\n    ${otherTags}`
  );

  // Inject JSON-LD at SEO_JSON_LD_INJECTION_POINT
  // Create two separate script tags: one for LocalBusiness, one for BreadcrumbList
  const jsonLd = generateDetectiveJsonLd(detective, canonicalUrl);
  const jsonLdScripts = `<script type="application/ld+json">\n      ${jsonLd.localBusiness}\n    </script>\n    <script type="application/ld+json">\n      ${jsonLd.breadcrumbs}\n    </script>`;
  modified = modified.replace(
    /<!-- SEO_JSON_LD_INJECTION_POINT -->/,
    `<!-- SEO_JSON_LD_INJECTION_POINT -->\n    ${jsonLdScripts}`
  );

  return modified;
}

/**
 * Removes ALL default meta tags from HTML to prevent duplicates
 * Must be called BEFORE injecting new SEO tags
 */
export function removeDefaultMetaTags(htmlContent: string): string {
  let cleaned = htmlContent;

  // Remove default title tag
  cleaned = cleaned.replace(/<title>[^<]*<\/title>/gi, '');

  // Remove meta description
  cleaned = cleaned.replace(/<meta\s+name="description"[^>]*>/gi, '');

  // Remove Open Graph tags
  cleaned = cleaned.replace(/<meta\s+property="og:title"[^>]*>/gi, '');
  cleaned = cleaned.replace(/<meta\s+property="og:description"[^>]*>/gi, '');
  cleaned = cleaned.replace(/<meta\s+property="og:type"[^>]*>/gi, '');
  cleaned = cleaned.replace(/<meta\s+property="og:image"[^>]*>/gi, '');
  cleaned = cleaned.replace(/<meta\s+property="og:url"[^>]*>/gi, '');
  cleaned = cleaned.replace(/<meta\s+property="og:site_name"[^>]*>/gi, '');

  // Remove Twitter Card tags
  cleaned = cleaned.replace(/<meta\s+name="twitter:card"[^>]*>/gi, '');
  cleaned = cleaned.replace(/<meta\s+name="twitter:title"[^>]*>/gi, '');
  cleaned = cleaned.replace(/<meta\s+name="twitter:description"[^>]*>/gi, '');
  cleaned = cleaned.replace(/<meta\s+name="twitter:image"[^>]*>/gi, '');
  cleaned = cleaned.replace(/<meta\s+name="twitter:site"[^>]*>/gi, '');

  // Remove canonical link
  cleaned = cleaned.replace(/<link\s+rel="canonical"[^>]*>/gi, '');

  // Clean up any double newlines created by removals
  cleaned = cleaned.replace(/\n\s*\n\s*\n/g, '\n\n');

  return cleaned;
}

/**
 * Escapes HTML special characters
 */
function escapeHtml(text: string): string {
  const map: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;',
  };
  return text.replace(/[&<>"']/g, (char) => map[char] || char);
}

/**
 * Checks if a request path is a detective profile route
 */
export function isDetectiveProfilePath(requestPath: string): boolean {
  // Match pattern: /detectives/country/state/city/slug/
  const detPath = requestPath.replace(/\/+$/, ''); // Remove trailing slash
  const segments = detPath.split('/').filter(s => s);
  
  // Should be exactly: detectives, country, state, city, slug
  return segments.length === 5 && segments[0] === 'detectives';
}

/**
 * Extracts detective route parameters
 */
export function extractDetectiveRouteParams(
  requestPath: string
): { country: string; state: string; city: string; slug: string } | null {
  const detPath = requestPath.replace(/\/+$/, '');
  const segments = detPath.split('/').filter(s => s);
  
  if (segments.length === 5 && segments[0] === 'detectives') {
    return {
      country: segments[1],
      state: segments[2],
      city: segments[3],
      slug: segments[4],
    };
  }
  
  return null;
}

/**
 * Checks if a request path is a location listing route
 * Matches: /detectives/:country, /detectives/:country/:state, /detectives/:country/:state/:city
 */
export function isLocationListingPath(requestPath: string): boolean {
  const locPath = requestPath.replace(/\/+$/, '');
  const segments = locPath.split('/').filter(s => s);
  
  // Should be 2-4 segments: detectives, country, [state], [city]
  // But NOT 5+ segments (which would be a detective profile with slug)
  return segments.length >= 2 && segments.length <= 4 && segments[0] === 'detectives';
}

/**
 * Extracts location route parameters
 */
export function extractLocationRouteParams(
  requestPath: string
): { country: string; state?: string; city?: string } | null {
  const locPath = requestPath.replace(/\/+$/, '');
  const segments = locPath.split('/').filter(s => s);
  
  if (segments.length >= 2 && segments.length <= 4 && segments[0] === 'detectives') {
    return {
      country: segments[1],
      state: segments[2],
      city: segments[3],
    };
  }
  
  return null;
}

/**
 * Fetches detectives for a location for SEO purposes
 * Returns limited detectives list plus totalCount for SEO metadata
 */
export async function getLocationDetectivesForSEO(
  country: string,
  state?: string,
  city?: string,
  limit?: number
): Promise<{
  detectives: Array<{
    id: string;
    businessName: string | null;
    slug: string | null;
    city: string;
    state: string;
    country: string;
    logo: string | null;
    bio: string | null;
    phone: string | null;
    whatsapp: string | null;
    contactEmail: string | null;
    isVerified: boolean;
    level: string | null;
    effectiveBadges: { blueTick: boolean; pro: boolean; recommended: boolean };
  }>;
  totalCount: number;
}> {
  try {
    // Convert slug to title case
    const slugToTitleCase = (slug: string): string => {
      if (!slug) return "";
      return slug
        .split("-")
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
        .join(" ");
    };

    // Map country slugs to COUNTRY CODES (as stored in DB)
    const countrySlugToCode: Record<string, string> = {
      "india": "IN",
      "united-states": "US",
      "united-kingdom": "GB",
      "canada": "CA",
      "australia": "AU",
      "germany": "DE",
      "france": "FR",
      "italy": "IT",
      "spain": "ES",
      "new-zealand": "NZ",
      "ireland": "IE",
      "singapore": "SG",
      "malaysia": "MY",
      "philippines": "PH",
      "thailand": "TH",
      "vietnam": "VN",
      "pakistan": "PK",
      "bangladesh": "BD",
      "south-africa": "ZA",
      "united-arab-emirates": "AE",
      "kuwait": "KW",
      "saudi-arabia": "SA",
      "qatar": "QA",
      "oman": "OM",
      "japan": "JP",
      "china": "CN",
      "hong-kong": "HK",
      "mexico": "MX",
      "brazil": "BR",
      "argentina": "AR",
      "chile": "CL",
    };

    // Build query conditions
    let conditions = [eq(detectives.status, "active")];
    const limitValue = typeof limit === "number" && limit > 0 ? limit : 15;

    // Try country code first, then fallback to title case name
    const countryCode = countrySlugToCode[country.toLowerCase()];
    const countryName = slugToTitleCase(country);
    
    // Add condition that matches either code OR name (flexibility for both formats)
    if (countryCode) {
      conditions.push(
        or(eq(detectives.country, countryCode), eq(detectives.country, countryName))!
      );
    } else {
      conditions.push(eq(detectives.country, countryName));
    }

    // Convert and add state filter if provided
    if (state) {
      const normalizedState = slugToTitleCase(state);
      conditions.push(eq(detectives.state, normalizedState));
    }

    // Convert and add city filter if provided
    if (city) {
      const normalizedCity = slugToTitleCase(city);
      conditions.push(eq(detectives.city, normalizedCity));
    }

    console.log("[Location SEO] Querying detectives for location:", {
      countryCode: countryCode || "not-mapped",
      countryName: countryName,
      state: state ? slugToTitleCase(state) : undefined,
      city: city ? slugToTitleCase(city) : undefined,
    });

    // Query total count for this location (before limit)
    const totalCountRows = await db
      .select({ count: sql<number>`count(*)` })
      .from(detectives)
      .where(and(...conditions));

    const totalCount = Number(totalCountRows?.[0]?.count || 0);

    // Query detectives for this location with subscription package for badges
    const rows = await db
      .select({
        id: detectives.id,
        businessName: detectives.businessName,
        slug: detectives.slug,
        city: detectives.city,
        state: detectives.state,
        country: detectives.country,
        logo: detectives.logo,
        bio: detectives.bio,
        phone: detectives.phone,
        whatsapp: detectives.whatsapp,
        contactEmail: detectives.contactEmail,
        isVerified: detectives.isVerified,
        level: detectives.level,
        subscriptionPackageId: detectives.subscriptionPackageId,
        subscriptionExpiresAt: detectives.subscriptionExpiresAt,
        blueTickAddon: detectives.blueTickAddon,
        subscriptionPackage: subscriptionPlans,
      })
      .from(detectives)
      .leftJoin(subscriptionPlans, eq(detectives.subscriptionPackageId, subscriptionPlans.id))
      .where(and(...conditions))
      .limit(limitValue);

    console.log("[Location SEO] Query returned", rows.length, "detectives for", {country, state, city});

    // Compute effectiveBadges for each detective
    const detectivesWithBadges = rows.map((row) => {
      const effectiveBadges = computeEffectiveBadges(
        {
          subscriptionPackageId: row.subscriptionPackageId,
          subscriptionExpiresAt: row.subscriptionExpiresAt,
          blueTickAddon: row.blueTickAddon,
        },
        row.subscriptionPackage
      );

      return {
        id: row.id,
        businessName: row.businessName,
        slug: row.slug,
        city: row.city,
        state: row.state,
        country: row.country,
        logo: row.logo,
        bio: row.bio,
        phone: row.phone,
        whatsapp: row.whatsapp,
        contactEmail: row.contactEmail,
        isVerified: row.isVerified,
        level: row.level,
        effectiveBadges,
      };
    });

    return {
      detectives: detectivesWithBadges,
      totalCount,
    };
  } catch (error) {
    console.error("[SEO] Error fetching location detectives:", error);
    return {
      detectives: [],
      totalCount: 0,
    };
  }
}

/**
 * Generates SEO meta tags for location listing pages
 */
export async function generateLocationSeoMetaTags(
  location: { country: string; state?: string; city?: string },
  totalCount: number,
  canonicalUrl: string
): Promise<{ html: string; title: string; description: string; h1: string }> {
  const year = new Date().getFullYear();

  // ✅ STEP 1: Resolve location IDs (country, state, city)
  let countryId: number | null = null;
  let stateId: number | null = null;
  let cityId: number | null = null;
  let countryName = location.country;
  let stateName = location.state || "";
  let cityName = location.city || "";

  try {
    // Resolve country ID and name
    const countrySlug = location.country.toLowerCase();
    const countryResult = await db
      .select({ id: countries.id, name: countries.name })
      .from(countries)
      .where(eq(countries.slug, countrySlug))
      .limit(1);
    
    if (countryResult.length > 0) {
      countryId = countryResult[0].id;
      countryName = countryResult[0].name;
    }

    // Resolve state ID and name if state exists
    if (location.state && countryId) {
      const stateSlug = location.state.toLowerCase();
      const stateResult = await db
        .select({ id: states.id, name: states.name })
        .from(states)
        .where(and(
          eq(states.slug, stateSlug),
          eq(states.countryId, countryId)
        ))
        .limit(1);
      
      if (stateResult.length > 0) {
        stateId = stateResult[0].id;
        stateName = stateResult[0].name;
      }
    }

    // Resolve city ID and name if city exists
    if (location.city && stateId) {
      const citySlug = location.city.toLowerCase();
      const cityResult = await db
        .select({ id: cities.id, name: cities.name })
        .from(cities)
        .where(and(
          eq(cities.slug, citySlug),
          eq(cities.stateId, stateId)
        ))
        .limit(1);
      
      if (cityResult.length > 0) {
        cityId = cityResult[0].id;
        cityName = cityResult[0].name;
      }
    }
  } catch (resolutionError) {
    console.error('[SEO SSR] Location ID resolution error:', resolutionError);
  }

  // ✅ STEP 2: Query location_seo_overrides table (Priority: Override > System Generated > Fallback)
  let title = "";
  let description = "";
  let h1 = "";

  try {
    let seoOverrideQuery: any = null;
    
    if (cityId && stateId && countryId) {
      // City-level page: entity_type='city', entity_id=cityId::text
      seoOverrideQuery = await pool.query(
        `SELECT meta_title, meta_description, h1 
         FROM location_seo_overrides 
         WHERE entity_type = 'city' AND entity_id = $1::text 
         LIMIT 1`,
        [cityId]
      );
    } else if (stateId && countryId) {
      // State-level page: entity_type='state', entity_id=stateId::text
      seoOverrideQuery = await pool.query(
        `SELECT meta_title, meta_description, h1 
         FROM location_seo_overrides 
         WHERE entity_type = 'state' AND entity_id = $1::text 
         LIMIT 1`,
        [stateId]
      );
    } else if (countryId) {
      // Country-level page: entity_type='country', entity_id=countryId::text
      seoOverrideQuery = await pool.query(
        `SELECT meta_title, meta_description, h1 
         FROM location_seo_overrides 
         WHERE entity_type = 'country' AND entity_id = $1::text 
         LIMIT 1`,
        [countryId]
      );
    }

    if (seoOverrideQuery?.rows?.length > 0) {
      // ✅ OVERRIDE FOUND - Use override values
      const override = seoOverrideQuery.rows[0];
      title = override.meta_title || "";
      description = override.meta_description || "";
      h1 = override.h1 || "";
      console.log(`[SEO SSR] Override applied for ${cityId ? 'city' : stateId ? 'state' : 'country'}`);
    } else {
      // ✅ NO OVERRIDE - Generate system SEO (improved format)
      const locationName = cityName || stateName || countryName;
      
      title = `Top Private Detectives in ${locationName} | Verified Investigators (${year})`;
      description = `Find trusted private detectives in ${locationName}. Browse ${totalCount} verified investigators offering background checks, surveillance, and investigation services.`;
      h1 = `Private Detectives in ${locationName}`;
      
      console.log(`[SEO SSR] System-generated SEO for ${cityId ? 'city' : stateId ? 'state' : 'country'}: ${locationName}`);
    }
  } catch (seoError) {
    console.error('[SEO SSR] Override query error:', seoError);
    
    // ✅ FALLBACK - Use default template if database query fails
    const locationDisplayName = [cityName, stateName, countryName].filter(Boolean).join(", ");
    title = `Top Private Detectives in ${locationDisplayName} (${year})`;
    description = `Find trusted private detectives in ${locationDisplayName}. Browse verified investigators.`;
    h1 = `Private Detectives in ${locationDisplayName}`;
  }

  // ✅ STEP 3: Generate meta tags (use h1 value for OG title to match frontend)
  const metaTags = [
    `<title>${escapeHtml(title)}</title>`,
    `<meta name="description" content="${escapeHtml(description)}">`,
    `<meta name="robots" content="index, follow">`,
    `<meta name="canonical" content="${escapeHtml(canonicalUrl)}">`,
    `<meta property="og:type" content="website">`,
    `<meta property="og:url" content="${escapeHtml(canonicalUrl)}">`,
    `<meta property="og:title" content="${escapeHtml(h1 || title)}">`,
    `<meta property="og:description" content="${escapeHtml(description)}">`,
    `<meta property="og:site_name" content="Ask Detectives">`,
    `<meta name="twitter:card" content="summary_large_image">`,
    `<meta name="twitter:title" content="${escapeHtml(h1 || title)}">`,
    `<meta name="twitter:description" content="${escapeHtml(description)}">`,
    `<link rel="canonical" href="${escapeHtml(canonicalUrl)}">`,
  ];

  return {
    html: metaTags.join('\n    '),
    title: title,
    description: description,
    h1: h1
  };
}

/**
 * Generates JSON-LD ItemList schema for location listing pages
 */
function generateLocationItemListSchema(
  location: { country: string; state?: string; city?: string },
  detectives: Array<{ slug: string; businessName: string; city: string; state: string; country: string }>,
  canonicalUrl: string
): string {
  const locationLabel = [location.city, location.state, location.country]
    .filter(Boolean)
    .join(", ");

  const itemListElement = detectives.slice(0, 10).map((detective, index) => {
    const countrySlug = getCountrySlug(detective.country);
    const stateSlug = detective.state?.toLowerCase().replace(/\s+/g, "-") || "";
    const citySlug = detective.city?.toLowerCase().replace(/\s+/g, "-") || "";
    const detProfileUrl = `https://www.askdetectives.com/detectives/${countrySlug}/${stateSlug}/${citySlug}/${detective.slug}/`;

    return {
      "@type": "ListItem",
      "position": index + 1,
      "url": detProfileUrl,
      "name": detective.businessName || "Private Detective",
    };
  });

  const itemList: any = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    "name": `Private Detectives in ${locationLabel}`,
    "description": `Directory of private detectives and investigators in ${locationLabel}`,
    "url": canonicalUrl,
    "itemListElement": itemListElement,
  };

  return JSON.stringify(itemList, null, 2);
}

/**
 * Generates JSON-LD BreadcrumbList schema for location listing pages
 */
function generateLocationBreadcrumbSchema(
  location: { country: string; state?: string; city?: string }
): string {
  const countrySlug = getCountrySlug(location.country);
  const stateSlug = location.state?.toLowerCase().replace(/\s+/g, "-") || "";
  const citySlug = location.city?.toLowerCase().replace(/\s+/g, "-") || "";

  const breadcrumbItems: any[] = [
    {
      "@type": "ListItem",
      "position": 1,
      "name": "Home",
      "item": "https://www.askdetectives.com",
    },
  ];

  if (location.country) {
    breadcrumbItems.push({
      "@type": "ListItem",
      "position": 2,
      "name": getCountryName(location.country),
      "item": `https://www.askdetectives.com/detectives/${countrySlug}/`,
    });
  }

  if (stateSlug && location.country) {
    breadcrumbItems.push({
      "@type": "ListItem",
      "position": 3,
      "name": location.state,
      "item": `https://www.askdetectives.com/detectives/${countrySlug}/${stateSlug}/`,
    });
  }

  if (citySlug && stateSlug && location.country) {
    breadcrumbItems.push({
      "@type": "ListItem",
      "position": 4,
      "name": location.city,
      "item": `https://www.askdetectives.com/detectives/${countrySlug}/${stateSlug}/${citySlug}/`,
    });
  }

  const breadcrumbs: any = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    "itemListElement": breadcrumbItems,
  };

  return JSON.stringify(breadcrumbs, null, 2);
}

/**
 * Generates JSON-LD schema for location listing pages
 * Returns object with itemList and breadcrumbs as separate JSON strings
 */
export function generateLocationJsonLd(
  location: { country: string; state?: string; city?: string },
  detectives: Array<{ slug: string; businessName: string; city: string; state: string; country: string }>,
  canonicalUrl: string
): { itemList: string; breadcrumbs: string } {
  return {
    itemList: generateLocationItemListSchema(location, detectives, canonicalUrl),
    breadcrumbs: generateLocationBreadcrumbSchema(location),
  };
}

/**
 * Injects location SEO tags into HTML template
 * STEP 1: Removes all default meta tags first to prevent duplicates
 * STEP 2: Injects fresh SEO tags (title, meta) from database overrides or system-generated
 * STEP 3: Injects SEO data (title, description, h1) as JavaScript object for React to consume
 */
export async function injectLocationSeoTags(
  htmlContent: string,
  location: { country: string; state?: string; city?: string },
  detectives: Array<{ slug: string; businessName: string; city: string; state: string; country: string }>,
  canonicalUrl: string,
  totalCount?: number
): Promise<string> {
  // STEP 1: Remove all existing default meta tags
  let modified = removeDefaultMetaTags(htmlContent);

  // STEP 2: Inject new SEO tags (now async with override support)
  const seoData = await generateLocationSeoMetaTags(location, totalCount ?? detectives.length, canonicalUrl);
  const metaTagsArray = seoData.html.split('\n');
  const titleTag = metaTagsArray[0];
  const otherTags = metaTagsArray.slice(1).join('\n    ');

  // Inject title at SEO_TITLE_INJECTION_POINT
  modified = modified.replace(
    /<!-- SEO_TITLE_INJECTION_POINT -->/,
    `<!-- SEO_TITLE_INJECTION_POINT -->\n    ${titleTag}`
  );

  // Inject meta tags at SEO_META_INJECTION_POINT
  modified = modified.replace(
    /<!-- SEO_META_INJECTION_POINT -->/,
    `<!-- SEO_META_INJECTION_POINT -->\n    ${otherTags}`
  );

  // Inject JSON-LD at SEO_JSON_LD_INJECTION_POINT
  // Create two separate script tags: one for ItemList, one for BreadcrumbList
  const jsonLd = generateLocationJsonLd(location, detectives, canonicalUrl);
  const jsonLdScripts = `<script type="application/ld+json">\n      ${jsonLd.itemList}\n    </script>\n    <script type="application/ld+json">\n      ${jsonLd.breadcrumbs}\n    </script>`;
  modified = modified.replace(
    /<!-- SEO_JSON_LD_INJECTION_POINT -->/,
    `<!-- SEO_JSON_LD_INJECTION_POINT -->\n    ${jsonLdScripts}`
  );

  // STEP 3: Inject SEO data as window.__SEO_DATA__ for React to consume
  // Includes title, description, and H1 from database overrides or system-generated values
  const seoDataScript = `<script>
      window.__SEO_DATA__ = {
        title: ${JSON.stringify(seoData.title)},
        description: ${JSON.stringify(seoData.description)},
        h1: ${JSON.stringify(seoData.h1)},
        location: ${JSON.stringify(location)},
        totalCount: ${totalCount ?? detectives.length}
      };
    </script>`;
  
  modified = modified.replace('</head>', `${seoDataScript}\n  </head>`);

  return modified;
}

/**
 * Generates H1 text for location listing pages using same logic as SEO meta tags
 * Returns H1 text string (not HTML)
 */
export async function generateLocationH1(
  location: { country: string; state?: string; city?: string },
  totalCount: number
): Promise<string> {
  const year = new Date().getFullYear();

  // ✅ STEP 1: Resolve location IDs (country, state, city)
  let countryId: number | null = null;
  let stateId: number | null = null;
  let cityId: number | null = null;
  let countryName = location.country;
  let stateName = location.state || "";
  let cityName = location.city || "";

  try {
    // Resolve country ID and name
    const countrySlug = location.country.toLowerCase();
    const countryResult = await db
      .select({ id: countries.id, name: countries.name })
      .from(countries)
      .where(eq(countries.slug, countrySlug))
      .limit(1);
    
    if (countryResult.length > 0) {
      countryId = countryResult[0].id;
      countryName = countryResult[0].name;
    }

    // Resolve state ID and name if state exists
    if (location.state && countryId) {
      const stateSlug = location.state.toLowerCase();
      const stateResult = await db
        .select({ id: states.id, name: states.name })
        .from(states)
        .where(and(
          eq(states.slug, stateSlug),
          eq(states.countryId, countryId)
        ))
        .limit(1);
      
      if (stateResult.length > 0) {
        stateId = stateResult[0].id;
        stateName = stateResult[0].name;
      }
    }

    // Resolve city ID and name if city exists
    if (location.city && stateId) {
      const citySlug = location.city.toLowerCase();
      const cityResult = await db
        .select({ id: cities.id, name: cities.name })
        .from(cities)
        .where(and(
          eq(cities.slug, citySlug),
          eq(cities.stateId, stateId)
        ))
        .limit(1);
      
      if (cityResult.length > 0) {
        cityId = cityResult[0].id;
        cityName = cityResult[0].name;
      }
    }
  } catch (resolutionError) {
    console.error('[SEO SSR] Location ID resolution error for H1:', resolutionError);
  }

  // ✅ STEP 2: Query location_seo_overrides table
  let h1 = "";

  try {
    let seoOverrideQuery: any = null;
    
    if (cityId && stateId && countryId) {
      // City-level page: entity_type='city', entity_id=cityId::text
      seoOverrideQuery = await pool.query(
        `SELECT h1 FROM location_seo_overrides 
         WHERE entity_type = 'city' AND entity_id = $1::text 
         LIMIT 1`,
        [cityId]
      );
    } else if (stateId && countryId) {
      // State-level page: entity_type='state', entity_id=stateId::text
      seoOverrideQuery = await pool.query(
        `SELECT h1 FROM location_seo_overrides 
         WHERE entity_type = 'state' AND entity_id = $1::text 
         LIMIT 1`,
        [stateId]
      );
    } else if (countryId) {
      // Country-level page: entity_type='country', entity_id=countryId::text
      seoOverrideQuery = await pool.query(
        `SELECT h1 FROM location_seo_overrides 
         WHERE entity_type = 'country' AND entity_id = $1::text 
         LIMIT 1`,
        [countryId]
      );
    }

    if (seoOverrideQuery?.rows?.length > 0) {
      // ✅ OVERRIDE FOUND - Use override H1
      const override = seoOverrideQuery.rows[0];
      h1 = override.h1 || "";
      console.log(`[SEO SSR] Override H1 applied for ${cityId ? 'city' : stateId ? 'state' : 'country'}`);
    } else {
      // ✅ NO OVERRIDE - Generate system H1
      const locationName = cityName || stateName || countryName;
      h1 = `Private Detectives in ${locationName}`;
      console.log(`[SEO SSR] System-generated H1 for ${cityId ? 'city' : stateId ? 'state' : 'country'}: ${locationName}`);
    }
  } catch (seoError) {
    console.error('[SEO SSR] H1 override query error:', seoError);
    
    // ✅ FALLBACK - Use default template if database query fails
    const locationDisplayName = [cityName, stateName, countryName].filter(Boolean).join(", ");
    h1 = `Private Detectives in ${locationDisplayName}`;
  }

  return h1;
}

/**
 * Helper to convert text to URL-safe slug
 */
export function generateSlug(text: string): string {
  if (!text) return "";
  return text
    .toString()
    .normalize("NFKD")
    .toLowerCase()
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/**
 * Build homepage authority HTML block with location links
 * Server-rendered, crawlable content for SEO
 */
export function buildHomepageAuthorityHtml(
  countries: Array<{ country: string; detectiveCount: number }>,
  statesByCountry: Record<string, Array<{ state: string; detectiveCount: number }>>,
  citiesByCountryState: Record<string, Array<{ city: string; detectiveCount: number }>>
): string {
  // HTML escape function for safety
  function escapeHtml(text: string): string {
    return text
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  // Get country name from code (same as existing mapping)
  function getCountryName(code: string): string {
    const COUNTRY_NAME_MAP: Record<string, string> = {
      'IN': 'India', 'US': 'United States', 'UK': 'United Kingdom', 'GB': 'United Kingdom',
      'CA': 'Canada', 'AU': 'Australia', 'DE': 'Germany', 'FR': 'France', 'IT': 'Italy',
      'ES': 'Spain', 'NZ': 'New Zealand', 'IE': 'Ireland', 'SG': 'Singapore', 'MY': 'Malaysia',
      'PH': 'Philippines', 'TH': 'Thailand', 'VN': 'Vietnam', 'PK': 'Pakistan', 'BD': 'Bangladesh',
      'ZA': 'South Africa', 'AE': 'United Arab Emirates', 'KW': 'Kuwait', 'SA': 'Saudi Arabia',
      'QA': 'Qatar', 'OM': 'Oman', 'JP': 'Japan', 'CN': 'China', 'HK': 'Hong Kong', 'MX': 'Mexico',
      'BR': 'Brazil', 'AR': 'Argentina', 'CL': 'Chile',
    };
    return COUNTRY_NAME_MAP[code?.toUpperCase()] || code;
  }

  // Start section with proper styling
  let html = '<section class="homepage-authority container mx-auto py-12 px-6 md:px-12 lg:px-24">\n';
  html += '  <h2 class="text-2xl font-bold mb-6 text-gray-900">Find Private Detectives by Location</h2>\n';

  // === SUBSECTION 1: TOP COUNTRIES (8) ===
  if (countries && countries.length > 0) {
    html += '  <div class="mb-8">\n';
    html += '    <h3 class="text-lg font-semibold mb-3 text-gray-800">Popular Countries</h3>\n';
    html += '    <div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">\n';

    countries.slice(0, 8).forEach((countryData) => {
      const countryCode = countryData.country;
      const countryName = getCountryName(countryCode);
      const countrySlug = getCountrySlug(countryCode);

      html += '      <div>\n';
      html += `        <a href="/detectives/${countrySlug}/" class="text-green-600 hover:text-green-800 hover:underline transition-colors font-medium" title="Find detectives in ${escapeHtml(countryName)}">${escapeHtml(countryName)}</a>\n`;
      html += `        <p class="text-xs text-gray-500 mt-1">${countryData.detectiveCount} detective${countryData.detectiveCount !== 1 ? "s" : ""}</p>\n`;
      html += '      </div>\n';
    });

    html += '    </div>\n';
    html += '  </div>\n';
  }

  // === SUBSECTION 2: POPULAR STATES (8) ===
  const allStates: Array<{ country: string; state: string; detectiveCount: number }> = [];
  countries.forEach((countryData) => {
    const countryCode = countryData.country;
    const countryStates = statesByCountry[countryCode] || [];
    countryStates.forEach((stateData) => {
      allStates.push({
        country: countryCode,
        state: stateData.state,
        detectiveCount: stateData.detectiveCount,
      });
    });
  });

  const topStates = allStates
    .sort((a, b) => b.detectiveCount - a.detectiveCount)
    .slice(0, 8);

  if (topStates && topStates.length > 0) {
    html += '  <div class="mb-8">\n';
    html += '    <h3 class="text-lg font-semibold mb-3 text-gray-800">Popular States</h3>\n';
    html += '    <div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">\n';

    topStates.forEach((stateData) => {
      const countrySlug = getCountrySlug(stateData.country);
      const stateSlug = generateSlug(stateData.state);
      const label = `${stateData.state}, ${getCountryName(stateData.country)}`;

      html += '      <div>\n';
      html += `        <a href="/detectives/${countrySlug}/${stateSlug}/" class="text-green-600 hover:text-green-800 hover:underline transition-colors font-medium" title="Find detectives in ${escapeHtml(label)}">${escapeHtml(label)}</a>\n`;
      html += `        <p class="text-xs text-gray-500 mt-1">${stateData.detectiveCount} detective${stateData.detectiveCount !== 1 ? "s" : ""}</p>\n`;
      html += '      </div>\n';
    });

    html += '    </div>\n';
    html += '  </div>\n';
  }

  // === SUBSECTION 3: POPULAR CITIES (8) ===
  // Gather all cities from all states in all countries
  const allCities: Array<{ country: string; state: string; city: string; detectiveCount: number }> = [];
  
  countries.forEach((countryData) => {
    const countryCode = countryData.country;
    const countryStates = statesByCountry[countryCode] || [];

    countryStates.forEach((stateData) => {
      const stateName = stateData.state;
      const cityKey = `${countryCode}|${stateName}`;
      const cities = citiesByCountryState[cityKey] || [];

      cities.forEach((cityData) => {
        allCities.push({
          country: countryCode,
          state: stateName,
          city: cityData.city,
          detectiveCount: cityData.detectiveCount,
        });
      });
    });
  });

  // Sort cities by detective count and take top 8
  const topCities = allCities
    .sort((a, b) => b.detectiveCount - a.detectiveCount)
    .slice(0, 8);

  if (topCities && topCities.length > 0) {
    html += '  <div>\n';
    html += '    <h3 class="text-lg font-semibold mb-3 text-gray-800">Popular Cities</h3>\n';
    html += '    <div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">\n';

    topCities.forEach((cityData) => {
      const countryName = getCountryName(cityData.country);
      const countrySlug = getCountrySlug(cityData.country);
      const stateSlug = generateSlug(cityData.state);
      const citySlug = generateSlug(cityData.city);
      const label = `${cityData.city}, ${cityData.state}`;

      html += '      <div>\n';
      html += `        <a href="/detectives/${countrySlug}/${stateSlug}/${citySlug}/" class="text-green-600 hover:text-green-800 hover:underline transition-colors font-medium" title="Find detectives in ${escapeHtml(label)}">${escapeHtml(label)}</a>\n`;
      html += `        <p class="text-xs text-gray-500 mt-1">${cityData.detectiveCount} detective${cityData.detectiveCount !== 1 ? "s" : ""}</p>\n`;
      html += '      </div>\n';
    });

    html += '    </div>\n';
    html += '  </div>\n';
  }

  html += '</section>\n';
  return html;
}

/**
 * Inject homepage authority HTML block at the marked injection point
 * Only injects for homepage (/) to avoid duplication elsewhere
 */
export function injectHomepageAuthorityHtml(
  htmlContent: string,
  authorityBlockHtml: string
): string {
  // Replace the injection marker with the authority block HTML
  // Only on homepage to prevent duplication
  return htmlContent.replace(
    /<!-- HOMEPAGE_AUTHORITY_INJECTION_POINT -->/,
    authorityBlockHtml
  );
}

// ============================================================================
// SERVICE + LOCATION SSR SEO INJECTION (Phase 1: Background Checks)
// ============================================================================

/**
 * Extracts service location route parameters
 * Matches: /services/background-checks/:country/:state/:city
 */
export function extractServiceLocationRouteParams(
  requestPath: string
): { category: string; countrySlug: string; stateSlug: string; citySlug: string } | null {
  const path = requestPath.replace(/\/+$/, '');
  const segments = path.split('/').filter(s => s);
  
  // Should be 5 segments: services, background-checks, country, state, city
  if (segments.length === 5 && segments[0] === 'services' && segments[1] === 'background-checks') {
    return {
      category: 'Background Check',
      countrySlug: segments[2],
      stateSlug: segments[3],
      citySlug: segments[4],
    };
  }
  
  return null;
}

/**
 * Resolves service location slugs to actual country/state/city using database lookup
 * Returns null if any location segment is not found
 */
export async function resolveServiceLocation(
  countrySlug: string,
  stateSlug: string,
  citySlug: string
): Promise<{ countryCode: string; countryName: string; stateName: string; cityName: string } | null> {
  try {
    // Import database tables
    const { countries, states, cities } = await import("../../shared/schema.ts");
    
    // Resolve country by slug
    const countryRows = await db
      .select({ id: countries.id, code: countries.code, name: countries.name })
      .from(countries)
      .where(eq(countries.slug, countrySlug));
    
    if (!countryRows || countryRows.length === 0) {
      console.log(`[Service SEO] Country not found: ${countrySlug}`);
      return null;
    }
    
    const countryRow = countryRows[0];
    
    // Resolve state by slug + country
    const stateRows = await db
      .select({ id: states.id, name: states.name })
      .from(states)
      .where(and(eq(states.countryId, countryRow.id), eq(states.slug, stateSlug)));
    
    if (!stateRows || stateRows.length === 0) {
      console.log(`[Service SEO] State not found: ${stateSlug} in country ${countryRow.code}`);
      return null;
    }
    
    const stateRow = stateRows[0];
    
    // Resolve city by slug + state
    const cityRows = await db
      .select({ id: cities.id, name: cities.name })
      .from(cities)
      .where(and(eq(cities.stateId, stateRow.id), eq(cities.slug, citySlug)));
    
    if (!cityRows || cityRows.length === 0) {
      console.log(`[Service SEO] City not found: ${citySlug} in state ${stateRow.name}`);
      return null;
    }
    
    const cityRow = cityRows[0];
    
    return {
      countryCode: countryRow.code,
      countryName: countryRow.name,
      stateName: stateRow.name,
      cityName: cityRow.name,
    };
  } catch (error) {
    console.error('[Service SEO] Error resolving location:', error);
    return null;
  }
}

/**
 * Generates SEO meta tags for service location pages
 */
export function generateServiceLocationSeoMetaTags(
  location: { countryName: string; stateName: string; cityName: string },
  serviceCount: number,
  canonicalUrl: string
): string {
  const title = `Background Check Services in ${location.cityName}, ${location.stateName} | Verified Detectives`;
  const description = `Compare ${serviceCount} verified background check providers in ${location.cityName}, ${location.stateName}. Reviews, pricing & direct contact details available.`;

  const metaTags = [
    `<title>${escapeHtml(title)}</title>`,
    `<meta name="description" content="${escapeHtml(description)}">`,
    `<meta name="robots" content="index, follow">`,
    `<meta property="og:type" content="website">`,
    `<meta property="og:url" content="${escapeHtml(canonicalUrl)}">`,
    `<meta property="og:title" content="${escapeHtml(title)}">`,
    `<meta property="og:description" content="${escapeHtml(description)}">`,
    `<meta property="og:site_name" content="Ask Detectives">`,
    `<meta name="twitter:card" content="summary_large_image">`,
    `<meta name="twitter:title" content="${escapeHtml(title)}">`,
    `<meta name="twitter:description" content="${escapeHtml(description)}">`,
    `<link rel="canonical" href="${escapeHtml(canonicalUrl)}">`,
  ];

  return metaTags.join('\n    ');
}

/**
 * Generates JSON-LD ItemList schema for services
 */
function generateServiceLocationItemListSchema(
  location: { countryName: string; stateName: string; cityName: string },
  services: Array<any>,
  canonicalUrl: string
): string {
  const locationLabel = `${location.cityName}, ${location.stateName}`;
  
  const itemListElement = services.slice(0, 20).map((service, index) => {
    const countrySlug = getCountrySlug(service.detective.country);
    const stateSlug = service.detective.state?.toLowerCase().replace(/\s+/g, "-") || "";
    const citySlug = service.detective.city?.toLowerCase().replace(/\s+/g, "-") || "";
    const serviceUrl = `https://www.askdetectives.com/service/${countrySlug}/${stateSlug}/${citySlug}/${service.detective.slug}/${service.slug}/`;
    
    return {
      "@type": "ListItem",
      "position": index + 1,
      "item": {
        "@type": "Service",
        "name": service.title,
        "url": serviceUrl,
        "description": service.description,
        "image": service.images?.[0] || service.detective.logo || "",
        "price": service.offerPrice || service.basePrice || "Contact",
        "priceCurrency": "INR",
        "provider": {
          "@type": "LocalBusiness",
          "name": service.detective.businessName,
          "logo": service.detective.logo,
          "areaServed": locationLabel,
        },
        "aggregateRating": service.reviewCount > 0 ? {
          "@type": "AggregateRating",
          "ratingValue": service.avgRating.toFixed(1),
          "reviewCount": service.reviewCount,
        } : undefined,
      },
    };
  });
  
  const itemList: any = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    "name": `Background Check Services in ${locationLabel}`,
    "description": `Directory of background check service providers in ${locationLabel}`,
    "url": canonicalUrl,
    "itemListElement": itemListElement.map(item => ({ ...item.item, position: item.position })),
  };
  
  return JSON.stringify(itemList, null, 2);
}

/**
 * Generates JSON-LD BreadcrumbList schema for service location pages
 */
function generateServiceLocationBreadcrumbSchema(
  location: { countrySlug: string; stateSlug: string; citySlug: string; countryName: string; stateName: string; cityName: string }
): string {
  const breadcrumbItems: any[] = [
    {
      "@type": "ListItem",
      "position": 1,
      "name": "Home",
      "item": "https://www.askdetectives.com",
    },
    {
      "@type": "ListItem",
      "position": 2,
      "name": "Services",
      "item": "https://www.askdetectives.com/services/",
    },
    {
      "@type": "ListItem",
      "position": 3,
      "name": "Background Checks",
      "item": "https://www.askdetectives.com/services/background-checks/",
    },
    {
      "@type": "ListItem",
      "position": 4,
      "name": location.countryName,
      "item": `https://www.askdetectives.com/services/background-checks/${location.countrySlug}/`,
    },
    {
      "@type": "ListItem",
      "position": 5,
      "name": location.stateName,
      "item": `https://www.askdetectives.com/services/background-checks/${location.countrySlug}/${location.stateSlug}/`,
    },
    {
      "@type": "ListItem",
      "position": 6,
      "name": location.cityName,
      "item": `https://www.askdetectives.com/services/background-checks/${location.countrySlug}/${location.stateSlug}/${location.citySlug}/`,
    },
  ];

  const breadcrumbs: any = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    "itemListElement": breadcrumbItems,
  };

  return JSON.stringify(breadcrumbs, null, 2);
}

/**
 * Generates JSON-LD schema for service location pages
 */
export function generateServiceLocationJsonLd(
  location: { countrySlug: string; stateSlug: string; citySlug: string; countryName: string; stateName: string; cityName: string },
  services: Array<any>,
  canonicalUrl: string
): { itemList: string; breadcrumbs: string } {
  return {
    itemList: generateServiceLocationItemListSchema({ countryName: location.countryName, stateName: location.stateName, cityName: location.cityName }, services, canonicalUrl),
    breadcrumbs: generateServiceLocationBreadcrumbSchema(location),
  };
}

/**
 * Injects service location SEO tags into HTML template
 */
export function injectServiceLocationSeoTags(
  htmlContent: string,
  location: { countrySlug: string; stateSlug: string; citySlug: string; countryName: string; stateName: string; cityName: string },
  services: Array<any>,
  canonicalUrl: string
): string {
  // STEP 1: Remove all existing default meta tags
  let modified = removeDefaultMetaTags(htmlContent);

  // STEP 2: Inject new SEO tags
  const metaTags = generateServiceLocationSeoMetaTags({ countryName: location.countryName, stateName: location.stateName, cityName: location.cityName }, services.length, canonicalUrl);
  const metaTagsArray = metaTags.split('\n');
  const titleTag = metaTagsArray[0];
  const otherTags = metaTagsArray.slice(1).join('\n    ');

  // Inject title at SEO_TITLE_INJECTION_POINT
  modified = modified.replace(
    /<!-- SEO_TITLE_INJECTION_POINT -->/,
    `<!-- SEO_TITLE_INJECTION_POINT -->\n    ${titleTag}`
  );

  // Inject meta tags at SEO_META_INJECTION_POINT
  modified = modified.replace(
    /<!-- SEO_META_INJECTION_POINT -->/,
    `<!-- SEO_META_INJECTION_POINT -->\n    ${otherTags}`
  );

  // Inject JSON-LD at SEO_JSON_LD_INJECTION_POINT
  const jsonLd = generateServiceLocationJsonLd(location, services, canonicalUrl);
  const jsonLdScripts = `<script type="application/ld+json">\n      ${jsonLd.itemList}\n    </script>\n    <script type="application/ld+json">\n      ${jsonLd.breadcrumbs}\n    </script>`;
  modified = modified.replace(
    /<!-- SEO_JSON_LD_INJECTION_POINT -->/,
    `<!-- SEO_JSON_LD_INJECTION_POINT -->\n    ${jsonLdScripts}`
  );

  return modified;
}

/**
 * Inject detective location authority link HTML for service cross-promotion
 * Called within detective location SSR handlers AFTER location resolution
 * Injects background check services cross-link into HTML template
 */
export function injectDetectiveLocationAuthorityLink(
  htmlContent: string,
  location: { countrySlug: string; stateSlug: string; citySlug: string; cityName: string; stateName: string },
  servicesExist: boolean
): string {
  if (!servicesExist) {
    return htmlContent;
  }

  // Generate authority link HTML block
  const authorityLinkHtml = `
    <div class="authority-link-block bg-amber-50 border border-amber-200 rounded-lg p-6 mb-8">
      <h2 class="text-xl font-semibold text-gray-900 mb-3">Background Check Services in ${escapeHtml(location.cityName)}</h2>
      <p class="text-gray-700 mb-4 leading-relaxed">
        Looking for professional background verification services in ${escapeHtml(location.cityName)}? Compare trusted investigators specializing in employment screening, tenant checks, and criminal record verification.
      </p>
      <a href="/services/background-checks/${location.countrySlug}/${location.stateSlug}/${location.citySlug}/" class="inline-flex items-center gap-2 text-blue-600 hover:text-blue-800 font-medium transition-colors" aria-label="Explore background check services in ${escapeHtml(location.cityName)}, ${escapeHtml(location.stateName)}">
        Browse Background Check Services
        <svg class="h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path><polyline points="15 3 21 3 21 9"></polyline><line x1="10" y1="14" x2="21" y2="3"></line></svg>
      </a>
    </div>
  `;

  // Inject after H1 tag (within main content, before React hydration)
  // Pattern: find </h1> and inject after it + next <p> tag if exists
  const h1CloseIndex = htmlContent.indexOf('</h1>');
  if (h1CloseIndex === -1) {
    return htmlContent;
  }

  // Find the next paragraph after H1 for context
  const afterH1 = htmlContent.substring(h1CloseIndex);
  const pEndIndex = afterH1.indexOf('</p>');
  
  if (pEndIndex !== -1) {
    const insertIndex = h1CloseIndex + afterH1.substring(0, pEndIndex).length + 4; // +4 for </p>
    return htmlContent.substring(0, insertIndex) + authorityLinkHtml + htmlContent.substring(insertIndex);
  }

  // Fallback: inject right after </h1>
  return htmlContent.substring(0, h1CloseIndex + 5) + authorityLinkHtml + htmlContent.substring(h1CloseIndex + 5);
}
