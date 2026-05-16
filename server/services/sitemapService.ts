/**
 * Sitemap Service - Generates scalable, paginated sitemaps
 * Handles caching, compression, and proper HTTP headers
 */

import { pool } from "../../db/index.js";
import { readFileSync, writeFileSync, existsSync, mkdirSync, statSync, readdirSync, unlinkSync } from "fs";
import { join } from "path";


const SITEMAP_CACHE_DIR = process.env.SITEMAP_CACHE_DIR || "/tmp/.sitemap-cache";
const CACHE_MAX_AGE = 86400; // 24 hours in seconds
const SITEMAP_PAGE_SIZE = 5000;

// Ensure cache directory exists (Vercel serverless: use /tmp for writable storage)
try {
  if (!existsSync(SITEMAP_CACHE_DIR)) {
    mkdirSync(SITEMAP_CACHE_DIR, { recursive: true });
  }
} catch (err) {
  console.warn(`[Sitemap] Failed to create cache directory ${SITEMAP_CACHE_DIR}:`, err);
}

function toSlug(value: string | null | undefined): string {
  if (!value) return "";
  return value
    .toString()
    .normalize("NFKD")
    .toLowerCase()
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/**
 * Get a valid lastmod date string from a DB timestamp.
 * Returns the actual DB date, or today if no timestamp is available.
 */
function getValidLastmod(dbTimestamp: any): string {
  const today = new Date().toISOString().split("T")[0];
  if (!dbTimestamp) return today;
  const dbDate = new Date(dbTimestamp);
  if (isNaN(dbDate.getTime())) return today;
  return dbDate.toISOString().split("T")[0];
}

function isCacheValid(filename: string): boolean {
  try {
    const filepath = join(SITEMAP_CACHE_DIR, filename);
    if (!existsSync(filepath)) return false;
    const stat = statSync(filepath);
    const age = (Date.now() - stat.mtimeMs) / 1000;
    return age < CACHE_MAX_AGE;
  } catch {
    return false;
  }
}

function getCachedSitemap(filename: string): string | null {
  try {
    if (isCacheValid(filename)) {
      const filepath = join(SITEMAP_CACHE_DIR, filename);
      return readFileSync(filepath, "utf-8");
    }
  } catch {
    // Fall through to regenerate
  }
  return null;
}

function cacheSitemap(filename: string, xml: string): void {
  try {
    const filepath = join(SITEMAP_CACHE_DIR, filename);
    writeFileSync(filepath, xml, "utf-8");
  } catch (err) {
    console.error(`[Sitemap] Failed to cache ${filename}:`, err);
  }
}

// ============= STATIC CONTENT =============
async function generateStaticSitemap(): Promise<string> {
  const cached = getCachedSitemap("static.xml");
  if (cached) return cached;

  const today = new Date().toISOString().split("T")[0];
  let xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <!-- Homepage -->
  <url>
    <loc>https://www.askdetectives.com/</loc>
    <lastmod>${today}</lastmod>
    <changefreq>daily</changefreq>
    <priority>1.0</priority>
  </url>
  <url>
    <loc>https://www.askdetectives.com/search</loc>
    <lastmod>${today}</lastmod>
    <changefreq>daily</changefreq>
    <priority>0.9</priority>
  </url>
  <url>
    <loc>https://www.askdetectives.com/categories</loc>
    <lastmod>${today}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.9</priority>
  </url>
  <url>
    <loc>https://www.askdetectives.com/news</loc>
    <lastmod>${today}</lastmod>
    <changefreq>daily</changefreq>
    <priority>0.8</priority>
  </url>
  <url>
    <loc>https://www.askdetectives.com/locations/countries</loc>
    <lastmod>${today}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.8</priority>
  </url>
  <url>
    <loc>https://www.askdetectives.com/locations/states</loc>
    <lastmod>${today}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.8</priority>
  </url>
  <url>
    <loc>https://www.askdetectives.com/locations/cities</loc>
    <lastmod>${today}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.8</priority>
  </url>
  <url>
    <loc>https://www.askdetectives.com/packages</loc>
    <lastmod>${today}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.8</priority>
  </url>
  <url>
    <loc>https://www.askdetectives.com/about</loc>
    <lastmod>${today}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.6</priority>
  </url>
  <url>
    <loc>https://www.askdetectives.com/contact</loc>
    <lastmod>${today}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.6</priority>
  </url>
  <url>
    <loc>https://www.askdetectives.com/support</loc>
    <lastmod>${today}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.6</priority>
  </url>
  <url>
    <loc>https://www.askdetectives.com/privacy</loc>
    <lastmod>${today}</lastmod>
    <changefreq>yearly</changefreq>
    <priority>0.4</priority>
  </url>
  <url>
    <loc>https://www.askdetectives.com/terms</loc>
    <lastmod>${today}</lastmod>
    <changefreq>yearly</changefreq>
    <priority>0.4</priority>
  </url>
</urlset>`;

  cacheSitemap("static.xml", xml);
  return xml;
}

// ============= COUNTRIES =============
async function generateCountriesSitemap(): Promise<string> {
  const cached = getCachedSitemap("countries.xml");
  if (cached) return cached;
  
  const today = new Date().toISOString().split("T")[0];

  let xml = `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
`;

  const result = await pool.query(`
    SELECT c.name as country_name,
           c.slug as country_slug,
           MAX(d.created_at) as last_mod,
           COUNT(d.id)::int AS detective_count
    FROM countries c
    INNER JOIN detectives d ON d.country_id = c.id
    WHERE d.status = 'active'
    GROUP BY c.name, c.slug
    HAVING COUNT(d.id) >= 3
    ORDER BY c.name
  `);

  for (const row of result.rows) {
    const lastmod = row.last_mod
      ? new Date(row.last_mod).toISOString().split("T")[0]
      : today;
    const countrySlug = row.country_slug || toSlug(row.country_name);

    xml += `  <url>
    <loc>https://www.askdetectives.com/detectives/${countrySlug}/</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.8</priority>
  </url>
`;
  }

  xml += `</urlset>`;
  cacheSitemap("countries.xml", xml);
  return xml;
}

// ============= STATES (PAGINATED) =============
async function generateStatesSitemap(page: number = 1): Promise<string> {
  const cacheFile = `states-${page}.xml`;
  const cached = getCachedSitemap(cacheFile);
  if (cached) return cached;

  const pageSize = SITEMAP_PAGE_SIZE;
  const offset = (page - 1) * pageSize;

  let xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
`;

  // Include only states that currently have at least one active detective
  const result = await pool.query(
    `
    SELECT c.name as country_name,
           c.slug as country_slug,
           s.name as state_name,
           s.slug as state_slug,
           MAX(d.updated_at) as last_mod
    FROM states s
    INNER JOIN countries c ON s.country_id = c.id
    INNER JOIN detectives d ON d.state_id = s.id
    WHERE d.status = 'active'
    GROUP BY c.name, c.slug, s.name, s.slug
    HAVING COUNT(d.id) >= 5
    ORDER BY c.name, s.name
    LIMIT $1 OFFSET $2
  `,
    [pageSize, offset]
  );

  for (const row of result.rows) {
    const lastmod = getValidLastmod(row.last_mod);
    const countrySlug = row.country_slug || toSlug(row.country_name);
    const stateSlug = row.state_slug || toSlug(row.state_name);

    xml += `  <url>
    <loc>https://www.askdetectives.com/detectives/${countrySlug}/${stateSlug}/</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.75</priority>
  </url>
`;
  }

  xml += `</urlset>`;
  cacheSitemap(cacheFile, xml);
  return xml;
}

// ============= CITIES (PAGINATED) =============
async function generateCitiesSitemap(page: number = 1): Promise<string> {
  const cacheFile = `cities-${page}.xml`;
  const cached = getCachedSitemap(cacheFile);
  if (cached) return cached;

  const pageSize = SITEMAP_PAGE_SIZE;
  const offset = (page - 1) * pageSize;

  let xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
`;

  // Include only cities that currently have at least one active detective
  const result = await pool.query(
    `
    SELECT c.name as country_name,
           c.slug as country_slug,
           s.name as state_name,
           s.slug as state_slug,
           ci.name as city_name,
           ci.slug as city_slug,
           MAX(d.updated_at) as last_mod
    FROM cities ci
    INNER JOIN states s ON ci.state_id = s.id
    INNER JOIN countries c ON s.country_id = c.id
    INNER JOIN detectives d ON d.city_id = ci.id
    WHERE d.status = 'active'
    GROUP BY c.name, c.slug, s.name, s.slug, ci.name, ci.slug
    HAVING COUNT(d.id) >= 3
    ORDER BY c.name, s.name, ci.name
    LIMIT $1 OFFSET $2
  `,
    [pageSize, offset]
  );

  for (const row of result.rows) {
    const lastmod = getValidLastmod(row.last_mod);
    const countrySlug = row.country_slug || toSlug(row.country_name);
    const stateSlug = row.state_slug || toSlug(row.state_name);
    const citySlug = row.city_slug || toSlug(row.city_name);

    xml += `  <url>
    <loc>https://www.askdetectives.com/detectives/${countrySlug}/${stateSlug}/${citySlug}/</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.7</priority>
  </url>
`;
  }

  xml += `</urlset>`;
  cacheSitemap(cacheFile, xml);
  return xml;
}

// ============= GET STATES SITEMAP COUNT =============
async function getStatesSitemapCount(): Promise<number> {
  const result = await pool.query(`
    SELECT COUNT(DISTINCT s.id) as count
    FROM states s
    INNER JOIN detectives d ON d.state_id = s.id
    WHERE d.status = 'active'
  `);
    const totalStates = Number(result.rows[0].count);
  return Math.ceil(totalStates / SITEMAP_PAGE_SIZE);
}

// ============= GET CITIES SITEMAP COUNT =============
async function getCitiesSitemapCount(): Promise<number> {
  const result = await pool.query(`
    SELECT COUNT(DISTINCT ci.id) as count
    FROM cities ci
    INNER JOIN detectives d ON d.city_id = ci.id
    WHERE d.status = 'active'
  `);
    const totalCities = Number(result.rows[0].count);
    return Math.ceil(totalCities / SITEMAP_PAGE_SIZE);
}

// ============= DETECTIVES =============
async function generateDetectivesSitemap(): Promise<string> {
  const cached = getCachedSitemap("detectives.xml");
  if (cached) return cached;

  let xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
`;

  const result = await pool.query(`
    SELECT
      d.id,
      d.slug,
      d.updated_at,
      c.name as country_name,
      c.slug as country_slug,
      d.state as state_name,
      d.city as city_name
    FROM detectives d
    INNER JOIN countries c ON d.country_id = c.id
    WHERE d.status = 'active' 
      AND d.slug IS NOT NULL AND d.slug != ''
      AND d.state_id IS NOT NULL 
      AND d.city_id IS NOT NULL
    ORDER BY d.updated_at DESC
  `);

  for (const profile of result.rows) {
    const lastmod = getValidLastmod(profile.updated_at);
    const countrySlug = toSlug(profile.country_name || profile.country_slug);
    const stateSlug = toSlug(profile.state_name);
    const citySlug = toSlug(profile.city_name);

    let url = `https://www.askdetectives.com/detectives/${countrySlug}/${stateSlug}/${citySlug}/${profile.slug}/`;

    xml += `  <url>
    <loc>${url}</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.8</priority>
  </url>
`;
  }

  xml += `</urlset>`;
  cacheSitemap("detectives.xml", xml);
  return xml;
}

// ============= SERVICES (PAGINATED) =============
async function generateServicesSitemap(page: number = 1): Promise<string> {
  const cacheFile = `services-${page}.xml`;
  const cached = getCachedSitemap(cacheFile);
  if (cached) return cached;

  const pageSize = SITEMAP_PAGE_SIZE;
  const offset = (page - 1) * pageSize;

  let xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
`;

  const result = await pool.query(
    `
    SELECT 
      s.id,
      s.slug,
      s.updated_at,
      c.name as country_name,
      c.slug as country_slug,
      d.state as state_name,
      d.city as city_name,
      d.slug as detective_slug,
      d.business_name as detective_business_name
    FROM services s
    INNER JOIN detectives d ON s.detective_id = d.id
    INNER JOIN countries c ON d.country_id = c.id
    WHERE s.is_active = true AND d.status = 'active'
      AND s.images IS NOT NULL AND array_length(s.images, 1) > 0
    ORDER BY s.updated_at DESC
    LIMIT $1 OFFSET $2
  `,
    [pageSize, offset]
  );

  for (const service of result.rows) {
    const lastmod = getValidLastmod(service.updated_at);

    if (!service.slug || !service.country_slug) {
      continue;
    }

    // Skip services missing location data — these would generate 404 URLs
    if (!service.state_name || !service.city_name) {
      continue;
    }

    const detectiveSlug =
      service.detective_slug ||
      toSlug(service.detective_business_name) ||
      "detective";
    const countrySlug = toSlug(service.country_name || service.country_slug);
    const stateSlug = toSlug(service.state_name);
    const citySlug = toSlug(service.city_name);
    const url = `https://www.askdetectives.com/service/${countrySlug}/${stateSlug}/${citySlug}/${detectiveSlug}/${service.slug}`;

    xml += `  <url>
    <loc>${url}</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.7</priority>
  </url>
`;
  }

  xml += `</urlset>`;
  cacheSitemap(cacheFile, xml);
  return xml;
}

// ============= GET SERVICE SITEMAP COUNT =============
async function getServiceSitemapCount(): Promise<number> {
  const result = await pool.query(`
    SELECT COUNT(*) as count FROM services s
    INNER JOIN detectives d ON s.detective_id = d.id
    WHERE s.is_active = true AND d.status = 'active'
      AND s.images IS NOT NULL AND array_length(s.images, 1) > 0
  `);
  const totalServices = result.rows[0].count;
  return Math.ceil(totalServices / SITEMAP_PAGE_SIZE);
}

// ============= SERVICE LOCATIONS (PAGINATED) =============
function categoryNameToSlug(name: string): string {
  return name.toLowerCase().trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '');
}

// Base WHERE clause shared across all three levels of the UNION query
const SVC_LOC_BASE_WHERE = `
  sv.is_active = true
  AND sv.category IS NOT NULL AND sv.category != ''
  AND sv.images IS NOT NULL AND array_length(sv.images, 1) > 0
`;

async function generateServiceLocationsSitemap(page: number = 1): Promise<string> {
  const cacheFile = `service-locations-${page}.xml`;
  const cached = getCachedSitemap(cacheFile);
  if (cached) return cached;

  const pageSize = SITEMAP_PAGE_SIZE; // 1 URL per row
  const offset = (page - 1) * pageSize;

  // UNION produces one already-deduplicated row per URL level:
  //   level 1 → country-only URLs   (deduplicated by SQL GROUP BY)
  //   level 2 → state-level URLs    (deduplicated by SQL GROUP BY)
  //   level 3 → city-level URLs     (deduplicated by SQL GROUP BY)
  // This eliminates the cross-page duplicate country/state problem entirely.
  const result = await pool.query(
    `
    SELECT level, category_name, country_slug, state_slug, city_slug, last_mod
    FROM (
      -- Country level (unique per category + country)
      SELECT 1 AS level,
             sv.category AS category_name,
             c.slug      AS country_slug,
             NULL::text  AS state_slug,
             NULL::text  AS city_slug,
             MAX(sv.updated_at) AS last_mod
      FROM services sv
      INNER JOIN detectives d ON sv.detective_id = d.id AND d.status = 'active'
      INNER JOIN countries  c ON d.country_id = c.id
      WHERE ${SVC_LOC_BASE_WHERE}
      GROUP BY sv.category, c.slug

      UNION ALL

      -- State level (unique per category + country + state)
      SELECT 2,
             sv.category,
             c.slug,
             s.slug,
             NULL::text,
             MAX(sv.updated_at)
      FROM services sv
      INNER JOIN detectives d ON sv.detective_id = d.id AND d.status = 'active'
      INNER JOIN countries  c ON d.country_id = c.id
      INNER JOIN states     s ON d.state_id   = s.id
      WHERE ${SVC_LOC_BASE_WHERE}
      GROUP BY sv.category, c.slug, s.slug

      UNION ALL

      -- City level (unique per category + country + state + city)
      SELECT 3,
             sv.category,
             c.slug,
             s.slug,
             ci.slug,
             MAX(sv.updated_at)
      FROM services sv
      INNER JOIN detectives d  ON sv.detective_id = d.id AND d.status = 'active'
      INNER JOIN countries  c  ON d.country_id    = c.id
      INNER JOIN states     s  ON d.state_id      = s.id
      INNER JOIN cities     ci ON d.city_id       = ci.id
      WHERE ${SVC_LOC_BASE_WHERE}
      GROUP BY sv.category, c.slug, s.slug, ci.slug
    ) combined
    ORDER BY level, category_name, country_slug, state_slug NULLS FIRST, city_slug NULLS FIRST
    LIMIT $1 OFFSET $2
    `,
    [pageSize, offset]
  );

  let xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
`;

  for (const row of result.rows) {
    const catSlug = categoryNameToSlug(row.category_name);
    const country = row.country_slug;
    const state = row.state_slug;
    const city = row.city_slug;
    const lastmod = getValidLastmod(row.last_mod);

    if (!catSlug || !country) continue;

    let loc: string;
    let priority: string;

    if (!state) {
      // Country-level URL
      loc = `https://www.askdetectives.com/locations/${catSlug}/${country}/`;
      priority = "0.7";
    } else if (!city) {
      // State-level URL
      loc = `https://www.askdetectives.com/locations/${catSlug}/${country}/${state}/`;
      priority = "0.65";
    } else {
      // City-level URL
      loc = `https://www.askdetectives.com/locations/${catSlug}/${country}/${state}/${city}/`;
      priority = "0.6";
    }

    xml += `  <url>
    <loc>${loc}</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>${priority}</priority>
  </url>
`;
  }

  xml += `</urlset>`;
  cacheSitemap(cacheFile, xml);
  return xml;
}

// ============= GET SERVICE LOCATIONS SITEMAP COUNT =============
async function getServiceLocationsSitemapCount(): Promise<number> {
  // Count all three levels (country + state + city) to get the true total rows
  const result = await pool.query(`
    SELECT (
      (SELECT COUNT(DISTINCT (sv.category, c.slug))
       FROM services sv
       INNER JOIN detectives d ON sv.detective_id = d.id AND d.status = 'active'
       INNER JOIN countries  c ON d.country_id = c.id
       WHERE ${SVC_LOC_BASE_WHERE})
      +
      (SELECT COUNT(DISTINCT (sv.category, c.slug, s.slug))
       FROM services sv
       INNER JOIN detectives d ON sv.detective_id = d.id AND d.status = 'active'
       INNER JOIN countries  c ON d.country_id = c.id
       INNER JOIN states     s ON d.state_id   = s.id
       WHERE ${SVC_LOC_BASE_WHERE})
      +
      (SELECT COUNT(DISTINCT (sv.category, c.slug, s.slug, ci.slug))
       FROM services sv
       INNER JOIN detectives d  ON sv.detective_id = d.id AND d.status = 'active'
       INNER JOIN countries  c  ON d.country_id    = c.id
       INNER JOIN states     s  ON d.state_id      = s.id
       INNER JOIN cities     ci ON d.city_id       = ci.id
       WHERE ${SVC_LOC_BASE_WHERE})
    ) AS total
  `);
  const total = parseInt(result.rows[0].total) || 0;
  return Math.max(1, Math.ceil(total / SITEMAP_PAGE_SIZE));
}

// ============= CMS PAGES + ARCHIVES (PAGINATED) =============
async function getCmsSitemapCount(): Promise<number> {
  const result = await pool.query(
    `
    WITH RECURSIVE category_paths AS (
      SELECT c.id, c.parent_id, c.slug::text AS path_slug
      FROM categories c
      WHERE c.parent_id IS NULL
        AND c.status = 'published'
        AND COALESCE(TRIM(c.slug), '') <> ''

      UNION ALL

      SELECT child.id, child.parent_id, (cp.path_slug || '/' || child.slug)::text AS path_slug
      FROM categories child
      INNER JOIN category_paths cp ON cp.id = child.parent_id
      WHERE child.status = 'published'
        AND COALESCE(TRIM(child.slug), '') <> ''
    ),
    canonical_pages AS (
      SELECT DISTINCT p.id
      FROM pages p
      INNER JOIN category_paths cp ON cp.id = p.category_id
      WHERE p.status = 'published'
        AND p.category_id IS NOT NULL
        AND COALESCE(TRIM(p.slug), '') <> ''
    ),
    category_archives AS (
      SELECT DISTINCT cp.id
      FROM pages p
      INNER JOIN category_paths cp ON cp.id = p.category_id
      WHERE p.status = 'published'
        AND p.category_id IS NOT NULL
        AND COALESCE(TRIM(p.slug), '') <> ''
    ),
    tag_archives AS (
      SELECT DISTINCT t.id
      FROM tags t
      INNER JOIN page_tags pt ON pt.tag_id = t.id
      INNER JOIN pages p ON p.id = pt.page_id
      WHERE p.status = 'published'
        AND COALESCE(TRIM(p.slug), '') <> ''
        AND COALESCE(TRIM(t.slug), '') <> ''
    )
    SELECT (
      (SELECT COUNT(*) FROM canonical_pages)
      +
      (SELECT COUNT(*) FROM category_archives)
      +
      (SELECT COUNT(*) FROM tag_archives)
    ) AS total
    `,
  );

  const total = Number(result.rows[0]?.total || 0);
  return Math.max(1, Math.ceil(total / SITEMAP_PAGE_SIZE));
}

async function generateCmsSitemap(page: number = 1): Promise<string> {
  const cacheFile = `cms-${page}.xml`;
  const cached = getCachedSitemap(cacheFile);
  if (cached) return cached;

  const offset = (page - 1) * SITEMAP_PAGE_SIZE;

  const result = await pool.query(
    `
    WITH RECURSIVE category_paths AS (
      SELECT c.id, c.parent_id, c.slug::text AS path_slug, c.slug::text AS display_slug
      FROM categories c
      WHERE c.parent_id IS NULL
        AND c.status = 'published'
        AND COALESCE(TRIM(c.slug), '') <> ''

      UNION ALL

      SELECT child.id,
             child.parent_id,
             (cp.path_slug || '/' || child.slug)::text AS path_slug,
             child.slug::text AS display_slug
      FROM categories child
      INNER JOIN category_paths cp ON cp.id = child.parent_id
      WHERE child.status = 'published'
        AND COALESCE(TRIM(child.slug), '') <> ''
    ),
    canonical_pages AS (
      SELECT
        1 AS sort_group,
        ('https://www.askdetectives.com/' || cp.path_slug || '/' || p.slug) AS loc,
        GREATEST(COALESCE(p.updated_at, p.created_at), p.created_at) AS last_mod,
        'weekly'::text AS changefreq,
        '0.7'::text AS priority
      FROM pages p
      INNER JOIN category_paths cp ON cp.id = p.category_id
      WHERE p.status = 'published'
        AND p.category_id IS NOT NULL
        AND COALESCE(TRIM(p.slug), '') <> ''
    ),
    category_archives AS (
      SELECT
        2 AS sort_group,
        ('https://www.askdetectives.com/blog/category/' || cp.path_slug) AS loc,
        MAX(GREATEST(COALESCE(p.updated_at, p.created_at), p.created_at)) AS last_mod,
        'weekly'::text AS changefreq,
        '0.5'::text AS priority
      FROM pages p
      INNER JOIN category_paths cp ON cp.id = p.category_id
      WHERE p.status = 'published'
        AND p.category_id IS NOT NULL
        AND COALESCE(TRIM(p.slug), '') <> ''
      GROUP BY cp.path_slug
    ),
    tag_archives AS (
      SELECT
        3 AS sort_group,
        ('https://www.askdetectives.com/blog/tag/' || t.slug) AS loc,
        MAX(GREATEST(COALESCE(p.updated_at, p.created_at), p.created_at)) AS last_mod,
        'weekly'::text AS changefreq,
        '0.4'::text AS priority
      FROM tags t
      INNER JOIN page_tags pt ON pt.tag_id = t.id
      INNER JOIN pages p ON p.id = pt.page_id
      WHERE p.status = 'published'
        AND COALESCE(TRIM(p.slug), '') <> ''
        AND COALESCE(TRIM(t.slug), '') <> ''
      GROUP BY t.slug
    ),
    all_indexable_urls AS (
      SELECT * FROM canonical_pages
      UNION ALL
      SELECT * FROM category_archives
      UNION ALL
      SELECT * FROM tag_archives
    )
    SELECT loc, last_mod, changefreq, priority
    FROM all_indexable_urls
    ORDER BY sort_group, loc
    LIMIT $1 OFFSET $2
    `,
    [SITEMAP_PAGE_SIZE, offset],
  );

  let xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
`;

  for (const row of result.rows) {
    xml += `  <url>
    <loc>${row.loc}</loc>
    <lastmod>${getValidLastmod(row.last_mod)}</lastmod>
    <changefreq>${row.changefreq || "weekly"}</changefreq>
    <priority>${row.priority || "0.6"}</priority>
  </url>
`;
  }

  xml += `</urlset>`;
  cacheSitemap(cacheFile, xml);
  return xml;
}

// ============= NEWS/ARTICLES =============
async function generateNewsSitemap(): Promise<string> {
  const cached = getCachedSitemap("news.xml");
  if (cached) return cached;

  let xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
`;

  const result = await pool.query(`
    SELECT
      cs.slug,
      cs.updated_at,
      cs.published_at
    FROM case_studies cs
    WHERE cs.published_at <= NOW()
      AND COALESCE(TRIM(cs.slug), '') <> ''
    ORDER BY cs.published_at DESC
  `);

  for (const article of result.rows) {
    if (!article.slug) {
      continue;
    }

    const lastmod = getValidLastmod(article.updated_at || article.published_at);

    const url = `https://www.askdetectives.com/news/${article.slug}`;

    xml += `  <url>
    <loc>${url}</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.7</priority>
  </url>
`;
  }

  xml += `</urlset>`;
  cacheSitemap("news.xml", xml);
  return xml;
}

// ============= SITEMAP INDEX =============
async function generateSitemapIndex(): Promise<string> {
  const cached = getCachedSitemap("index.xml");
  if (cached) return cached;

  const servicePages = await getServiceSitemapCount();
  const statesPages = await getStatesSitemapCount();
  const citiesPages = await getCitiesSitemapCount();
  const serviceLocationPages = await getServiceLocationsSitemapCount();
  const cmsPages = await getCmsSitemapCount();

  let xml = `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <sitemap>
    <loc>https://www.askdetectives.com/sitemap-static.xml</loc>
  </sitemap>
  <sitemap>
    <loc>https://www.askdetectives.com/sitemap-countries.xml</loc>
  </sitemap>
`;

  for (let i = 1; i <= statesPages; i++) {
    xml += `  <sitemap>
    <loc>https://www.askdetectives.com/sitemap-states-${i}.xml</loc>
  </sitemap>
`;
  }

  for (let i = 1; i <= citiesPages; i++) {
    xml += `  <sitemap>
    <loc>https://www.askdetectives.com/sitemap-cities-${i}.xml</loc>
  </sitemap>
`;
  }

  xml += `  <sitemap>
    <loc>https://www.askdetectives.com/sitemap-detectives.xml</loc>
  </sitemap>
  <sitemap>
    <loc>https://www.askdetectives.com/sitemap-news.xml</loc>
  </sitemap>
`;

  for (let i = 1; i <= servicePages; i++) {
    xml += `  <sitemap>
    <loc>https://www.askdetectives.com/sitemap-services-${i}.xml</loc>
  </sitemap>
`;
  }

  for (let i = 1; i <= serviceLocationPages; i++) {
    xml += `  <sitemap>
    <loc>https://www.askdetectives.com/sitemap-service-locations-${i}.xml</loc>
  </sitemap>
`;
  }

  for (let i = 1; i <= cmsPages; i++) {
    xml += `  <sitemap>
    <loc>https://www.askdetectives.com/sitemap-cms-${i}.xml</loc>
  </sitemap>
`;
  }

  xml += `</sitemapindex>`;
  cacheSitemap("index.xml", xml);
  return xml;
}

/**
 * Invalidates specific sitemap cache files so the next HTTP request regenerates them.
 * Safe to call fire-and-forget — errors are logged, never thrown.
 *
 * @param types - Which sitemap groups to bust.
 *   'detectives'        → detectives.xml + index.xml
 *   'services'          → sitemap-services-*.xml + index.xml
 *   'service-locations' → sitemap-service-locations-*.xml + index.xml
 *   'news'              → news.xml + index.xml
 *   'all'               → every file in the cache directory
 */
export function invalidateSitemapCache(
  types: Array<"detectives" | "services" | "service-locations" | "news" | "cms" | "all">
): void {
  try {
    let files: string[];
    try {
      files = readdirSync(SITEMAP_CACHE_DIR);
    } catch {
      return; // Cache dir doesn't exist yet — nothing to invalidate
    }

    const toDelete = new Set<string>();

    if (types.includes("all")) {
      files.forEach(f => toDelete.add(f));
    } else {
      // The index must be regenerated whenever any sub-sitemap changes
      if (files.includes("index.xml")) toDelete.add("index.xml");

      if (types.includes("detectives")) {
        toDelete.add("detectives.xml");
      }
      if (types.includes("services")) {
        files.filter(f => f.startsWith("services-")).forEach(f => toDelete.add(f));
      }
      if (types.includes("service-locations")) {
        files.filter(f => f.startsWith("service-locations-")).forEach(f => toDelete.add(f));
      }
      if (types.includes("news")) {
        toDelete.add("news.xml");
      }
      if (types.includes("cms")) {
        files.filter(f => f.startsWith("cms-")).forEach(f => toDelete.add(f));
      }
    }

    const deleted: string[] = [];
    for (const file of toDelete) {
      try {
        const filepath = join(SITEMAP_CACHE_DIR, file);
        if (existsSync(filepath)) {
          unlinkSync(filepath);
          deleted.push(file);
        }
      } catch (err) {
        console.warn(`[Sitemap] Failed to delete cache file ${file}:`, err);
      }
    }

    if (deleted.length > 0) {
      console.log(`[Sitemap] Cache invalidated: ${deleted.join(", ")}`);
    }
  } catch (err) {
    console.warn("[Sitemap] invalidateSitemapCache error:", err);
  }
}

/**
 * Pings Bing (and compatible engines) with the sitemap URL.
 * Google is notified per-URL via the existing Indexing API service.
 * Fire-and-forget — call without await.
 */
export async function pingSitemapToSearchEngines(): Promise<void> {
  const sitemapUrl = "https://www.askdetectives.com/sitemap.xml";
  try {
    const res = await fetch(
      `https://www.bing.com/ping?sitemap=${encodeURIComponent(sitemapUrl)}`
    );
    if (res.ok) {
      console.log("[Sitemap] Bing pinged successfully");
    } else {
      console.warn(`[Sitemap] Bing ping returned HTTP ${res.status}`);
    }
  } catch (err) {
    console.warn("[Sitemap] Failed to ping Bing:", err);
  }
}

export {
  generateStaticSitemap,
  generateCountriesSitemap,
  generateStatesSitemap,
  generateCitiesSitemap,
  generateDetectivesSitemap,
  generateServicesSitemap,
  generateServiceLocationsSitemap,
  generateCmsSitemap,
  generateNewsSitemap,
  generateSitemapIndex,
  getServiceSitemapCount,
  getServiceLocationsSitemapCount,
  getCmsSitemapCount,
  getStatesSitemapCount,
  getCitiesSitemapCount,
  CACHE_MAX_AGE,
};
