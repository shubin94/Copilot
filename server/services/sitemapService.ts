/**
 * Sitemap Service - Generates scalable, paginated sitemaps
 * Handles caching, compression, and proper HTTP headers
 */

import { pool } from "../../db/index.js";
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import { join } from "path";


const SITEMAP_CACHE_DIR = "/tmp/.sitemap-cache";
const CACHE_MAX_AGE = 86400; // 24 hours in seconds

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
 * Get a valid lastmod date - uses current date if DB timestamp is older than 30 days
 * This ensures search engines see fresh dates even if DB records haven't been updated
 */
function getValidLastmod(dbTimestamp: any): string {
  const today = new Date().toISOString().split("T")[0];
  
  if (!dbTimestamp) {
    return today;
  }
  
  const dbDate = new Date(dbTimestamp);
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  
  // If DB timestamp is older than 30 days, use current date
  if (dbDate < thirtyDaysAgo) {
    return today;
  }
  
  return dbDate.toISOString().split("T")[0];
}

function isCacheValid(filename: string): boolean {
  try {
    const filepath = join(SITEMAP_CACHE_DIR, filename);
    if (!existsSync(filepath)) return false;
    const stat = require("fs").statSync(filepath);
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

  let xml = `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
`;

  const result = await pool.query(`
    SELECT DISTINCT 
      c.name as country_name,
      c.slug as country_slug,
      MAX(d.updated_at) as last_mod
    FROM countries c
    INNER JOIN detectives d ON d.country_id = c.id
    WHERE d.status = 'active'
    GROUP BY c.name, c.slug
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

  const pageSize = 5000;
  const offset = (page - 1) * pageSize;

  let xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
`;

  const result = await pool.query(
    `
    SELECT DISTINCT 
      c.name as country_name,
      c.slug as country_slug,
      s.name as state_name,
      s.slug as state_slug,
      MAX(d.updated_at) as last_mod
    FROM detectives d
    INNER JOIN countries c ON d.country_id = c.id
    INNER JOIN states s ON d.state_id = s.id
    WHERE d.status = 'active'
    GROUP BY c.name, c.slug, s.name, s.slug
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

  const pageSize = 5000;
  const offset = (page - 1) * pageSize;

  let xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
`;

  const result = await pool.query(
    `
    SELECT DISTINCT 
      c.name as country_name,
      c.slug as country_slug,
      s.name as state_name,
      s.slug as state_slug,
      ci.name as city_name,
      ci.slug as city_slug,
      MAX(d.updated_at) as last_mod
    FROM detectives d
    INNER JOIN countries c ON d.country_id = c.id
    INNER JOIN states s ON d.state_id = s.id
    INNER JOIN cities ci ON d.city_id = ci.id
    WHERE d.status = 'active'
    GROUP BY c.name, c.slug, s.name, s.slug, ci.name, ci.slug
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
    SELECT COUNT(DISTINCT s.id) as count FROM states s
    INNER JOIN detectives d ON d.state_id = s.id
    WHERE d.status = 'active'
  `);
  const totalStates = result.rows[0].count;
  return Math.ceil(totalStates / 5000);
}

// ============= GET CITIES SITEMAP COUNT =============
async function getCitiesSitemapCount(): Promise<number> {
  const result = await pool.query(`
    SELECT COUNT(DISTINCT ci.id) as count FROM cities ci
    INNER JOIN detectives d ON d.city_id = ci.id
    WHERE d.status = 'active'
  `);
  const totalCities = result.rows[0].count;
  return Math.ceil(totalCities / 5000);
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
    WHERE d.status = 'active' AND d.slug IS NOT NULL AND d.slug != ''
    ORDER BY d.updated_at DESC
  `);

  for (const profile of result.rows) {
    const lastmod = getValidLastmod(profile.updated_at);
    const countrySlug = toSlug(profile.country_name || profile.country_slug);
    const stateSlug = profile.state_name ? toSlug(profile.state_name) : "";
    const citySlug = profile.city_name ? toSlug(profile.city_name) : "";

    let url = `https://www.askdetectives.com/detectives/${countrySlug}/`;
    if (stateSlug) {
      url += `${stateSlug}/`;
      if (citySlug) {
        url += `${citySlug}/`;
      }
    }
    url += `${profile.slug}/`;

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

  const pageSize = 5000;
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

    const detectiveSlug =
      service.detective_slug ||
      toSlug(service.detective_business_name) ||
      "detective";
    const countrySlug = toSlug(service.country_name || service.country_slug);
    const stateSlug = service.state_name
      ? toSlug(service.state_name)
      : "region";
    const citySlug = service.city_name
      ? toSlug(service.city_name)
      : "area";
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
  `);
  const totalServices = result.rows[0].count;
  return Math.ceil(totalServices / 5000);
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
    ORDER BY cs.published_at DESC
  `);

  for (const article of result.rows) {
    if (!article.slug) {
      continue;
    }

    const lastmod = getValidLastmod(article.updated_at);

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

  xml += `</sitemapindex>`;
  cacheSitemap("index.xml", xml);
  return xml;
}

export {
  generateStaticSitemap,
  generateCountriesSitemap,
  generateStatesSitemap,
  generateCitiesSitemap,
  generateDetectivesSitemap,
  generateServicesSitemap,
  generateNewsSitemap,
  generateSitemapIndex,
  getServiceSitemapCount,
  getStatesSitemapCount,
  getCitiesSitemapCount,
  CACHE_MAX_AGE,
};
