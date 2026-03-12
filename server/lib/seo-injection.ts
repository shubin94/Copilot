// --- Cache-backed slug resolvers for state and city ---
const stateSlugCache = new Map<string, string>();
const citySlugCache = new Map<string, string>();
const countrySlugCache = new Map<string, string>();
const countryRecordCache = new Map<string, { id: number; slug: string }>();

function slugifySegment(value: string | undefined | null): string {
  return String(value || "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");
}

async function resolveCountryRecord(countryCodeOrName: string | undefined): Promise<{ id: number; slug: string } | null> {
  if (!countryCodeOrName) return null;
  const cacheKey = countryCodeOrName.toLowerCase().trim();
  const cachedRecord = countryRecordCache.get(cacheKey);
  if (cachedRecord) return cachedRecord;

  try {
    const row = await db.query.countries.findFirst({
      where: or(
        eq(countries.slug, cacheKey),
        eq(countries.code, countryCodeOrName.toUpperCase()),
        ilike(countries.name, countryCodeOrName)
      ),
    });

    if (!row) return null;

    const record = { id: row.id, slug: row.slug };
    countryRecordCache.set(cacheKey, record);
    countrySlugCache.set(cacheKey, row.slug);
    return record;
  } catch {
    return null;
  }
}

async function resolveCountrySlug(countryCodeOrName: string | undefined): Promise<string> {
  if (!countryCodeOrName) return "";
  const cacheKey = countryCodeOrName.toLowerCase().trim();
  const cached = countrySlugCache.get(cacheKey);
  if (cached) return cached;

  const countryRecord = await resolveCountryRecord(countryCodeOrName);
  const resolved = countryRecord?.slug ?? slugifySegment(countryCodeOrName);
  if (!countryRecord) {
    console.warn("[SEO] Country canonical slug not found; using fallback slugify", {
      input: countryCodeOrName,
      fallbackSlug: resolved,
    });
  }
  countrySlugCache.set(cacheKey, resolved);
  return resolved;
}

/**
 * Resolves state slug via database (canonical slug), with cache fallback.
 */
async function resolveStateSlug(stateName: string | undefined, countryCode: string | undefined): Promise<string> {
  if (!stateName || !countryCode) return "";
  const key = `${countryCode}:${stateName}`;
  const cached = stateSlugCache.get(key);
  if (cached) return cached;

  const fallbackSlug = slugifySegment(stateName);

  try {
    const countryRecord = await resolveCountryRecord(countryCode);
    if (countryRecord) {
      const stateRow = await db.query.states.findFirst({
        where: and(
          eq(states.countryId, countryRecord.id),
          or(
            eq(states.slug, fallbackSlug),
            ilike(states.name, stateName)
          )
        ),
      });

      if (stateRow?.slug) {
        stateSlugCache.set(key, stateRow.slug);
        return stateRow.slug;
      }
    }
  } catch {
    // fallback below
  }

  const slug = fallbackSlug;
  stateSlugCache.set(key, slug);
  return slug;
}

/**
 * Resolves city slug via database (canonical slug), with cache fallback.
 */
async function resolveCitySlug(cityName: string | undefined, stateName: string | undefined, countryCode: string | undefined): Promise<string> {
  if (!cityName || !stateName || !countryCode) return "";
  const key = `${countryCode}:${stateName}:${cityName}`;
  const cached = citySlugCache.get(key);
  if (cached) return cached;

  const fallbackStateSlug = slugifySegment(stateName);
  const fallbackCitySlug = slugifySegment(cityName);

  try {
    const countryRecord = await resolveCountryRecord(countryCode);
    if (countryRecord) {
      const stateRow = await db.query.states.findFirst({
        where: and(
          eq(states.countryId, countryRecord.id),
          or(
            eq(states.slug, fallbackStateSlug),
            ilike(states.name, stateName)
          )
        ),
      });

      if (stateRow?.id) {
        const cityRow = await db.query.cities.findFirst({
          where: and(
            eq(cities.stateId, stateRow.id),
            or(
              eq(cities.slug, fallbackCitySlug),
              ilike(cities.name, cityName)
            )
          ),
        });

        if (cityRow?.slug) {
          citySlugCache.set(key, cityRow.slug);
          return cityRow.slug;
        }
      }
    }
  } catch {
    // fallback below
  }

  const slug = fallbackCitySlug;
  citySlugCache.set(key, slug);
  return slug;
}
/**
 * Builds homepage authority HTML block for SSR injection
 */
export function buildHomepageAuthorityHtml(
  countries: Array<{ country: string; detectiveCount: number }>,
  statesByCountry: Record<string, Array<{ state: string; detectiveCount: number }>>,
  citiesByCountryState: Record<string, Array<{ city: string; detectiveCount: number }>>
): string {
  // Simple HTML block for homepage authority injection
  let html = '<section class="homepage-authority-block">\n';
  html += '<h2>Top Detective Locations</h2>\n';
  html += '<ul>\n';
  for (const country of countries) {
    html += `<li><strong>${country.country}</strong> (${country.detectiveCount} detectives)`;
    const states = statesByCountry[country.country] || [];
    if (states.length > 0) {
      html += '<ul>\n';
      for (const state of states) {
        html += `<li>${state.state} (${state.detectiveCount})`;
        const cities = citiesByCountryState[`${country.country}|${state.state}`] || [];
        if (cities.length > 0) {
          html += '<ul>\n';
          for (const city of cities) {
            html += `<li>${city.city} (${city.detectiveCount})</li>\n`;
          }
          html += '</ul>\n';
        }
        html += '</li>\n';
      }
      html += '</ul>\n';
    }
    html += '</li>\n';
  }
  html += '</ul>\n';
  html += '</section>\n';
  return html;
}
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

import { db, pool } from "../../db/index.js";
import { detectives, countries, states, cities } from "../../shared/schema.js";
import { eq, and, or, ilike, desc, sql } from "drizzle-orm";
import { computeEffectiveBadges } from "../services/entitlements.js";

/**
 * ✅ OPTIMIZATION: In-memory cache for location resolution (country/state/city IDs)
 * Key format: "${country.toLowerCase()}-${state?.toLowerCase() || ''}-${city?.toLowerCase() || ''}"
 * This prevents redundant database queries for duplicate locations on the same page
 * Cache is persistent across requests within the same Lambda instance (warm start)
 */
interface LocationResolution {
  countryId: number | null;
  stateId: number | null;
  cityId: number | null;
  countryName: string;
  stateName: string;
  cityName: string;
}
const locationCache = new Map<string, LocationResolution>();

type DetectiveSeoRow = {
  id: string;
  businessName: string | null;
  bio: string | null;
  logo: string | null;
  country: string;
  state: string;
  city: string;
  location: string;
  phone: string | null;
  whatsapp: string | null;
  contactEmail: string | null;
  businessWebsite: string | null;
  slug: string;
  createdAt: string;
};

const DETECTIVE_SEO_SELECT_SQL = `
  SELECT
    d.id,
    d.business_name AS "businessName",
    d.bio,
    d.logo,
    d.country,
    d.state,
    d.city,
    d.location,
    d.phone,
    d.whatsapp,
    d.contact_email AS "contactEmail",
    d.business_website AS "businessWebsite",
    d.slug,
    d.created_at AS "createdAt"
  FROM detectives d
`;

async function fetchDetectiveSeoRow(
  whereClause: string,
  params: unknown[],
  joinClause = ""
): Promise<DetectiveSeoRow | null> {
  const query = `
    ${DETECTIVE_SEO_SELECT_SQL}
    ${joinClause}
    WHERE ${whereClause}
    ORDER BY d.created_at DESC
    LIMIT 1
  `;

  const result = await pool.query(query, params);
  return (result.rows[0] as DetectiveSeoRow) || null;
}

async function fetchDetectiveRatings(detectiveId: string): Promise<{ avgRating: number; reviewCount: number }> {
  const ratingsResult = await pool.query(
    `
      SELECT
        COALESCE(AVG(r.rating), 0)::numeric AS "avgRating",
        COUNT(r.id)::int AS "reviewCount"
      FROM services s
      LEFT JOIN reviews r
        ON r.service_id = s.id
       AND r.is_published = true
       AND r.rating IS NOT NULL
      WHERE s.detective_id = $1
    `,
    [detectiveId]
  );

  return {
    avgRating: Number(ratingsResult.rows[0]?.avgRating || 0),
    reviewCount: Number(ratingsResult.rows[0]?.reviewCount || 0),
  };
}

function isMissingColumnError(error: unknown, columnName: string): boolean {
  if (!(error instanceof Error)) return false;
  const message = error.message.toLowerCase();
  return message.includes(`column "${columnName.toLowerCase()}" does not exist`);
}

async function fetchDetectiveSeoOverride(detectiveId: string): Promise<{ metaTitle?: string | null; metaDescription?: string | null; h1?: string | null } | null> {
  try {
    try {
      const seoResult = await pool.query(
        `
          SELECT
            meta_title AS "metaTitle",
            meta_description AS "metaDescription",
            h1
          FROM location_seo_overrides
          WHERE entity_type = 'detective'
            AND entity_id = $1::text
          ORDER BY updated_at DESC NULLS LAST, created_at DESC NULLS LAST
          LIMIT 1
        `,
        [detectiveId]
      );
      return seoResult.rows[0] || null;
    } catch (primaryError) {
      if (!isMissingColumnError(primaryError, "updated_at")) {
        throw primaryError;
      }

      console.warn("[SEO] location_seo_overrides.updated_at missing; using created_at fallback for detective override query", {
        detectiveId,
      });

      const fallbackResult = await pool.query(
        `
          SELECT
            meta_title AS "metaTitle",
            meta_description AS "metaDescription",
            h1
          FROM location_seo_overrides
          WHERE entity_type = 'detective'
            AND entity_id = $1::text
          ORDER BY created_at DESC NULLS LAST
          LIMIT 1
        `,
        [detectiveId]
      );
      return fallbackResult.rows[0] || null;
    }
  } catch (seoError) {
    console.warn("[SEO] Failed to fetch detective SEO override:", {
      detectiveId,
      message: seoError instanceof Error ? seoError.message : String(seoError),
    });
    return null;
  }
}

export async function getDetectiveBySlugForSEO(
  country: string,
  state: string,
  city: string,
  slug: string
): Promise<any | null> {
  try {
    const countrySlug = country.toLowerCase();
    const stateSlug = state.toLowerCase();
    const citySlug = city.toLowerCase();
    const detectiveSlug = slug.toLowerCase();

    // Primary lookup path: match by canonical location slugs.
    let detective = await fetchDetectiveSeoRow(
      `
        LOWER(c.slug) = $1
        AND LOWER(s.slug) = $2
        AND LOWER(ct.slug) = $3
        AND LOWER(d.slug) = $4
      `,
      [countrySlug, stateSlug, citySlug, detectiveSlug],
      `
        INNER JOIN countries c ON c.id = d.country_id
        INNER JOIN states s ON s.id = d.state_id
        INNER JOIN cities ct ON ct.id = d.city_id
      `
    );

    // Fallback path: match with text columns if FK/slug data is inconsistent.
    if (!detective) {
      const countryRow = await db.query.countries.findFirst({
        where: eq(countries.slug, countrySlug),
      });
      const countryCode = countryRow?.code || country.toUpperCase();
      const countryName = countryRow?.name || country.replace(/-/g, " ");

      detective = await fetchDetectiveSeoRow(
        `
          LOWER(d.slug) = $1
          AND LOWER(TRIM(d.state)) = $2
          AND LOWER(TRIM(d.city)) = $3
          AND (
            UPPER(TRIM(d.country)) = UPPER(TRIM($4))
            OR LOWER(TRIM(d.country)) = LOWER(TRIM($5))
          )
        `,
        [detectiveSlug, stateSlug, citySlug, countryCode, countryName]
      );
    }

    if (!detective) return null;

    const { avgRating, reviewCount } = await fetchDetectiveRatings(detective.id);
    const seoOverride = await fetchDetectiveSeoOverride(detective.id);

    return { ...detective, avgRating, reviewCount, seoOverride };
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
  const name = detective.businessName || `${detective.firstName || ""} ${detective.lastName || ""}`.trim() || "Detective";
  const location = detective.city && detective.state
    ? `${detective.city}, ${detective.state}`
    : detective.city || detective.location || "";

  const fallbackDescription = detective.bio
    ? String(detective.bio).substring(0, 155)
    : `Professional private investigator services${location ? ` in ${location}` : ""}`;

  const fallbackTitle = `${name} - Private Detective${location ? ` in ${location}` : ""} | Ask Detectives`;
  const title = detective?.seoOverride?.metaTitle?.trim() || fallbackTitle;
  const shortDescription = detective?.seoOverride?.metaDescription?.trim() || fallbackDescription;

  return [
    `<title>${escapeHtml(title)}</title>`,
    `<meta name="description" content="${escapeHtml(shortDescription)}" />`,
    `<meta property="og:title" content="${escapeHtml(title)}" />`,
    `<meta property="og:description" content="${escapeHtml(shortDescription)}" />`,
    `<meta property="og:url" content="${escapeHtml(canonicalUrl)}" />`,
    `<meta property="og:type" content="profile" />`,
    detective.logo ? `<meta property="og:image" content="${escapeHtml(detective.logo)}" />` : "",
    `<meta name="twitter:title" content="${escapeHtml(title)}" />`,
    `<meta name="twitter:description" content="${escapeHtml(shortDescription)}" />`,
    detective.logo ? `<meta name="twitter:image" content="${escapeHtml(detective.logo)}" />` : "",
    `<link rel="canonical" href="${escapeHtml(canonicalUrl)}" />`,
  ]
    .filter(Boolean)
    .join("\n    ");
}

/**
 * Maps country values (slug/code/name) into canonical country slug.
 */
export function getCountrySlug(country: string): string {
  if (!country) return "";
  const trimmed = country.trim();
  const direct = trimmed.toLowerCase();

  const codeToSlug: Record<string, string> = {
    IN: "india",
    US: "united-states",
    GB: "united-kingdom",
    UK: "united-kingdom",
    CA: "canada",
    AU: "australia",
    DE: "germany",
    FR: "france",
    IT: "italy",
    ES: "spain",
    NZ: "new-zealand",
    IE: "ireland",
    SG: "singapore",
    MY: "malaysia",
    PH: "philippines",
    TH: "thailand",
    VN: "vietnam",
    PK: "pakistan",
    BD: "bangladesh",
    ZA: "south-africa",
    AE: "united-arab-emirates",
    KW: "kuwait",
    SA: "saudi-arabia",
    QA: "qatar",
    OM: "oman",
    JP: "japan",
    CN: "china",
    HK: "hong-kong",
    MX: "mexico",
    BR: "brazil",
    AR: "argentina",
    CL: "chile",
  };

  if (codeToSlug[trimmed.toUpperCase()]) {
    return codeToSlug[trimmed.toUpperCase()];
  }

  if (direct.includes("-")) {
    return direct;
  }

  return slugifySegment(trimmed);
}

/**
 * Maps country values (code/slug) into human-readable country name.
 */
function getCountryName(country: string): string {
  if (!country) return "";

  const codeToName: Record<string, string> = {
    IN: "India",
    US: "United States",
    GB: "United Kingdom",
    UK: "United Kingdom",
    CA: "Canada",
    AU: "Australia",
    DE: "Germany",
    FR: "France",
    IT: "Italy",
    ES: "Spain",
    NZ: "New Zealand",
    IE: "Ireland",
    SG: "Singapore",
    MY: "Malaysia",
    PH: "Philippines",
    TH: "Thailand",
    VN: "Vietnam",
    PK: "Pakistan",
    BD: "Bangladesh",
    ZA: "South Africa",
    AE: "United Arab Emirates",
    KW: "Kuwait",
    SA: "Saudi Arabia",
    QA: "Qatar",
    OM: "Oman",
    JP: "Japan",
    CN: "China",
    HK: "Hong Kong",
    MX: "Mexico",
    BR: "Brazil",
    AR: "Argentina",
    CL: "Chile",
  };

  const normalized = country.trim();
  if (codeToName[normalized.toUpperCase()]) {
    return codeToName[normalized.toUpperCase()];
  }

  if (normalized.includes("-")) {
    return normalized
      .split("-")
      .map((token) => token.charAt(0).toUpperCase() + token.slice(1))
      .join(" ");
  }

  return normalized;
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
  const countrySlug = getCountrySlug(detective.country || "");
  const stateSlug = slugifySegment(detective.state);
  const citySlug = slugifySegment(detective.city);

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

  // Inject H1 at SEO_H1_INJECTION_POINT (present in raw HTML source)
  const detectiveName = detective.businessName || `${detective.firstName || ""} ${detective.lastName || ""}`.trim() || "Detective";
  const countryName = getCountryName(detective.country || "");
  const defaultH1 = detective.city
    ? `${detectiveName} - Private Investigator in ${detective.city}, ${countryName || detective.country || ""}`
    : `${detectiveName} - Private Investigator`;
  const h1Value = detective?.seoOverride?.h1 || defaultH1;

  modified = modified.replace(
    /<!-- SEO_H1_INJECTION_POINT -->/,
    `<!-- SEO_H1_INJECTION_POINT -->\n    <noscript><h1>${escapeHtml(h1Value)}</h1></noscript>`
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
  limit?: number,
  offset?: number
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
    avgRating: number;
    reviewCount: number;
    effectiveBadges: { blueTick: boolean; pro: boolean; recommended: boolean };
  }>;
  hasMore: boolean;
  location: { country: string; state?: string; city?: string };
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

    const normalizeToSlug = (value: string): string => {
      return value
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "");
    };

    const getCountryCodeFromSlug = (countrySlugValue: string): string | undefined => {
      try {
        const displayNames = new Intl.DisplayNames(["en"], { type: "region" });
        for (let first = 65; first <= 90; first += 1) {
          for (let second = 65; second <= 90; second += 1) {
            const code = String.fromCharCode(first) + String.fromCharCode(second);
            const name = displayNames.of(code);
            if (!name || name === code) continue;
            if (normalizeToSlug(name) === countrySlugValue.toLowerCase()) {
              return code;
            }
          }
        }
      } catch (_error) {
        // Ignore runtime locale issues and fallback to title-case country matching
      }
      return undefined;
    };


    // Build query conditions using only country_id, state_id, city_id
    const limitValue = typeof limit === "number" && limit > 0 ? Math.floor(limit) : 15;
    const offsetValue = typeof offset === "number" && offset > 0 ? Math.floor(offset) : 0;

    // Resolve country by slug
    const countrySlug = country.toLowerCase();
    const countryRows = await db
      .select({ id: countries.id, name: countries.name, code: countries.code })
      .from(countries)
      .where(eq(countries.slug, countrySlug))
      .limit(1);
    const resolvedCountryId = countryRows[0]?.id;
    const resolvedCountryCode = countryRows[0]?.code;
    const resolvedCountryName = countryRows[0]?.name;
    if (!resolvedCountryId) {
      return { detectives: [], hasMore: false, location: { country } };
    }

    // Resolve state by slug and countryId
    let resolvedStateId: string | undefined = undefined;
    let resolvedStateName: string | undefined = undefined;
    if (state) {
      const stateRows = await db
        .select({ id: states.id, name: states.name })
        .from(states)
        .where(and(eq(states.countryId, resolvedCountryId), eq(states.slug, state.toLowerCase())))
        .limit(1);
      resolvedStateId = stateRows[0]?.id;
      resolvedStateName = stateRows[0]?.name;
      if (!resolvedStateId) {
        resolvedStateName = undefined;
        return { detectives: [], hasMore: false, location: { country, state } };
      }
    }

    // Resolve city by slug and stateId
    let resolvedCityId: string | undefined = undefined;
    let resolvedCityName: string | undefined = undefined;
    if (city && resolvedStateId) {
      const cityRows = await db
        .select({ id: cities.id, name: cities.name })
        .from(cities)
        .where(and(eq(cities.stateId, resolvedStateId), eq(cities.slug, city.toLowerCase())))
        .limit(1);
      resolvedCityId = cityRows[0]?.id;
      resolvedCityName = cityRows[0]?.name;
      if (!resolvedCityId) {
        resolvedCityName = undefined;
        return { detectives: [], hasMore: false, location: { country, state, city } };
      }
    }

    // Build detective filter conditions
    let conditions = [eq(detectives.status, "active"), eq(detectives.countryId, resolvedCountryId)];
    if (resolvedStateId) {
      conditions.push(eq(detectives.stateId, resolvedStateId));
    }
    if (resolvedCityId) {
      conditions.push(eq(detectives.cityId, resolvedCityId));
    }

    console.log("[Location SEO] Querying detectives for location:", {
      country,
      state,
      city,
    });

    // Query detectives with limit + 1 for efficient pagination (no COUNT needed)
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
      })
      .from(detectives)
      .where(and(...conditions))
      .orderBy(desc(detectives.lastActive))
      .limit(limitValue + 1)
      .offset(offsetValue);

    // Determine if there are more results beyond the limit
    const hasMore = rows.length > limitValue;
    const limitedRows = hasMore ? rows.slice(0, limitValue) : rows;

    const detectiveIds = limitedRows.map((row) => row.id).filter((id): id is string => typeof id === "string" && id.length > 0);
    const ratingsByDetective = new Map<string, { avgRating: number; reviewCount: number }>();
    if (detectiveIds.length > 0) {
      const ratingRows = await pool.query<{
        detective_id: string;
        avg_rating: string | null;
        review_count: string | null;
      }>(
        `
          SELECT s.detective_id,
                 AVG(sr.service_avg)::numeric AS avg_rating,
                 SUM(sr.review_count)::int AS review_count
          FROM services s
          INNER JOIN (
            SELECT r.service_id,
                   AVG(r.rating)::numeric AS service_avg,
                   COUNT(*)::int AS review_count
            FROM reviews r
            WHERE r.is_published = true
            GROUP BY r.service_id
          ) sr ON sr.service_id = s.id
          WHERE s.is_active = true
            AND s.detective_id = ANY($1::varchar[])
          GROUP BY s.detective_id
        `,
        [detectiveIds]
      );

      for (const ratingRow of ratingRows.rows) {
        ratingsByDetective.set(ratingRow.detective_id, {
          avgRating: parseFloat(ratingRow.avg_rating ?? "0") || 0,
          reviewCount: parseInt(ratingRow.review_count ?? "0", 10) || 0,
        });
      }
    }

    console.log("[Location SEO] Query returned", limitedRows.length, "detectives (hasMore:", hasMore, ") for", { country, state, city, offset: offsetValue });

    // Compute effectiveBadges for each detective
    const detectivesWithBadges = limitedRows.map((row) => {
      const effectiveBadges = computeEffectiveBadges({
        subscriptionPackageId: row.subscriptionPackageId,
        subscriptionExpiresAt: row.subscriptionExpiresAt,
        blueTickAddon: row.blueTickAddon,
      });

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
        avgRating: ratingsByDetective.get(row.id)?.avgRating ?? 0,
        reviewCount: ratingsByDetective.get(row.id)?.reviewCount ?? 0,
        effectiveBadges,
      };
    });

    return {
      detectives: detectivesWithBadges,
      hasMore,
      location: { country, state, city },
    };
  } catch (error) {
    console.error("[SEO] Error fetching location detectives:", error);
    return {
      detectives: [],
      hasMore: false,
      location: { country, state, city },
    };
  }
}

/**
 * ✅ OPTIMIZATION: Resolves location IDs with in-memory caching
 * Cache key: "${country.toLowerCase()}-${state?.toLowerCase() || ''}-${city?.toLowerCase() || ''}"
 * On cache hit: Returns immediately without database queries
 * On cache miss: Queries countries/states/cities, stores in cache, returns result
 * This is especially effective on SSR pages where the same location may be queried multiple times
 */
export async function resolveLocationIds(
  location: { country: string; state?: string; city?: string }
): Promise<LocationResolution> {
  // Build cache key
  const cacheKey = `${location.country.toLowerCase()}-${location.state?.toLowerCase() || ''}-${location.city?.toLowerCase() || ''}`;
  
  // ✅ CACHE HIT: Return immediately
  if (locationCache.has(cacheKey)) {
    console.log(`[Location Cache] HIT for ${cacheKey}`);
    return locationCache.get(cacheKey)!;
  }

  console.log(`[Location Cache] MISS for ${cacheKey}, querying database...`);

  // Initialize result with defaults
  const result: LocationResolution = {
    countryId: null,
    stateId: null,
    cityId: null,
    countryName: location.country,
    stateName: location.state || "",
    cityName: location.city || "",
  };

  try {
    // Resolve country ID and name
    const countrySlug = location.country.toLowerCase();
    const countryResult = await db
      .select({ id: countries.id, name: countries.name })
      .from(countries)
      .where(eq(countries.slug, countrySlug))
      .limit(1);
    
    if (countryResult.length > 0) {
      result.countryId = countryResult[0].id;
      result.countryName = countryResult[0].name;
    }

    // Resolve state ID and name if state exists
    if (location.state && result.countryId) {
      const stateSlug = location.state.toLowerCase();
      const stateResult = await db
        .select({ id: states.id, name: states.name })
        .from(states)
        .where(and(
          eq(states.slug, stateSlug),
          eq(states.countryId, result.countryId)
        ))
        .limit(1);
      
      if (stateResult.length > 0) {
        result.stateId = stateResult[0].id;
        result.stateName = stateResult[0].name;
      }
    }

    // Resolve city ID and name if city exists
    if (location.city && result.stateId) {
      const citySlug = location.city.toLowerCase();
      const cityResult = await db
        .select({ id: cities.id, name: cities.name })
        .from(cities)
        .where(and(
          eq(cities.slug, citySlug),
          eq(cities.stateId, result.stateId)
        ))
        .limit(1);
      
      if (cityResult.length > 0) {
        result.cityId = cityResult[0].id;
        result.cityName = cityResult[0].name;
      }
    }
  } catch (error) {
    console.error('[Location Cache] Error resolving location IDs:', error);
    // Continue with null IDs and display names
  }

  // ✅ CACHE MISS: Store in cache for future requests
  locationCache.set(cacheKey, result);
  console.log(`[Location Cache] STORED ${cacheKey}`);

  return result;
}

/**
 * Generates SEO meta tags for location listing pages
 */
export async function generateLocationSeoMetaTags(
  location: { country: string; state?: string; city?: string },
  totalCount: number,
  canonicalUrl: string,
  resolvedLocation?: LocationResolution
): Promise<{ html: string; title: string; description: string; h1: string }> {
  const year = new Date().getFullYear();

  // ✅ OPTIMIZATION: Use provided resolved location, or resolve if not provided
  // This allows callers to resolve location once and reuse across multiple functions
  const locationIds = resolvedLocation || await resolveLocationIds(location);
  const countryId = locationIds.countryId;
  const stateId = locationIds.stateId;
  const cityId = locationIds.cityId;
  const countryName = locationIds.countryName;
  const stateName = locationIds.stateName;
  const cityName = locationIds.cityName;

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
async function generateLocationItemListSchema(
  location: { country: string; state?: string; city?: string },
  detectives: Array<{ slug: string; businessName: string; city: string; state: string; country: string }>,
  canonicalUrl: string
): Promise<string> {
  const locationLabel = [location.city, location.state, location.country]
    .filter(Boolean)
    .join(", ");

  // Build a unique set of country codes and resolve all slugs with controlled concurrency
  const uniqueCountryCodes = [...new Set(detectives.map(d => d.country))];
  const countrySlugMap = new Map<string, string>();
  for (const code of uniqueCountryCodes) {
    countrySlugMap.set(code, await resolveCountrySlug(code));
  }

  // Build state/city slug maps for all unique (state, country) and (city, state, country) combos
  const uniqueStates = new Set(detectives.map(d => `${d.state}|${d.country}`));
  const stateSlugMap = new Map<string, string>();
  for (const key of uniqueStates) {
    const [state, country] = key.split("|");
    stateSlugMap.set(key, await resolveStateSlug(state, country));
  }

  const uniqueCities = new Set(detectives.map(d => `${d.city}|${d.state}|${d.country}`));
  const citySlugMap = new Map<string, string>();
  for (const key of uniqueCities) {
    const [city, state, country] = key.split("|");
    citySlugMap.set(key, await resolveCitySlug(city, state, country));
  }

  const itemListElement = detectives.slice(0, 10).map((detective, index) => {
    const countrySlug = countrySlugMap.get(detective.country)!;
    const stateKey = `${detective.state}|${detective.country}`;
    const cityKey = `${detective.city}|${detective.state}|${detective.country}`;
    const stateSlug = stateSlugMap.get(stateKey) || "";
    const citySlug = citySlugMap.get(cityKey) || "";
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
async function generateLocationBreadcrumbSchema(
  location: { country: string; state?: string; city?: string }
): Promise<string> {
  const countrySlug = await resolveCountrySlug(location.country);
  const stateSlug = await resolveStateSlug(location.state, location.country);
  const citySlug = await resolveCitySlug(location.city, location.state, location.country);

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
      "name": getCountryName(location.country),
      "item": `https://www.askdetectives.com/detectives/${countrySlug}/`,
    },
  ];

  if (stateSlug) {
    breadcrumbItems.push({
      "@type": "ListItem",
      "position": 3,
      "name": location.state,
      "item": `https://www.askdetectives.com/detectives/${countrySlug}/${stateSlug}/`,
    });
  }

  if (citySlug) {
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
export async function generateLocationJsonLd(
  location: { country: string; state?: string; city?: string },
  detectives: Array<{ slug: string; businessName: string; city: string; state: string; country: string }>,
  canonicalUrl: string
): Promise<{ itemList: string; breadcrumbs: string }> {
  return {
    itemList: await generateLocationItemListSchema(location, detectives, canonicalUrl),
    breadcrumbs: await generateLocationBreadcrumbSchema(location),
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
  totalCount: number,
  resolvedLocation?: LocationResolution
): Promise<string> {
  // STEP 1: Remove all existing default meta tags
  let modified = removeDefaultMetaTags(htmlContent);

  // STEP 2: Inject new SEO tags (now async with override support)
  // ✅ Pass resolved location to avoid duplicate queries
  const seoData = await generateLocationSeoMetaTags(location, totalCount, canonicalUrl, resolvedLocation);
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
  const jsonLd = await generateLocationJsonLd(
    location,
    detectives,
    canonicalUrl
  );
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
        totalCount: ${totalCount}
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
  _totalCount: number
): Promise<string> {

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


/**
 * Inject homepage authority HTML block at the marked injection point
 * Only injects for homepage (/) to avoid duplication elsewhere
 */


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
async function generateServiceLocationItemListSchema(
  location: { countryName: string; stateName: string; cityName: string },
  services: Array<any>,
  canonicalUrl: string
): Promise<string> {
  const locationLabel = `${location.cityName}, ${location.stateName}`;

  // Build a unique set of country codes and resolve all slugs with controlled concurrency
  const uniqueCountryCodes = [...new Set(services.map(s => s.detective.country))];
  const countrySlugMap = new Map<string, string>();
  for (const code of uniqueCountryCodes) {
    countrySlugMap.set(code, await resolveCountrySlug(code));
  }

  // Build state/city slug maps for all unique (state, country) and (city, state, country) combos
  const uniqueStates = new Set(services.map(s => `${s.detective.state}|${s.detective.country}`));
  const stateSlugMap = new Map<string, string>();
  for (const key of uniqueStates) {
    const [state, country] = key.split("|");
    stateSlugMap.set(key, await resolveStateSlug(state, country));
  }

  const uniqueCities = new Set(services.map(s => `${s.detective.city}|${s.detective.state}|${s.detective.country}`));
  const citySlugMap = new Map<string, string>();
  for (const key of uniqueCities) {
    const [city, state, country] = key.split("|");
    citySlugMap.set(key, await resolveCitySlug(city, state, country));
  }

  const itemListElement = services.slice(0, 20).map((service, index) => {
    const countrySlug = countrySlugMap.get(service.detective.country)!;
    const stateKey = `${service.detective.state}|${service.detective.country}`;
    const cityKey = `${service.detective.city}|${service.detective.state}|${service.detective.country}`;
    const stateSlug = stateSlugMap.get(stateKey) || "";
    const citySlug = citySlugMap.get(cityKey) || "";
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
export async function generateServiceLocationJsonLd(
  location: { countrySlug: string; stateSlug: string; citySlug: string; countryName: string; stateName: string; cityName: string },
  services: Array<any>,
  canonicalUrl: string
): Promise<{ itemList: string; breadcrumbs: string }> {
  return {
    itemList: await generateServiceLocationItemListSchema(
      { countryName: location.countryName, stateName: location.stateName, cityName: location.cityName },
      services,
      canonicalUrl
    ),
    breadcrumbs: generateServiceLocationBreadcrumbSchema(location),
  };
}

/**
 * Injects service location SEO tags into HTML template
 */
export async function injectServiceLocationSeoTags(
  htmlContent: string,
  location: { countrySlug: string; stateSlug: string; citySlug: string; countryName: string; stateName: string; cityName: string },
  services: Array<any>,
  canonicalUrl: string
): Promise<string> {
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
  const jsonLd = await generateServiceLocationJsonLd(location, services, canonicalUrl);
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

