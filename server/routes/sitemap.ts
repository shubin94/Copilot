import { Router, Request, Response } from "express";
import { pool } from "../../db/index.ts";

const router = Router();

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

  <!-- Blog -->
  <url>
    <loc>https://www.askdetectives.com/blog</loc>
    <lastmod>${today}</lastmod>
    <changefreq>weekly</changefreq>
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
  <url>
    <loc>https://www.askdetectives.com/detective-signup</loc>
    <lastmod>${today}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.7</priority>
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
      SELECT slug, updated_at
      FROM categories
      WHERE status = 'published'
      ORDER BY name ASC
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
      SELECT slug, updated_at
      FROM tags
      WHERE status = 'published'
      ORDER BY name ASC
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
        c.slug as country_slug,
        MAX(d.updated_at) as last_mod
      FROM countries c
      INNER JOIN detectives d ON d.country = c.code
      WHERE d.status = 'active'
      GROUP BY c.slug
      ORDER BY c.slug
    `);

    for (const row of countriesResult.rows) {
      const lastmod = row.last_mod ? new Date(row.last_mod).toISOString().split('T')[0] : today;
      xml += `  <url>
    <loc>https://www.askdetectives.com/detectives/${row.country_slug}/</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.8</priority>
  </url>
`;
    }

    // 2. State Level Pages
    const statesResult = await pool.query(`
      SELECT DISTINCT 
        c.slug as country_slug,
        s.slug as state_slug,
        MAX(d.updated_at) as last_mod
      FROM states s
      INNER JOIN countries c ON s.country_id = c.id
      INNER JOIN detectives d ON d.country = c.code AND d.state = s.name
      WHERE d.status = 'active'
      GROUP BY c.slug, s.slug
      ORDER BY c.slug, s.slug
    `);

    for (const row of statesResult.rows) {
      const lastmod = row.last_mod ? new Date(row.last_mod).toISOString().split('T')[0] : today;
      xml += `  <url>
    <loc>https://www.askdetectives.com/detectives/${row.country_slug}/${row.state_slug}/</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.75</priority>
  </url>
`;
    }

    // 3. City Level Pages
    const citiesResult = await pool.query(`
      SELECT DISTINCT 
        c.slug as country_slug,
        s.slug as state_slug,
        ci.slug as city_slug,
        MAX(d.updated_at) as last_mod
      FROM cities ci
      INNER JOIN states s ON ci.state_id = s.id
      INNER JOIN countries c ON s.country_id = c.id
      INNER JOIN detectives d ON d.country = c.code AND d.state = s.name AND d.city = ci.name
      WHERE d.status = 'active'
      GROUP BY c.slug, s.slug, ci.slug
      ORDER BY c.slug, s.slug, ci.slug
    `);
    
    for (const row of citiesResult.rows) {
      const lastmod = row.last_mod ? new Date(row.last_mod).toISOString().split('T')[0] : today;
      xml += `  <url>
    <loc>https://www.askdetectives.com/detectives/${row.country_slug}/${row.state_slug}/${row.city_slug}/</loc>
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
        c.slug as country_slug,
        s.slug as state_slug,
        ci.slug as city_slug
      FROM detectives d
      INNER JOIN countries c ON d.country = c.code
      LEFT JOIN states s ON d.state = s.name AND s.country_id = c.id
      LEFT JOIN cities ci ON d.city = ci.name AND ci.state_id = s.id
      WHERE d.status = 'active' AND d.slug IS NOT NULL AND d.slug != ''
      ORDER BY d.updated_at DESC
    `);
    
    for (const profile of detectiveProfilesResult.rows) {
      const lastmod = profile.updated_at ? new Date(profile.updated_at).toISOString().split('T')[0] : today;
      
      let url = `https://www.askdetectives.com/detectives/${profile.country_slug}/`;
      if (profile.state_slug) {
        url += `${profile.state_slug}/`;
        if (profile.city_slug) {
          url += `${profile.city_slug}/`;
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

    xml += `\n  <!-- Legacy Detective Profiles (UUID-Based) -->
`;
    // Keep legacy URLs for backwards compatibility/transition
    const detectivesResult = await pool.query(`
      SELECT id, updated_at
      FROM detectives
      WHERE status = 'active'
      ORDER BY updated_at DESC
    `);

    // Get all active services
    // UPDATED: Fetch location slugs for SEO-friendly URLs
    const servicesResult = await pool.query(`
      SELECT s.id, s.updated_at
      SELECT 
        s.id, 
        s.slug, 
        s.updated_at,
        c.slug as country_slug,
        st.slug as state_slug,
        ci.slug as city_slug
      FROM services s
      INNER JOIN detectives d ON s.detective_id = d.id
      INNER JOIN countries c ON d.country = c.code
      LEFT JOIN states st ON d.state = st.name AND st.country_id = c.id
      LEFT JOIN cities ci ON d.city = ci.name AND ci.state_id = st.id
      WHERE s.is_active = true AND d.status = 'active'
      ORDER BY s.updated_at DESC
    `);

    xml += `\n  <!-- Services -->
`;
    for (const service of servicesResult.rows) {
      const lastmod = service.updated_at ? new Date(service.updated_at).toISOString().split('T')[0] : today;
      
      // Default to ID if slug is missing, otherwise use SEO URL
      let url = `https://www.askdetectives.com/service/${service.id}`;
      
      if (service.slug && service.country_slug) {
         url = `https://www.askdetectives.com/services/${service.country_slug}/`;
         if (service.state_slug) {
           url += `${service.state_slug}/`;
           if (service.city_slug) {
             url += `${service.city_slug}/`;
           }
         }
         url += `${service.slug}`;
      }

      xml += `  <url>
    <loc>https://www.askdetectives.com/service/${service.id}</loc>
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

    const totalUrls = pagesResult.rows.length + categoriesResult.rows.length + tagsResult.rows.length + detectivesResult.rows.length + servicesResult.rows.length + countriesResult.rows.length + statesResult.rows.length + citiesResult.rows.length + detectiveProfilesResult.rows.length + caseStudiesResult.rows.length;
    console.log(`[Sitemap] Generated ${totalUrls} URLs including:
  - ${pagesResult.rows.length} CMS pages
  - ${categoriesResult.rows.length} blog categories
  - ${tagsResult.rows.length} blog tags
  - ${countriesResult.rows.length} country directories
  - ${statesResult.rows.length} state directories
  - ${citiesResult.rows.length} city directories
  - ${detectiveProfilesResult.rows.length} detective profiles (slugs)
  - ${detectivesResult.rows.length} detective profiles (legacy)
  - ${servicesResult.rows.length} services
  - ${caseStudiesResult.rows.length} case studies / news articles`);
  } catch (error) {
    console.error("[Sitemap] Error generating sitemap:", error);
    res.status(500).json({ error: "Failed to generate sitemap" });
  }
});

export default router;
