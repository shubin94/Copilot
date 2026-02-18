import { Router, Request, Response } from "express";
import { gzipSync } from "zlib";
import {
  generateSitemapIndex,
  generateStaticSitemap,
  generateCountriesSitemap,
  generateStatesSitemap,
  generateCitiesSitemap,
  generateDetectivesSitemap,
  generateServicesSitemap,
  getServiceSitemapCount,
  CACHE_MAX_AGE,
} from "../services/sitemapService.ts";

const router = Router();

// Helper to send XML with proper headers and compression
async function sendSitemap(
  res: Response,
  xmlGenerator: () => Promise<string>
) {
  try {
    const xml = await xmlGenerator();

    // Gzip compress the response
    const compressed = gzipSync(xml);

    res.header("Content-Type", "application/xml");
    res.header("Content-Encoding", "gzip");
    res.header("Cache-Control", `public, max-age=${CACHE_MAX_AGE}`);
    res.header("ETag", `"${Buffer.from(xml).toString("base64").slice(0, 32)}"`);

    res.send(compressed);

    console.log(
      `[Sitemap] Served ${compressed.length} bytes (gzipped) for ${xml.length} bytes (uncompressed)`
    );
  } catch (error) {
    console.error("[Sitemap] Error generating sitemap:", error);
    res.status(500).json({ error: "Failed to generate sitemap" });
  }
}

// Main sitemap index - /sitemap.xml
router.get(/\.xml$/, async (req: Request, res: Response) => {
  console.log(`[Sitemap] Handling sitemap index request: ${req.originalUrl}`);
  await sendSitemap(res, generateSitemapIndex);
});

// Static pages sitemap - /sitemap-static.xml
router.get(/-static\.xml$/, async (req: Request, res: Response) => {
  console.log(`[Sitemap] Serving static sitemap`);
  await sendSitemap(res, generateStaticSitemap);
});

// Countries sitemap - /sitemap-countries.xml
router.get(/-countries\.xml$/, async (req: Request, res: Response) => {
  console.log(`[Sitemap] Serving countries sitemap`);
  await sendSitemap(res, generateCountriesSitemap);
});

// States sitemap - /sitemap-states.xml
router.get(/-states\.xml$/, async (req: Request, res: Response) => {
  console.log(`[Sitemap] Serving states sitemap`);
  await sendSitemap(res, generateStatesSitemap);
});

// Cities sitemap - /sitemap-cities.xml
router.get(/-cities\.xml$/, async (req: Request, res: Response) => {
  console.log(`[Sitemap] Serving cities sitemap`);
  await sendSitemap(res, generateCitiesSitemap);
});

// Detectives sitemap - /sitemap-detectives.xml
router.get(/-detectives\.xml$/, async (req: Request, res: Response) => {
  console.log(`[Sitemap] Serving detectives sitemap`);
  await sendSitemap(res, generateDetectivesSitemap);
});

// Services sitemaps (paginated) - /sitemap-services-1.xml, /sitemap-services-2.xml, etc.
router.get(/-services-(\d+)\.xml$/, async (req: Request, res: Response) => {
  const match = req.path.match(/-services-(\d+)\.xml$/);
  const page = match ? parseInt(match[1]) : 1;
  
  console.log(`[Sitemap] Serving services sitemap page ${page}`);

  // Validate page number
  if (page < 1 || page > 1000) {
    return res.status(400).json({ error: "Invalid page number" });
  }

  try {
    const totalPages = await getServiceSitemapCount();
    if (page > totalPages) {
      return res.status(404).json({ error: `Page ${page} does not exist` });
    }

    await sendSitemap(res, () => generateServicesSitemap(page));
  } catch (error) {
    console.error("[Sitemap] Error with services page:", error);
    res.status(500).json({ error: "Failed to generate services sitemap" });
  }
});

// Status endpoint - get sitemap statistics
router.get(/-status\.json$/, async (req: Request, res: Response) => {
  try {
    const { pool } = await import("../../db/index.ts");
    
    const r = await pool.query(`
      SELECT COUNT(*) as count FROM services s
      INNER JOIN detectives d ON s.detective_id = d.id
      WHERE s.is_active = true AND d.status = 'active'
    `);
    const totalServices = r.rows[0].count;
    const servicePages = Math.ceil(totalServices / 5000);

    res.json({
      status: "ok",
      cache: {
        maxAge: CACHE_MAX_AGE,
        maxAgeHours: Math.round(CACHE_MAX_AGE / 3600),
      },
      sitemaps: {
        index: "/sitemap.xml",
        static: "/sitemap-static.xml",
        countries: "/sitemap-countries.xml",
        states: "/sitemap-states.xml",
        cities: "/sitemap-cities.xml",
        detectives: "/sitemap-detectives.xml",
        services: `${servicePages} pages at /sitemap-services-:page.xml`,
      },
      stats: {
        totalServices,
        servicePages,
        totalSitemaps: 6 + servicePages, // static, countries, states, cities, detectives, index + service pages
      },
    });
  } catch (error) {
    console.error("[Sitemap] Error getting status:", error);
    res.status(500).json({ error: "Failed to get sitemap status" });
  }
});

export default router;
