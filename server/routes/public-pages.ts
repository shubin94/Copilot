import { Router, Request, Response } from "express";
import { pool } from "../../db/index.ts";
import * as cache from "../lib/cache.ts";

const router = Router();
const CMS_PAGE_TTL_SECONDS = 300; // 5 minutes

async function fetchPage(slug: string, category?: string) {
  // For hierarchical categories, we need to query by the full slug path stored in the database
  const params: any[] = [slug];
  let where = "p.slug = $1 AND p.status = 'published'";
  
  if (category) {
    params.push(category);  // This is now the full hierarchical slug (e.g., "test/new")
    where = `${where} AND c.slug = $2`;
  }

  const pageResult = await pool.query(
    `SELECT 
      p.id,
      p.title,
      p.slug,
      p.content,
      p.banner_image,
      p.status,
      p.meta_title,
      p.meta_description,
      p.created_at,
      p.updated_at,
      c.id as category_id,
      c.name as category_name,
      c.slug as category_slug
     FROM pages p
     LEFT JOIN categories c ON p.category_id = c.id
     WHERE ${where}`,
    params
  );

  if (pageResult.rows.length === 0) return null;

  const pageRow = pageResult.rows[0];
  const tagsResult = await pool.query(
    `SELECT t.id, t.name, t.slug
     FROM tags t
     INNER JOIN page_tags pt ON t.id = pt.tag_id
     WHERE pt.page_id = $1`,
    [pageRow.id]
  );

  return {
    id: pageRow.id,
    title: pageRow.title,
    slug: pageRow.slug,
    content: pageRow.content,
    bannerImage: pageRow.banner_image,
    status: pageRow.status,
    metaTitle: pageRow.meta_title,
    metaDescription: pageRow.meta_description,
    createdAt: pageRow.created_at,
    updatedAt: pageRow.updated_at,
    category: pageRow.category_id
      ? { id: pageRow.category_id, name: pageRow.category_name, slug: pageRow.category_slug }
      : null,
    tags: tagsResult.rows.map(row => ({
      id: row.id,
      name: row.name,
      slug: row.slug,
    })),
  };
}

// GET /api/public/pages/:parent/:category/:slug
router.get("/:parent/:category/:slug", async (req: Request, res: Response) => {
  try {
    const { parent, category, slug } = req.params;
    if (!slug || !category || !parent) {
      return res.status(400).json({ error: "Category and slug are required" });
    }

    const categorySlug = `${parent}/${category}`;
    const cacheKey = `cms:page:${categorySlug}:${slug}`;
    try {
      const cached = cache.get<{ id: string; title: string; slug: string; content: string; tags: unknown[] }>(cacheKey);
      if (cached != null && typeof cached === "object" && "slug" in cached) {
        console.debug("[cache HIT]", cacheKey);
        return res.json({ page: cached });
      }
    } catch (_) {
      // Cache failure must not break the request
    }
    console.debug("[cache MISS]", cacheKey);

    console.log(`[public-pages] Fetching page with category: ${categorySlug}, slug: ${slug}`);
    const page = await fetchPage(slug, categorySlug);
    if (!page) {
      console.warn(`[public-pages] Page not found or not published: ${categorySlug}/${slug}`);
      return res.status(404).json({ error: "Page not found" });
    }

    try {
      cache.set(cacheKey, page, CMS_PAGE_TTL_SECONDS);
    } catch (_) {
      // Cache failure must not break the request
    }
    console.log(`[public-pages] Returning page with ${page.tags.length} tags`);
    res.json({ page });
  } catch (error) {
    console.error("[public-pages] Get page error - system error:", {
      slug: req.params.slug,
      category: `${req.params.parent}/${req.params.category}`,
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined
    });
    res.status(500).json({ error: "Failed to fetch page" });
  }
});

// GET /api/public/pages/:category/:slug
router.get("/:category/:slug", async (req: Request, res: Response) => {
  try {
    const { category, slug } = req.params;
    if (!slug || !category) {
      return res.status(400).json({ error: "Category and slug are required" });
    }

    const cacheKey = `cms:page:${category}:${slug}`;
    try {
      const cached = cache.get<{ id: string; title: string; slug: string; content: string; tags: unknown[] }>(cacheKey);
      if (cached != null && typeof cached === "object" && "slug" in cached) {
        console.debug("[cache HIT]", cacheKey);
        return res.json({ page: cached });
      }
    } catch (_) {
      // Cache failure must not break the request
    }
    console.debug("[cache MISS]", cacheKey);

    console.log(`[public-pages] Fetching page with category: ${category}, slug: ${slug}`);
    const page = await fetchPage(slug, category);
    if (!page) {
      console.warn(`[public-pages] Page not found or not published: ${category}/${slug}`);
      return res.status(404).json({ error: "Page not found" });
    }

    try {
      cache.set(cacheKey, page, CMS_PAGE_TTL_SECONDS);
    } catch (_) {
      // Cache failure must not break the request
    }
    console.log(`[public-pages] Returning page with ${page.tags.length} tags`);
    res.json({ page });
  } catch (error) {
    console.error("[public-pages] Get page error - system error:", {
      slug: req.params.slug,
      category: req.params.category,
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined
    });
    res.status(500).json({ error: "Failed to fetch page" });
  }
});

// Legacy: GET /api/public/pages/:slug
router.get("/:slug", async (req: Request, res: Response) => {
  try {
    const { slug } = req.params;
    if (!slug) {
      return res.status(400).json({ error: "Slug is required" });
    }

    const cacheKey = `cms:page:${slug}`;
    try {
      const cached = cache.get<{ id: string; title: string; slug: string; content: string; tags: unknown[] }>(cacheKey);
      if (cached != null && typeof cached === "object" && "slug" in cached) {
        console.debug("[cache HIT]", cacheKey);
        return res.json({ page: cached });
      }
    } catch (_) {
      // Cache failure must not break the request
    }
    console.debug("[cache MISS]", cacheKey);

    console.log(`[public-pages] Fetching page with slug: ${slug}`);
    const page = await fetchPage(slug);
    if (!page) {
      console.warn(`[public-pages] Page not found or not published: ${slug}`);
      return res.status(404).json({ error: "Page not found" });
    }

    try {
      cache.set(cacheKey, page, CMS_PAGE_TTL_SECONDS);
    } catch (_) {
      // Cache failure must not break the request
    }
    console.log(`[public-pages] Returning page with ${page.tags.length} tags`);
    res.json({ page });
  } catch (error) {
    console.error("[public-pages] Get page error - system error:", {
      slug: req.params.slug,
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined
    });
    res.status(500).json({ error: "Failed to fetch page" });
  }
});

export default router;
