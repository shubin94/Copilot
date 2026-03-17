/**
 * Programmatic SEO generator for detective pages
 */
export function generateDetectiveSeo(country: string, state?: string, city?: string): { h1: string; meta_title: string; meta_description: string } {
  const cityName = city ? toTitleFromSlug(city) : (state ? toTitleFromSlug(state) : undefined);
  const countryName = toTitleFromSlug(country);
  if (cityName) {
    return {
      h1: `Private Detectives in ${cityName}, ${countryName}`,
      meta_title: `Private Detectives in ${cityName} | AskDetectives`,
      meta_description: `Hire verified private detectives in ${cityName}, ${countryName}. Compare investigators and get confidential services.`
    };
  } else if (state) {
    const stateName = toTitleFromSlug(state);
    return {
      h1: `Private Detectives in ${stateName}, ${countryName}`,
      meta_title: `Private Detectives in ${stateName} | AskDetectives`,
      meta_description: `Hire verified private detectives in ${stateName}, ${countryName}. Compare investigators and get confidential services.`
    };
  } else {
    return {
      h1: `Private Detectives in ${countryName}`,
      meta_title: `Private Detectives in ${countryName} | AskDetectives`,
      meta_description: `Hire verified private detectives in ${countryName}. Compare investigators and get confidential services.`
    };
  }
}

/**
 * Programmatic SEO generator for service location pages
 */
export function generateServiceLocationSeo(service: string, country: string, city: string, area: string): { h1: string; meta_title: string; meta_description: string } {
  const serviceName = toTitleFromSlug(service);
  const areaName = toTitleFromSlug(area);
  const cityName = toTitleFromSlug(city);
  return {
    h1: `${serviceName} in ${areaName}, ${cityName}`,
    meta_title: `${serviceName} in ${areaName}, ${cityName} | AskDetectives`,
    meta_description: `Find trusted ${serviceName} in ${areaName}, ${cityName}. Compare investigators and hire professionals.`
  };
}
/**
 * Fetches SEO for detective location with fallback
 */
export async function getDetectiveLocationSeo(country_slug: string, state_slug?: string, city_slug?: string): Promise<{ h1: string; meta_title: string; meta_description: string }> {
  let result;
  if (city_slug) {
    result = await db
      .select({ h1: sql<string>`h1`, meta_title: sql<string>`meta_title`, meta_description: sql<string>`meta_description` })
      .from(detective_location_seo)
      .where(and(eq(detective_location_seo.country_slug, country_slug), eq(detective_location_seo.city_slug, city_slug)))
      .limit(1);
    if (result.length > 0) {
      return {
        h1: result[0].h1,
        meta_title: result[0].meta_title,
        meta_description: result[0].meta_description,
      };
    }
    // Fallback: programmatic SEO
    return generateDetectiveSeo(country_slug, state_slug, city_slug);
  } else if (state_slug) {
    result = await db
      .select({ h1: sql<string>`h1`, meta_title: sql<string>`meta_title`, meta_description: sql<string>`meta_description` })
      .from(detective_location_seo)
      .where(and(eq(detective_location_seo.country_slug, country_slug), eq(detective_location_seo.city_slug, state_slug)))
      .limit(1);
    if (result.length > 0) {
      return {
        h1: result[0].h1,
        meta_title: result[0].meta_title,
        meta_description: result[0].meta_description,
      };
    }
    return generateDetectiveSeo(country_slug, state_slug);
  } else {
    result = await db
      .select({ h1: sql<string>`h1`, meta_title: sql<string>`meta_title`, meta_description: sql<string>`meta_description` })
      .from(detective_location_seo)
      .where(eq(detective_location_seo.country_slug, country_slug))
      .limit(1);
    if (result.length > 0) {
      return {
        h1: result[0].h1,
        meta_title: result[0].meta_title,
        meta_description: result[0].meta_description,
      };
    }
    return generateDetectiveSeo(country_slug);
  }
}

/**
 * Fetches SEO for service location with fallback
 */
export async function getServiceLocationSeo(service_slug: string, country_slug: string, city_slug: string, area_slug: string): Promise<{ h1: string; meta_title: string; meta_description: string }> {
  const result = await db
    .select({ h1: sql<string>`h1`, meta_title: sql<string>`meta_title`, meta_description: sql<string>`meta_description` })
    .from(service_location_seo)
    .where(and(
      eq(service_location_seo.service_slug, service_slug),
      eq(service_location_seo.country_slug, country_slug),
      eq(service_location_seo.city_slug, city_slug),
      eq(service_location_seo.area_slug, area_slug)
    ))
    .limit(1);
  if (result.length > 0) {
    return {
      h1: result[0].h1,
      meta_title: result[0].meta_title,
      meta_description: result[0].meta_description,
    };
  }
  // Fallback: programmatic SEO
  return generateServiceLocationSeo(service_slug, country_slug, city_slug, area_slug);
}
// ...existing code...
/**
 * Extracts service location route parameters supporting optional area segment
 */
// ...existing code...
// --- Cache-backed slug resolvers for state and city ---
const stateSlugCache = new Map<string, string>();
const citySlugCache = new Map<string, string>();
const countrySlugCache = new Map<string, string>();
const countryRecordCache = new Map<string, { id: number; slug: string }>();
import { normalizeRouteSlugParam, normalizeSlugSegment, toTitleFromSlug } from "./location-normalizer.js";

function slugifySegment(value: string | undefined | null): string {
  return normalizeSlugSegment(value);
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
import { resolveLocationHierarchyForSeo } from "../services/locationSeoResolutionService.js";

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
  licenseNumber: string | null;
  isVerified: boolean | null;
  languages: string[] | null;
  socialLinks: Record<string, string> | null;
  businessType: string | null;
};

// Base SQL — always-present columns guaranteed to exist in all schema versions
const DETECTIVE_SEO_BASE_SQL = `
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

// Extended SQL — includes optional columns added in later schema migrations
// Falls back to DETECTIVE_SEO_BASE_SQL if any column doesn't exist yet
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
    d.created_at AS "createdAt",
    d.license_number AS "licenseNumber",
    d.is_verified AS "isVerified",
    d.languages,
    d.social_links AS "socialLinks",
    d.business_type AS "businessType"
  FROM detectives d
`;

// Optional extended column names — if any are missing the query falls back to base SQL
const EXTENDED_SEO_COLUMNS = ['social_links', 'license_number', 'is_verified', 'languages', 'business_type'];

async function fetchDetectiveSeoRow(
  whereClause: string,
  params: unknown[],
  joinClause = ""
): Promise<DetectiveSeoRow | null> {
  const buildQuery = (sql: string) => `
    ${sql}
    ${joinClause}
    WHERE ${whereClause}
    ORDER BY d.created_at DESC
    LIMIT 1
  `;

  // Try extended query first (includes license, social links, etc.)
  try {
    const result = await pool.query(buildQuery(DETECTIVE_SEO_SELECT_SQL), params);
    return (result.rows[0] as DetectiveSeoRow) || null;
  } catch (error) {
    // If any optional column doesn't exist yet, fall back to base query.
    // PostgreSQL reports missing columns as "column d.col_name does not exist"
    // so we match by checking the error message contains "does not exist" and one of our column names.
    const errMsg = error instanceof Error ? error.message.toLowerCase() : '';
    const isMissingOptional =
      errMsg.includes('does not exist') &&
      EXTENDED_SEO_COLUMNS.some(col => errMsg.includes(col.toLowerCase()));
    if (isMissingOptional) {
      console.warn('[SEO] Optional SEO columns not in schema yet, using base query. Missing:', errMsg.match(/column ([^\s]+)/)?.[1]);
      const result = await pool.query(buildQuery(DETECTIVE_SEO_BASE_SQL), params);
      return (result.rows[0] as DetectiveSeoRow) || null;
    }
    throw error;
  }
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

async function fetchDetectiveReviews(detectiveId: string): Promise<Array<{ rating: number; comment: string; reviewerName: string; createdAt: string }>> {
  try {
    const result = await pool.query(
      `SELECT r.rating, r.comment, r.created_at AS "createdAt", u.full_name AS "reviewerName"
       FROM reviews r
       INNER JOIN services s ON s.id = r.service_id AND s.detective_id = $1 AND s.is_active = true
       INNER JOIN users u ON u.id = r.user_id
       WHERE r.is_published = true
         AND r.comment IS NOT NULL
         AND char_length(r.comment) > 20
       ORDER BY r.rating DESC, r.created_at DESC
       LIMIT 5`,
      [detectiveId]
    );
    return result.rows;
  } catch {
    return [];
  }
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
    const countrySlug = normalizeRouteSlugParam(country);
    const stateSlug = normalizeRouteSlugParam(state);
    const citySlug = normalizeRouteSlugParam(city);
    const detectiveSlug = normalizeRouteSlugParam(slug);

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

    const [{ avgRating, reviewCount }, seoOverride, reviews] = await Promise.all([
      fetchDetectiveRatings(detective.id),
      fetchDetectiveSeoOverride(detective.id),
      fetchDetectiveReviews(detective.id),
    ]);

    return { ...detective, avgRating, reviewCount, seoOverride, reviews };
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

  const ogImage = detective.logo || 'https://www.askdetectives.com/og-detective-directory.jpg';
  const ogImageAlt = `${name} - Private Detective${location ? ` in ${location}` : ''}`;

  return [
    `<title>${escapeHtml(title)}</title>`,
    `<meta name="description" content="${escapeHtml(shortDescription)}" />`,
    `<meta property="og:title" content="${escapeHtml(title)}" />`,
    `<meta property="og:description" content="${escapeHtml(shortDescription)}" />`,
    `<meta property="og:url" content="${escapeHtml(canonicalUrl)}" />`,
    `<meta property="og:type" content="business.business" />`,
    `<meta property="og:image" content="${escapeHtml(ogImage)}" />`,
    `<meta property="og:image:width" content="1200" />`,
    `<meta property="og:image:height" content="630" />`,
    `<meta property="og:image:alt" content="${escapeHtml(ogImageAlt)}" />`,
    `<meta property="og:site_name" content="Ask Detectives" />`,
    `<meta name="twitter:card" content="summary_large_image" />`,
    `<meta name="twitter:site" content="@FindDetectives" />`,
    `<meta name="twitter:title" content="${escapeHtml(title)}" />`,
    `<meta name="twitter:description" content="${escapeHtml(shortDescription)}" />`,
    `<meta name="twitter:image" content="${escapeHtml(ogImage)}" />`,
    `<meta name="twitter:image:alt" content="${escapeHtml(ogImageAlt)}" />`,
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

  // Add individual reviews for rich snippet eligibility
  if (detective.reviews && Array.isArray(detective.reviews) && detective.reviews.length > 0) {
    const reviewItems = detective.reviews
      .filter((r: any) => r.comment && r.comment.trim().length > 20)
      .map((r: any) => ({
        "@type": "Review",
        "reviewRating": {
          "@type": "Rating",
          "ratingValue": Number(r.rating),
          "bestRating": 5,
          "worstRating": 1,
        },
        "author": {
          "@type": "Person",
          "name": r.reviewerName || "Verified Client",
        },
        "datePublished": r.createdAt ? new Date(r.createdAt).toISOString().split('T')[0] : undefined,
        "reviewBody": r.comment,
      }));
    if (reviewItems.length > 0) {
      localBusiness.review = reviewItems;
    }
  }

  // Add price range ONLY if it exists in detective data
  if (detective.priceRange) {
    localBusiness.priceRange = detective.priceRange;
  }

  // Offer catalog for service types
  localBusiness.hasOfferCatalog = {
    "@type": "OfferCatalog",
    "name": "Private Investigation Services",
    "description": `Investigation and detective services by ${name}`,
  };

  // Payment methods
  localBusiness.paymentAccepted = "Cash, Online Transfer, Bank Transfer, UPI";
  localBusiness.currenciesAccepted = "INR, USD, GBP";

  // Area served with geo precision (override plain string set above)
  if (detective.city && detective.state) {
    localBusiness.areaServed = {
      "@type": "City",
      "name": detective.city,
      "containedInPlace": {
        "@type": "AdministrativeArea",
        "name": detective.state,
      },
    };
  }

  // License as identifier
  if (detective.licenseNumber) {
    localBusiness.identifier = {
      "@type": "PropertyValue",
      "name": "License Number",
      "value": detective.licenseNumber,
    };
  }

  // sameAs — website + social links
  const sameAsLinks: string[] = [];
  if (detective.businessWebsite) sameAsLinks.push(detective.businessWebsite);
  if (detective.socialLinks && typeof detective.socialLinks === 'object') {
    for (const url of Object.values(detective.socialLinks as Record<string, string>)) {
      if (typeof url === 'string' && url.startsWith('http')) sameAsLinks.push(url);
    }
  }
  if (sameAsLinks.length > 0) localBusiness.sameAs = sameAsLinks;

  // knowsAbout for verified detectives
  if (detective.isVerified) {
    localBusiness.knowsAbout = [
      "Private Investigation",
      "Surveillance",
      "Background Checks",
      "Fraud Investigation",
      "Skip Tracing",
      "Corporate Investigations",
    ];
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
 * Generates Person/Expert schema for detective profiles
 * Strengthens Google Knowledge Graph entity authority
 */
function generateDetectivePersonSchema(detective: any, canonicalUrl: string): string {
  const name = detective.businessName || `${detective.firstName || ''} ${detective.lastName || ''}`.trim() || 'Private Detective';
  const person: Record<string, any> = {
    "@context": "https://schema.org",
    "@type": "Person",
    "@id": `${canonicalUrl}#person`,
    "name": name,
    "jobTitle": "Private Detective",
    "worksFor": {
      "@type": "LocalBusiness",
      "@id": canonicalUrl,
      "name": name,
    },
    "url": canonicalUrl,
  };

  if (detective.city && detective.state) {
    person.homeLocation = {
      "@type": "Place",
      "address": {
        "@type": "PostalAddress",
        "addressLocality": detective.city,
        "addressRegion": detective.state,
        "addressCountry": detective.country || "",
      },
    };
  }

  if (detective.licenseNumber) {
    person.hasCredential = {
      "@type": "EducationalOccupationalCredential",
      "name": "Private Detective License",
      "credentialCategory": "Professional License",
      "identifier": detective.licenseNumber,
    };
  }

  if (detective.isVerified) {
    person.knowsAbout = [
      "Private Investigation",
      "Surveillance Operations",
      "Background Verification",
      "Legal Investigation",
      "Corporate Due Diligence",
    ];
  }

  return JSON.stringify(person, null, 2);
}

/**
 * Generates JSON-LD structured data for detective profile
 * Returns object with localBusiness, breadcrumbs, and person as separate JSON strings
 */
export function generateDetectiveJsonLd(detective: any, canonicalUrl: string): { localBusiness: string; breadcrumbs: string; person: string } {
  return {
    localBusiness: generateDetectiveLocalBusinessSchema(detective, canonicalUrl),
    breadcrumbs: generateDetectiveBreadcrumbSchema(detective, canonicalUrl),
    person: generateDetectivePersonSchema(detective, canonicalUrl),
  };
}

/**
 * Generates SpeakableSpecification schema for voice search optimization
 * Tells Google Assistant/Alexa which CSS selectors to read aloud for detective queries
 */
function generateSpeakableSchema(): string {
  return JSON.stringify({
    "@context": "https://schema.org",
    "@type": "SpeakableSpecification",
    "cssSelector": [
      "h1",
      ".detective-bio",
      ".detective-about",
      ".detective-description",
    ],
  }, null, 2);
}

/**
 * Generates WebPage/CollectionPage/ProfilePage schema
 * Provides explicit page-type entity typing for Google's entity understanding
 */
export function generateWebPageSchema(
  type: 'CollectionPage' | 'ProfilePage' | 'WebPage',
  name: string,
  description: string,
  canonicalUrl: string
): string {
  return JSON.stringify({
    "@context": "https://schema.org",
    "@type": type,
    "@id": `${canonicalUrl}#webpage`,
    "url": canonicalUrl,
    "name": name,
    "description": description,
    "isPartOf": {
      "@type": "WebSite",
      "@id": "https://www.askdetectives.com/#website",
      "url": "https://www.askdetectives.com",
      "name": "Ask Detectives",
    },
    "inLanguage": "en-US",
    "dateModified": new Date().toISOString().split('T')[0],
  }, null, 2);
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
    `<!-- SEO_H1_INJECTION_POINT -->\n    <h1 style="position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0;">${escapeHtml(h1Value)}</h1>`
  );

  // Inject JSON-LD at SEO_JSON_LD_INJECTION_POINT
  // Four separate script tags: LocalBusiness, BreadcrumbList, Person, ProfilePage (WebPage)
  const jsonLd = generateDetectiveJsonLd(detective, canonicalUrl);
  const detectiveTitle = detective?.seoOverride?.metaTitle?.trim()
    || `${detective.businessName || 'Detective'} - Private Detective${detective.city ? ` in ${detective.city}` : ''} | Ask Detectives`;
  const detectiveDesc = detective?.seoOverride?.metaDescription?.trim()
    || detective.bio?.substring(0, 160)
    || `Professional private investigator services${detective.city ? ` in ${detective.city}` : ''}`;
  const webPageSchema = generateWebPageSchema('ProfilePage', detectiveTitle, detectiveDesc, canonicalUrl);
  const speakableSchema = generateSpeakableSchema();
  const jsonLdScripts = [
    `<script type="application/ld+json">\n      ${jsonLd.localBusiness}\n    </script>`,
    `<script type="application/ld+json">\n      ${jsonLd.breadcrumbs}\n    </script>`,
    `<script type="application/ld+json">\n      ${jsonLd.person}\n    </script>`,
    `<script type="application/ld+json">\n      ${webPageSchema}\n    </script>`,
    `<script type="application/ld+json">\n      ${speakableSchema}\n    </script>`,
  ].join('\n    ');
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
  cleaned = cleaned.replace(/<meta\s+property="og:image:width"[^>]*>/gi, '');
  cleaned = cleaned.replace(/<meta\s+property="og:image:height"[^>]*>/gi, '');
  cleaned = cleaned.replace(/<meta\s+property="og:image:alt"[^>]*>/gi, '');
  cleaned = cleaned.replace(/<meta\s+property="og:image"[^>]*>/gi, '');
  cleaned = cleaned.replace(/<meta\s+property="og:url"[^>]*>/gi, '');
  cleaned = cleaned.replace(/<meta\s+property="og:site_name"[^>]*>/gi, '');
  cleaned = cleaned.replace(/<meta\s+property="og:locale"[^>]*>/gi, '');

  // Remove Twitter Card tags
  cleaned = cleaned.replace(/<meta\s+name="twitter:card"[^>]*>/gi, '');
  cleaned = cleaned.replace(/<meta\s+name="twitter:title"[^>]*>/gi, '');
  cleaned = cleaned.replace(/<meta\s+name="twitter:description"[^>]*>/gi, '');
  cleaned = cleaned.replace(/<meta\s+name="twitter:image:alt"[^>]*>/gi, '');
  cleaned = cleaned.replace(/<meta\s+name="twitter:image"[^>]*>/gi, '');
  cleaned = cleaned.replace(/<meta\s+name="twitter:site"[^>]*>/gi, '');
  // Also remove the invalid <meta name="canonical"> tag (should be <link rel="canonical">)
  cleaned = cleaned.replace(/<meta\s+name="canonical"[^>]*>/gi, '');

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
      country: normalizeRouteSlugParam(segments[1]),
      state: normalizeRouteSlugParam(segments[2]),
      city: normalizeRouteSlugParam(segments[3]),
      slug: normalizeRouteSlugParam(segments[4]),
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
      country: normalizeRouteSlugParam(segments[1]),
      state: segments[2] ? normalizeRouteSlugParam(segments[2]) : undefined,
      city: segments[3] ? normalizeRouteSlugParam(segments[3]) : undefined,
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
  offset?: number,
  options?: { allowParentFallback?: boolean; includeTotalCount?: boolean }
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
  totalCount: number;
  locationFound: boolean;
  fallbackLevel: "none" | "country" | "state";
  location: { country: string; state?: string; city?: string };
}> {
  const titleFromSlugIfPresent = (slugValue: string | undefined): string | undefined => {
    if (!slugValue) return undefined;
    return toTitleFromSlug(slugValue) || slugValue;
  };

  try {
    // Build query conditions using only country_id, state_id, city_id
    const limitValue = typeof limit === "number" && limit > 0 ? Math.floor(limit) : 15;
    const offsetValue = typeof offset === "number" && offset > 0 ? Math.floor(offset) : 0;
    const allowParentFallback = options?.allowParentFallback ?? true;
    const includeTotalCount = options?.includeTotalCount ?? false;
    const countrySlugParam = normalizeRouteSlugParam(country);
    const stateSlugParam = state ? normalizeRouteSlugParam(state) : undefined;
    const citySlugParam = city ? normalizeRouteSlugParam(city) : undefined;

    const hierarchy = await resolveLocationHierarchyForSeo(
      countrySlugParam,
      stateSlugParam,
      citySlugParam,
      allowParentFallback,
    );
    const resolvedCountryId = hierarchy.countryId;
    const resolvedCountryName = hierarchy.countryName;
    const resolvedStateId = hierarchy.stateId;
    const resolvedStateName = hierarchy.stateName;
    const resolvedCityId = hierarchy.cityId;
    const resolvedCityName = hierarchy.cityName;
    const stateResolved = hierarchy.stateResolved;
    const cityResolved = hierarchy.cityResolved;
    const fallbackLevel = hierarchy.fallbackLevel;

    if (!resolvedCountryId || !hierarchy.locationFound) {
      return {
        detectives: [],
        hasMore: false,
        totalCount: 0,
        locationFound: false,
        fallbackLevel,
        location: {
          country: resolvedCountryName || titleFromSlugIfPresent(countrySlugParam) || country,
          state: stateResolved ? titleFromSlugIfPresent(stateSlugParam) : undefined,
          city: cityResolved ? titleFromSlugIfPresent(citySlugParam) : undefined,
        },
      };
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

    let totalCount = 0;
    if (includeTotalCount) {
      const [countRow] = await db
        .select({ count: sql<number>`COUNT(*)::int` })
        .from(detectives)
        .where(and(...conditions));
      totalCount = Number(countRow?.count ?? 0);
    }

    // Query detectives with limit + 1 for pagination
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
    if (!includeTotalCount) {
      totalCount = hasMore ? offsetValue + limitedRows.length + 1 : offsetValue + limitedRows.length;
    }

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
      totalCount,
      locationFound: true,
      fallbackLevel,
      location: {
        country: resolvedCountryName || titleFromSlugIfPresent(countrySlugParam) || countrySlugParam,
        state: stateResolved ? (resolvedStateName || titleFromSlugIfPresent(stateSlugParam)) : undefined,
        city: cityResolved ? (resolvedCityName || titleFromSlugIfPresent(citySlugParam)) : undefined,
      },
    };
  } catch (error) {
    const normalizedCountrySlug = normalizeRouteSlugParam(country);
    const normalizedStateSlug = state ? normalizeRouteSlugParam(state) : undefined;
    const normalizedCitySlug = city ? normalizeRouteSlugParam(city) : undefined;

    console.error("[SEO] Error fetching location detectives:", error);
    return {
      detectives: [],
      hasMore: false,
      totalCount: 0,
      locationFound: false,
      fallbackLevel: "none",
      location: {
        country: titleFromSlugIfPresent(normalizedCountrySlug) || country,
        state: titleFromSlugIfPresent(normalizedStateSlug),
        city: titleFromSlugIfPresent(normalizedCitySlug),
      },
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
  resolvedLocation?: LocationResolution,
  firstDetectiveLogo?: string | null
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
  const locationDisplayName = cityName || stateName || countryName;
  const ogLocaleMap: Record<string, string> = {
    'india': 'en_IN', 'united-states': 'en_US', 'united-kingdom': 'en_GB',
    'australia': 'en_AU', 'canada': 'en_CA', 'singapore': 'en_SG',
    'new-zealand': 'en_NZ', 'ireland': 'en_IE', 'malaysia': 'en_MY',
    'south-africa': 'en_ZA', 'united-arab-emirates': 'en_AE', 'pakistan': 'en_PK',
  };
  const ogLocale = ogLocaleMap[location.country.toLowerCase()] || 'en_US';
  const metaTags = [
    `<title>${escapeHtml(title)}</title>`,
    `<meta name="description" content="${escapeHtml(description)}">`,
    `<meta name="robots" content="index, follow">`,
    `<meta property="og:type" content="website">`,
    `<meta property="og:url" content="${escapeHtml(canonicalUrl)}">`,
    `<meta property="og:title" content="${escapeHtml(h1 || title)}">`,
    `<meta property="og:description" content="${escapeHtml(description)}">`,
    `<meta property="og:image" content="${escapeHtml(firstDetectiveLogo || 'https://www.askdetectives.com/og-detective-directory.jpg')}">`,
    `<meta property="og:image:width" content="1200">`,
    `<meta property="og:image:height" content="630">`,
    `<meta property="og:image:alt" content="${escapeHtml('Private Detectives in ' + locationDisplayName)}">`,
    `<meta property="og:site_name" content="Ask Detectives">`,
    `<meta property="og:locale" content="${ogLocale}">`,
    `<meta name="twitter:card" content="summary_large_image">`,
    `<meta name="twitter:site" content="@FindDetectives">`,
    `<meta name="twitter:title" content="${escapeHtml(h1 || title)}">`,
    `<meta name="twitter:description" content="${escapeHtml(description)}">`,
    `<meta name="twitter:image" content="${escapeHtml(firstDetectiveLogo || 'https://www.askdetectives.com/og-detective-directory.jpg')}">`,
    `<meta name="twitter:image:alt" content="${escapeHtml('Find Detectives in ' + locationDisplayName)}">`,
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

/**
 * Generates rich, location-specific FAQ schema for location listing pages
 * Creates 5 unique Q&A pairs tailored to city/state/country level
 * Powers "People Also Ask" PAA boxes in Google SERPs
 */
export function generateRichLocationFaqSchema(
  locationName: string,
  locationType: 'city' | 'state' | 'country',
  detectiveCount: number
): string {
  const faqs: Array<{ q: string; a: string }> = [];

  if (locationType === 'city') {
    faqs.push(
      {
        q: `How much does a private detective cost in ${locationName}?`,
        a: `Private detective fees in ${locationName} vary based on case complexity and type. Surveillance typically costs ₹2,000–₹15,000 per day, while background checks start from ₹500. Ask Detectives lists ${detectiveCount} verified investigators in ${locationName} with transparent pricing — compare quotes directly before hiring.`,
      },
      {
        q: `Are private detectives legal in ${locationName}?`,
        a: `Yes. Licensed private investigators operate legally in ${locationName} and must comply with local privacy laws and data protection regulations. All ${detectiveCount} investigators listed on Ask Detectives for ${locationName} are verified professionals working within legal frameworks.`,
      },
      {
        q: `What services do private detectives offer in ${locationName}?`,
        a: `Private detectives in ${locationName} offer background checks, matrimonial investigations, corporate fraud detection, surveillance, asset tracing, missing person searches, and pre-marital verification. Browse all ${detectiveCount} specialists on Ask Detectives to find an investigator matching your specific case.`,
      },
      {
        q: `How do I hire a private detective in ${locationName}?`,
        a: `Hiring a private detective in ${locationName} is straightforward: 1) Browse ${detectiveCount} verified investigators on Ask Detectives, 2) Compare profiles, ratings, and service pricing, 3) Contact the detective directly or request a consultation. All listed detectives are identity-verified before appearing on the platform.`,
      },
      {
        q: `How long does a private investigation take in ${locationName}?`,
        a: `Investigation timelines in ${locationName} depend on the case. Background checks typically complete in 1–3 business days. Surveillance assignments usually run 3–7 days. Complex corporate investigations may take several weeks. Discuss your timeline with your chosen investigator via Ask Detectives before engaging.`,
      }
    );
  } else if (locationType === 'state') {
    faqs.push(
      {
        q: `How many private detectives are available in ${locationName}?`,
        a: `Ask Detectives lists ${detectiveCount} verified private investigators across ${locationName}. The directory covers major cities and regional areas throughout the state, ensuring you can find a qualified local investigator regardless of your location.`,
      },
      {
        q: `Do private detectives in ${locationName} operate across the whole state?`,
        a: `Many private investigators in ${locationName} operate statewide, while others focus on specific cities or districts. Use Ask Detectives' location filters to find investigators who serve your area, or contact a detective directly to confirm their service coverage.`,
      },
      {
        q: `What is the best way to find a trusted private investigator in ${locationName}?`,
        a: `The most reliable method is to use a verified directory like Ask Detectives, which screens all ${detectiveCount} investigators in ${locationName} for credentials and professionalism. You can compare reviews, pricing, and specializations before making contact — without any upfront commitment.`,
      },
      {
        q: `What types of cases do detectives handle in ${locationName}?`,
        a: `Investigators in ${locationName} handle a wide range of cases: personal investigations (matrimonial, missing persons), corporate cases (fraud, due diligence, employee background checks), and legal support (evidence gathering, witness location). Ask Detectives lists ${detectiveCount} specialists across all these categories.`,
      },
      {
        q: `Are private detective services confidential in ${locationName}?`,
        a: `Yes. All reputable private investigators in ${locationName} maintain strict client confidentiality. Case details, client identity, and investigation findings are kept private. When browsing Ask Detectives' ${detectiveCount} listed investigators, you can review each detective's privacy practices before engaging.`,
      }
    );
  } else {
    faqs.push(
      {
        q: `How do I find a reputable private detective in ${locationName}?`,
        a: `Ask Detectives is ${locationName}'s leading verified directory of licensed private investigators. Browse ${detectiveCount} professionals by city, service type, or specialization. All listings include verified credentials, client reviews, and direct contact options — making it the safest way to find a trustworthy investigator.`,
      },
      {
        q: `Are private detective services available nationwide in ${locationName}?`,
        a: `Yes. Ask Detectives has ${detectiveCount} verified investigators operating in major cities and regional areas across ${locationName}. Whether you need a detective in a metropolitan hub or a smaller town, the directory provides comprehensive nationwide coverage.`,
      },
      {
        q: `What regulations govern private investigators in ${locationName}?`,
        a: `Private investigators in ${locationName} must hold a valid licence and operate within local data protection and privacy laws. Investigators cannot trespass, wiretap without consent, or impersonate law enforcement. All ${detectiveCount} detectives listed on Ask Detectives operate within these legal boundaries.`,
      },
      {
        q: `What are the most common uses for private detectives in ${locationName}?`,
        a: `The most common investigation requests in ${locationName} include: matrimonial and infidelity investigations, pre-employment background checks, corporate fraud and due diligence, missing persons cases, and asset verification. Ask Detectives connects you with ${detectiveCount} specialists across all these areas.`,
      },
      {
        q: `How do I verify a private detective's credentials in ${locationName}?`,
        a: `Before hiring, ask for the investigator's licence number and verify it with the relevant licensing authority in ${locationName}. All ${detectiveCount} detectives on Ask Detectives undergo identity and credential verification before listing. You can review their profile, client ratings, and listed credentials directly on the platform.`,
      }
    );
  }

  return JSON.stringify({
    "@context": "https://schema.org",
    "@type": "FAQPage",
    "mainEntity": faqs.map(faq => ({
      "@type": "Question",
      "name": faq.q,
      "acceptedAnswer": {
        "@type": "Answer",
        "text": faq.a,
      },
    })),
  }, null, 2);
}
export async function injectLocationSeoTags(
  htmlContent: string,
  location: { country: string; state?: string; city?: string },
  detectives: Array<{ slug: string; businessName: string; city: string; state: string; country: string; logo?: string | null }>,
  canonicalUrl: string,
  totalCount: number,
  resolvedLocation?: LocationResolution
): Promise<string> {
  // STEP 1: Remove all existing default meta tags
  let modified = removeDefaultMetaTags(htmlContent);

  // STEP 2: Inject new SEO tags (now async with override support)
  // ✅ Pass resolved location to avoid duplicate queries
  const firstDetectiveLogo = detectives.find(d => d.logo)?.logo || null;
  const seoData = await generateLocationSeoMetaTags(location, totalCount, canonicalUrl, resolvedLocation, firstDetectiveLogo);
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

  // Inject H1 at SEO_H1_INJECTION_POINT (visually hidden — for Google crawlers, not users)
  modified = modified.replace(
    /<!-- SEO_H1_INJECTION_POINT -->/,
    `<!-- SEO_H1_INJECTION_POINT -->\n    <h1 style="position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0;">${escapeHtml(seoData.h1)}</h1>`
  );

  // Inject JSON-LD at SEO_JSON_LD_INJECTION_POINT
  // Four separate script tags: ItemList, BreadcrumbList, CollectionPage (WebPage), FAQPage
  const jsonLd = await generateLocationJsonLd(
    location,
    detectives,
    canonicalUrl
  );
  const locationWebPageSchema = generateWebPageSchema('CollectionPage', seoData.title, seoData.description, canonicalUrl);
  const locationType = location.city ? 'city' : location.state ? 'state' : 'country';
  const locationDisplayName = seoData.h1.replace(/^(Top |Best )?(Private Detectives? in |Detectives? in )/i, '').trim() || location.city || location.state || location.country;
  const faqSchema = generateRichLocationFaqSchema(locationDisplayName, locationType, totalCount);
  const jsonLdScripts = [
    `<script type="application/ld+json">\n      ${jsonLd.itemList}\n    </script>`,
    `<script type="application/ld+json">\n      ${jsonLd.breadcrumbs}\n    </script>`,
    `<script type="application/ld+json">\n      ${locationWebPageSchema}\n    </script>`,
    `<script type="application/ld+json">\n      ${faqSchema}\n    </script>`,
  ].join('\n    ');
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
 * Matches: /locations/:category/:country/:state/:city
 */
// Service category slug → display name mapping
// Add new entries here to automatically enable SEO injection for additional service pages
const SERVICE_CATEGORY_MAP: Record<string, string> = {
  'background-checks': 'Background Check',
  'surveillance': 'Surveillance',
  'matrimonial-investigation': 'Matrimonial Investigation',
  'corporate-investigation': 'Corporate Investigation',
  'asset-tracing': 'Asset Tracing',
  'missing-persons': 'Missing Persons Investigation',
};

export function extractServiceLocationRouteParams(
  requestPath: string
): { category: string; categorySlug: string; countrySlug: string; stateSlug?: string; citySlug?: string; level: 'country' | 'state' | 'city' } | null {
  const path = requestPath.replace(/\/+$/, '');
  const segments = path.split('/').filter(s => s);

  // segments[0] = 'locations', segments[1] = category, segments[2..4] = country/state/city
  if (segments[0] !== 'locations' || segments.length < 3 || segments.length > 5) return null;

  const categorySlug = segments[1];
  const category = SERVICE_CATEGORY_MAP[categorySlug];
  if (!category) return null;

  if (segments.length === 3) {
    return { category, categorySlug, countrySlug: segments[2], level: 'country' };
  }
  if (segments.length === 4) {
    return { category, categorySlug, countrySlug: segments[2], stateSlug: segments[3], level: 'state' };
  }
  return { category, categorySlug, countrySlug: segments[2], stateSlug: segments[3], citySlug: segments[4], level: 'city' };
}

/**
 * Resolves service location slugs to actual country/state/city using database lookup
 * Returns null if any location segment is not found
 */
export async function resolveServiceLocation(
  countrySlug: string,
  stateSlug?: string,
  citySlug?: string
): Promise<{ countryCode: string; countryName: string; stateName?: string; cityName?: string } | null> {
  try {
    const countryRows = await db
      .select({ id: countries.id, code: countries.code, name: countries.name })
      .from(countries)
      .where(eq(countries.slug, countrySlug));
    if (!countryRows?.length) {
      console.log(`[Service SEO] Country not found: ${countrySlug}`);
      return null;
    }
    const countryRow = countryRows[0];

    if (!stateSlug) {
      return { countryCode: countryRow.code, countryName: countryRow.name };
    }

    const stateRows = await db
      .select({ id: states.id, name: states.name })
      .from(states)
      .where(and(eq(states.countryId, countryRow.id), eq(states.slug, stateSlug)));
    if (!stateRows?.length) {
      console.log(`[Service SEO] State not found: ${stateSlug}`);
      return null;
    }
    const stateRow = stateRows[0];

    if (!citySlug) {
      return { countryCode: countryRow.code, countryName: countryRow.name, stateName: stateRow.name };
    }

    const cityRows = await db
      .select({ id: cities.id, name: cities.name })
      .from(cities)
      .where(and(eq(cities.stateId, stateRow.id), eq(cities.slug, citySlug)));
    if (!cityRows?.length) {
      console.log(`[Service SEO] City not found: ${citySlug}`);
      return null;
    }

    return {
      countryCode: countryRow.code,
      countryName: countryRow.name,
      stateName: stateRow.name,
      cityName: cityRows[0].name,
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
  location: { countryName: string; stateName?: string; cityName?: string },
  serviceCount: number,
  canonicalUrl: string,
  firstServiceLogo?: string | null,
  categoryName = "Background Check Services"
): string {
  const locationDisplay = location.cityName
    ? `${location.cityName}, ${location.stateName}`
    : location.stateName
    ? `${location.stateName}, ${location.countryName}`
    : location.countryName;
  const title = `${categoryName} in ${locationDisplay} | Verified Detectives`;
  const description = `Compare ${serviceCount} verified ${categoryName.toLowerCase()} providers in ${locationDisplay}. Reviews, pricing & direct contact details available.`;

  const serviceImageAlt = `${categoryName} in ${locationDisplay}`;
  const ogImage = firstServiceLogo || 'https://www.askdetectives.com/og-detective-directory.jpg';
  const metaTags = [
    `<title>${escapeHtml(title)}</title>`,
    `<meta name="description" content="${escapeHtml(description)}">`,
    `<meta name="robots" content="index, follow">`,
    `<meta property="og:type" content="website">`,
    `<meta property="og:url" content="${escapeHtml(canonicalUrl)}">`,
    `<meta property="og:title" content="${escapeHtml(title)}">`,
    `<meta property="og:description" content="${escapeHtml(description)}">`,
    `<meta property="og:image" content="${escapeHtml(ogImage)}">`,
    `<meta property="og:image:width" content="1200">`,
    `<meta property="og:image:height" content="630">`,
    `<meta property="og:image:alt" content="${escapeHtml(serviceImageAlt)}">`,
    `<meta property="og:site_name" content="Ask Detectives">`,
    `<meta name="twitter:card" content="summary_large_image">`,
    `<meta name="twitter:site" content="@FindDetectives">`,
    `<meta name="twitter:title" content="${escapeHtml(title)}">`,
    `<meta name="twitter:description" content="${escapeHtml(description)}">`,
    `<meta name="twitter:image" content="${escapeHtml(ogImage)}">`,
    `<meta name="twitter:image:alt" content="${escapeHtml(serviceImageAlt)}">`,
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
  location: { countrySlug: string; stateSlug?: string; citySlug?: string; countryName: string; stateName?: string; cityName?: string },
  categorySlug = "background-checks",
  categoryName = "Background Check Services"
): string {
  const base = `https://www.askdetectives.com/locations/${categorySlug}`;
  const breadcrumbItems: any[] = [
    { "@type": "ListItem", "position": 1, "name": "Home",       "item": "https://www.askdetectives.com" },
    { "@type": "ListItem", "position": 2, "name": "Locations",  "item": "https://www.askdetectives.com/locations/" },
    { "@type": "ListItem", "position": 3, "name": categoryName, "item": `${base}/` },
    { "@type": "ListItem", "position": 4, "name": location.countryName, "item": `${base}/${location.countrySlug}/` },
  ];
  if (location.stateSlug && location.stateName) {
    breadcrumbItems.push({ "@type": "ListItem", "position": 5, "name": location.stateName, "item": `${base}/${location.countrySlug}/${location.stateSlug}/` });
  }
  if (location.citySlug && location.cityName) {
    breadcrumbItems.push({ "@type": "ListItem", "position": 6, "name": location.cityName, "item": `${base}/${location.countrySlug}/${location.stateSlug}/${location.citySlug}/` });
  }

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
  location: { countrySlug: string; stateSlug?: string; citySlug?: string; countryName: string; stateName?: string; cityName?: string },
  services: Array<any>,
  canonicalUrl: string,
  categorySlug = "background-checks",
  categoryName = "Background Check Services"
): Promise<{ itemList: string; breadcrumbs: string }> {
  return {
    itemList: await generateServiceLocationItemListSchema(
      { countryName: location.countryName, stateName: location.stateName || '', cityName: location.cityName || '' },
      services,
      canonicalUrl
    ),
    breadcrumbs: generateServiceLocationBreadcrumbSchema(location, categorySlug, categoryName),
  };
}

/**
 * Fetches SEO override for a service-location page from location_seo_overrides table.
 * entity_id format: "{categorySlug}:{countrySlug}" | "{categorySlug}:{countrySlug}:{stateSlug}" | "{categorySlug}:{countrySlug}:{stateSlug}:{citySlug}"
 */
async function fetchServiceLocationSeoOverride(
  categorySlug: string,
  countrySlug: string,
  stateSlug?: string,
  citySlug?: string
): Promise<{ metaTitle?: string | null; metaDescription?: string | null; h1?: string | null } | null> {
  const parts = [categorySlug, countrySlug];
  if (stateSlug) parts.push(stateSlug);
  if (citySlug) parts.push(citySlug);
  const entityId = parts.join(':');
  try {
    const result = await pool.query(
      `SELECT meta_title AS "metaTitle", meta_description AS "metaDescription", h1
       FROM location_seo_overrides
       WHERE entity_type = 'service-location' AND entity_id = $1
       LIMIT 1`,
      [entityId]
    );
    return result.rows[0] || null;
  } catch {
    return null;
  }
}

/**
 * Injects service location SEO tags into HTML template
 */
export async function injectServiceLocationSeoTags(
  htmlContent: string,
  location: { countrySlug: string; stateSlug?: string; citySlug?: string; countryName: string; stateName?: string; cityName?: string },
  services: Array<any>,
  canonicalUrl: string,
  categoryName = "Background Check Services",
  categorySlug = "background-checks"
): Promise<string> {
  // STEP 1: Remove all existing default meta tags
  let modified = removeDefaultMetaTags(htmlContent);

  // STEP 2: Fetch SEO override (if any)
  const seoOverride = await fetchServiceLocationSeoOverride(
    categorySlug, location.countrySlug, location.stateSlug, location.citySlug
  );

  // STEP 3: Inject new SEO tags
  const firstServiceLogo = services.find((s: any) => s.detective?.logo || s.logo)?.detective?.logo || services.find((s: any) => s.logo)?.logo || null;
  const metaTags = generateServiceLocationSeoMetaTags({ countryName: location.countryName, stateName: location.stateName, cityName: location.cityName }, services.length, canonicalUrl, firstServiceLogo, categoryName);
  const metaTagsArray = metaTags.split('\n');

  // Apply override to title if present
  const titleTag = seoOverride?.metaTitle
    ? `<title>${escapeHtml(seoOverride.metaTitle)}</title>`
    : metaTagsArray[0];

  // Apply override to meta description if present
  let otherTags = metaTagsArray.slice(1).join('\n    ');
  if (seoOverride?.metaDescription) {
    otherTags = otherTags.replace(
      /<meta name="description" content="[^"]*">/,
      `<meta name="description" content="${escapeHtml(seoOverride.metaDescription)}">`
    );
  }

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

  // Inject H1 at SEO_H1_INJECTION_POINT (visually hidden — for Google crawlers, not users)
  const locationLabel = location.cityName
    ? `${location.cityName}, ${location.stateName}`
    : location.stateName || location.countryName;
  const serviceH1 = seoOverride?.h1
    ? escapeHtml(seoOverride.h1)
    : `${categoryName} in ${escapeHtml(locationLabel)}`;
  modified = modified.replace(
    /<!-- SEO_H1_INJECTION_POINT -->/,
    `<!-- SEO_H1_INJECTION_POINT -->\n    <h1 style="position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0;">${serviceH1}</h1>`
  );

  // Inject JSON-LD at SEO_JSON_LD_INJECTION_POINT
  // Three separate script tags: ItemList, BreadcrumbList, CollectionPage (WebPage)
  const jsonLd = await generateServiceLocationJsonLd(location, services, canonicalUrl, categorySlug, categoryName);
  const serviceTitle = `Background Check Services in ${location.cityName}, ${location.stateName} | Verified Detectives`;
  const serviceDesc = `Compare ${services.length} verified background check providers in ${location.cityName}, ${location.stateName}.`;
  const serviceWebPageSchema = generateWebPageSchema('CollectionPage', serviceTitle, serviceDesc, canonicalUrl);
  const jsonLdScripts = [
    `<script type="application/ld+json">\n      ${jsonLd.itemList}\n    </script>`,
    `<script type="application/ld+json">\n      ${jsonLd.breadcrumbs}\n    </script>`,
    `<script type="application/ld+json">\n      ${serviceWebPageSchema}\n    </script>`,
  ].join('\n    ');
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
      <a href="/locations/background-checks/${location.countrySlug}/${location.stateSlug}/${location.citySlug}/" class="inline-flex items-center gap-2 text-blue-600 hover:text-blue-800 font-medium transition-colors" aria-label="Explore background check services in ${escapeHtml(location.cityName)}, ${escapeHtml(location.stateName)}">
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

