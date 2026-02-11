import { Router, Request, Response } from "express";
import { pool } from "../../db/index.ts";
import * as cache from "../lib/cache.ts";

const router = Router();
const CMS_PAGE_TTL_SECONDS = 300; // 5 minutes

// Helper to resolve hierarchical category slugs
async function getCategoryIdFromHierarchicalSlug(slugPath: string): Promise<string | null> {
  const directResult = await pool.query("SELECT id FROM categories WHERE slug = $1", [slugPath]);
  if (directResult.rows.length > 0) {
    return directResult.rows[0].id;
  }

  const slugParts = slugPath.split("/");
  let currentCategoryId: string | null = null;

  for (const slug of slugParts) {
    let query = "SELECT id FROM categories WHERE slug = $1";
    const params: any[] = [slug];

    if (currentCategoryId) {
      query += " AND parent_id = $2";
      params.push(currentCategoryId);
    } else {
      query += " AND parent_id IS NULL";
    }

    const result = await pool.query(query, params);
    if (result.rows.length === 0) return null;
    currentCategoryId = result.rows[0].id;
  }

  return currentCategoryId;
}

async function fetchPage(slug: string, category?: string) {
  const baseSelect = `SELECT 
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
     WHERE`;

  const selectWithAuthor = `SELECT 
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
      c.slug as category_slug,
      p.author_name,
      p.author_email,
      p.author_bio,
      p.author_social
     FROM pages p
     LEFT JOIN categories c ON p.category_id = c.id
     WHERE`;

  const runQuery = async (where: string, params: any[]) => {
    try {
      return await pool.query(`${selectWithAuthor} ${where}`, params);
    } catch (error: any) {
      if (error?.message?.includes("column") && error?.message?.includes("does not exist")) {
        return await pool.query(`${baseSelect} ${where}`, params);
      }
      throw error;
    }
  };

  const params: any[] = [slug];
  let where = "p.slug = $1 AND p.status = 'published'";
  let pageResult;

  if (category) {
    // Resolve the hierarchical category slug to get the category ID
    const categoryId = await getCategoryIdFromHierarchicalSlug(category);
    if (categoryId) {
      params.push(categoryId);
      where = `${where} AND p.category_id = $2`;
      pageResult = await runQuery(where, params);
    }
  }

  if (!pageResult || pageResult.rows.length === 0) {
    pageResult = await runQuery("p.slug = $1 AND p.status = 'published'", [slug]);
  }

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
    author: pageRow.author_name ? {
      name: pageRow.author_name,
      email: pageRow.author_email || undefined,
      bio: pageRow.author_bio || undefined,
      socialProfiles: pageRow.author_social || []
    } : null,
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
