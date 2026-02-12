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

    // Get all active detectives
    const detectivesResult = await pool.query(`
      SELECT id, updated_at
      FROM detectives
      WHERE status = 'active'
      ORDER BY updated_at DESC
    `);

    xml += `\n  <!-- Detective Profiles -->\n`;
    for (const detective of detectivesResult.rows) {
      const lastmod = detective.updated_at ? new Date(detective.updated_at).toISOString().split('T')[0] : today;
      xml += `  <url>
    <loc>https://www.askdetectives.com/p/${detective.id}</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.8</priority>
  </url>
`;
    }

    // Get all active services
    const servicesResult = await pool.query(`
      SELECT s.id, s.updated_at
      FROM services s
      INNER JOIN detectives d ON s.detective_id = d.id
      WHERE s.is_active = true AND d.status = 'active'
      ORDER BY s.updated_at DESC
    `);

    xml += `\n  <!-- Services -->\n`;
    for (const service of servicesResult.rows) {
      const lastmod = service.updated_at ? new Date(service.updated_at).toISOString().split('T')[0] : today;
      xml += `  <url>
    <loc>https://www.askdetectives.com/service/${service.id}</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.7</priority>
  </url>
`;
    }

    // Close XML
    xml += `</urlset>`;

    // Send XML response
    res.header("Content-Type", "application/xml");
    res.send(xml);

    console.log(`[Sitemap] Generated with ${pagesResult.rows.length} pages, ${categoriesResult.rows.length} categories, ${tagsResult.rows.length} tags, ${detectivesResult.rows.length} detectives, ${servicesResult.rows.length} services`);
  } catch (error) {
    console.error("[Sitemap] Error generating sitemap:", error);
    res.status(500).json({ error: "Failed to generate sitemap" });
  }
});

export default router;
