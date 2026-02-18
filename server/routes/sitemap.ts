import { Router, Request, Response } from "express";
import { pool } from "../../db/index.ts";

const router = Router();

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

// Generate dynamic sitemap.xml from database
router.get("/", async (req: Request, res: Response) => {
  try {
    const today = new Date().toISOString().split('T')[0];
    
    // Start XML
    let xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <!-- Homepage -->
  <url>
    <loc>https://www.askdetectives.com/</loc>
    <lastmod>${today}</lastmod>
    <changefreq>daily</changefreq>
    <priority>1.0</priority>
  </url>

  <!-- Main Navigation Pages -->
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

  <!-- Static Pages -->
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
`;

    // Get all published CMS pages with categories
    const pagesResult = await pool.query(`
      SELECT 
        p.slug,
        p.updated_at,
        c.slug as category_slug
      FROM pages p
      LEFT JOIN categories c ON p.category_id = c.id
      WHERE p.status = 'published'
      ORDER BY p.updated_at DESC
    `);

    xml += `  <!-- CMS Pages -->\n`;
    for (const page of pagesResult.rows) {
      const lastmod = page.updated_at ? new Date(page.updated_at).toISOString().split('T')[0] : today;
      const url = page.category_slug 
        ? `https://www.askdetectives.com/${page.category_slug}/${page.slug}`
        : `https://www.askdetectives.com/${page.slug}`;
      
      xml += `  <url>
    <loc>${url}</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.7</priority>
  </url>
`;
    }

    // Get all published blog categories
    const categoriesResult = await pool.query(`
      SELECT c.slug, MAX(p.updated_at) as updated_at
      FROM categories c
      INNER JOIN pages p ON p.category_id = c.id AND p.status = 'published'
      WHERE c.status = 'published'
      GROUP BY c.slug
      ORDER BY c.slug ASC
    `);

    xml += `\n  <!-- Blog Categories -->\n`;
    for (const category of categoriesResult.rows) {
      const lastmod = category.updated_at ? new Date(category.updated_at).toISOString().split('T')[0] : today;
      xml += `  <url>
    <loc>https://www.askdetectives.com/blog/category/${category.slug}</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.6</priority>
  </url>
`;
    }

    // Get all published blog tags
    const tagsResult = await pool.query(`
      SELECT t.slug, MAX(p.updated_at) as updated_at
      FROM tags t
      INNER JOIN page_tags pt ON pt.tag_id = t.id
      INNER JOIN pages p ON p.id = pt.page_id AND p.status = 'published'
      WHERE t.status = 'published'
      GROUP BY t.slug
      ORDER BY t.slug ASC
    `);

    xml += `\n  <!-- Blog Tags -->\n`;
    for (const tag of tagsResult.rows) {
      const lastmod = tag.updated_at ? new Date(tag.updated_at).toISOString().split('T')[0] : today;
      xml += `  <url>
    <loc>https://www.askdetectives.com/blog/tag/${tag.slug}</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.5</priority>
  </url>
`;
    }

    xml += `\n  <!-- Location-Based Detective Directories -->
`;
    
    // 1. Country Level Pages
    const countriesResult = await pool.query(`
      SELECT DISTINCT 
        c.name as country_name,
        c.slug as country_slug,
        MAX(d.updated_at) as last_mod
      FROM countries c
      INNER JOIN detectives d ON d.country = c.code
      WHERE d.status = 'active'
      GROUP BY c.name, c.slug
      ORDER BY c.name
    `);

    for (const row of countriesResult.rows) {
      const lastmod = row.last_mod ? new Date(row.last_mod).toISOString().split('T')[0] : today;
      const countrySlug = toSlug(row.country_name || row.country_slug);
      xml += `  <url>
    <loc>https://www.askdetectives.com/detectives/${countrySlug}/</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.8</priority>
  </url>
`;
    }

    // 2. State Level Pages (grouped by state from detective records)
    const statesResult = await pool.query(`
      SELECT DISTINCT 
        c.name as country_name,
        c.slug as country_slug,
        d.state as state_name,
        MAX(d.updated_at) as last_mod
      FROM detectives d
      INNER JOIN countries c ON d.country = c.code
      WHERE d.status = 'active' AND d.state IS NOT NULL AND d.state != ''
      GROUP BY c.name, c.slug, d.state
      ORDER BY c.name, d.state
    `);

    for (const row of statesResult.rows) {
      const lastmod = row.last_mod ? new Date(row.last_mod).toISOString().split('T')[0] : today;
      const countrySlug = toSlug(row.country_name || row.country_slug);
      const stateSlug = toSlug(row.state_name);
      xml += `  <url>
    <loc>https://www.askdetectives.com/detectives/${countrySlug}/${stateSlug}/</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.75</priority>
  </url>
`;
    }

    // 3. City Level Pages (grouped by city from detective records)
    const citiesResult = await pool.query(`
      SELECT DISTINCT 
        c.name as country_name,
        c.slug as country_slug,
        d.state as state_name,
        d.city as city_name,
        MAX(d.updated_at) as last_mod
      FROM detectives d
      INNER JOIN countries c ON d.country = c.code
      WHERE d.status = 'active' AND d.city IS NOT NULL AND d.city != ''
      GROUP BY c.name, c.slug, d.state, d.city
      ORDER BY c.name, d.state, d.city
    `);
    
    for (const row of citiesResult.rows) {
      const lastmod = row.last_mod ? new Date(row.last_mod).toISOString().split('T')[0] : today;
      const countrySlug = toSlug(row.country_name || row.country_slug);
      const stateSlug = toSlug(row.state_name);
      const citySlug = toSlug(row.city_name);
      xml += `  <url>
    <loc>https://www.askdetectives.com/detectives/${countrySlug}/${stateSlug}/${citySlug}/</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.7</priority>
  </url>
`;
    }

    xml += `\n  <!-- Detective Profiles (Slug-Based) -->
`;
    // Get all active detective profiles with slug
    const detectiveProfilesResult = await pool.query(`
      SELECT 
        d.id,
        d.slug,
        d.updated_at,
        c.name as country_name,
        c.slug as country_slug,
        d.state as state_name,
        d.city as city_name
      FROM detectives d
      INNER JOIN countries c ON d.country = c.code
      WHERE d.status = 'active' AND d.slug IS NOT NULL AND d.slug != ''
      ORDER BY d.updated_at DESC
    `);
    
    for (const profile of detectiveProfilesResult.rows) {
      const lastmod = profile.updated_at ? new Date(profile.updated_at).toISOString().split('T')[0] : today;
      const countrySlug = toSlug(profile.country_name || profile.country_slug);
      const stateSlug = profile.state_name ? toSlug(profile.state_name) : '';
      const citySlug = profile.city_name ? toSlug(profile.city_name) : '';

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

    // Get all active services
    const servicesResult = await pool.query(`
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
      INNER JOIN countries c ON d.country = c.code
      WHERE s.is_active = true AND d.status = 'active'
      ORDER BY s.updated_at DESC
    `);

    xml += `\n  <!-- Services -->
`;
    for (const service of servicesResult.rows) {
      const lastmod = service.updated_at ? new Date(service.updated_at).toISOString().split('T')[0] : today;

      if (!service.slug || !service.country_slug) {
        continue;
      }

      const detectiveSlug =
        service.detective_slug || toSlug(service.detective_business_name) || "detective";
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

    // Get published case studies
    xml += `\n  <!-- Case Studies / News Articles -->
`;
    const caseStudiesResult = await pool.query(`
      SELECT slug, published_at, updated_at
      FROM case_studies
      WHERE published_at <= NOW()
      ORDER BY published_at DESC
      LIMIT 1000
    `);

    for (const caseStudy of caseStudiesResult.rows) {
      const lastmod = caseStudy.updated_at ? new Date(caseStudy.updated_at).toISOString().split('T')[0] : today;
      xml += `  <url>
    <loc>https://www.askdetectives.com/news/${caseStudy.slug}</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.75</priority>
  </url>
`;
    }

    // Close XML
    xml += `</urlset>`;

    // Send XML response
    res.header("Content-Type", "application/xml");
    res.send(xml);

    const totalUrls = pagesResult.rows.length + categoriesResult.rows.length + tagsResult.rows.length + servicesResult.rows.length + countriesResult.rows.length + statesResult.rows.length + citiesResult.rows.length + detectiveProfilesResult.rows.length + caseStudiesResult.rows.length;
    console.log(`[Sitemap] Generated ${totalUrls} URLs including:
  - ${pagesResult.rows.length} CMS pages
  - ${categoriesResult.rows.length} blog categories
  - ${tagsResult.rows.length} blog tags
  - ${countriesResult.rows.length} country directories
  - ${statesResult.rows.length} state directories
  - ${citiesResult.rows.length} city directories
  - ${detectiveProfilesResult.rows.length} detective profiles (slugs)
  - ${servicesResult.rows.length} services
  - ${caseStudiesResult.rows.length} case studies / news articles`);
  } catch (error) {
    console.error("[Sitemap] Error generating sitemap:", error);
    res.status(500).json({ error: "Failed to generate sitemap" });
  }
});

export default router;
