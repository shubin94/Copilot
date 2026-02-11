import { Router, Request, Response } from "express";
import { pool } from "../../db/index.ts";

const router = Router();

// GET /api/public/categories/:parent/:slug/pages
router.get("/:parent/:slug/pages", async (req: Request, res: Response) => {
  try {
    const { parent, slug } = req.params;
    if (!slug) {
      return res.status(400).json({ error: "Category slug is required" });
    }
    if (!parent) {
      return res.status(400).json({ error: "Category parent is required" });
    }

    const categorySlug = `${parent}/${slug}`;
    const result = await pool.query(
      `SELECT 
        p.id,
        p.title,
        p.slug,
        p.content,
        p.banner_image,
        p.created_at,
        c.id as category_id,
        c.name as category_name,
        c.slug as category_slug,
        ARRAY_AGG(JSON_BUILD_OBJECT('id', t.id, 'name', t.name, 'slug', t.slug)) as tags
       FROM pages p
       JOIN categories c ON p.category_id = c.id
       LEFT JOIN page_tags pt ON p.id = pt.page_id
       LEFT JOIN tags t ON pt.tag_id = t.id
       WHERE p.status = 'published' AND c.slug = $1
       GROUP BY p.id, c.id, c.name, c.slug
       ORDER BY p.created_at DESC`,
      [categorySlug]
    );

    const pages = result.rows.map((row) => ({
      id: row.id,
      title: row.title,
      slug: row.slug,
      content: row.content,
      bannerImage: row.banner_image,
      createdAt: row.created_at,
      category: {
        id: row.category_id,
        name: row.category_name,
        slug: row.category_slug,
      },
      tags: (row.tags || []).filter((t: any) => t?.id),
    }));

    const category = pages[0]?.category || null;

    res.json({ category, pages });
  } catch (error) {
    console.error("[public-categories] Get category pages error:", error);
    res.status(500).json({ error: "Failed to fetch category pages" });
  }
});

// GET /api/public/categories/:slug/pages
router.get("/:slug/pages", async (req: Request, res: Response) => {
  try {
    const { slug } = req.params;
    if (!slug) {
      return res.status(400).json({ error: "Category slug is required" });
    }

    const result = await pool.query(
      `SELECT 
        p.id,
        p.title,
        p.slug,
        p.content,
        p.banner_image,
        p.created_at,
        c.id as category_id,
        c.name as category_name,
        c.slug as category_slug,
        ARRAY_AGG(JSON_BUILD_OBJECT('id', t.id, 'name', t.name, 'slug', t.slug)) as tags
       FROM pages p
       JOIN categories c ON p.category_id = c.id
       LEFT JOIN page_tags pt ON p.id = pt.page_id
       LEFT JOIN tags t ON pt.tag_id = t.id
       WHERE p.status = 'published' AND c.slug = $1
       GROUP BY p.id, c.id, c.name, c.slug
       ORDER BY p.created_at DESC`,
      [slug]
    );

    const pages = result.rows.map((row) => ({
      id: row.id,
      title: row.title,
      slug: row.slug,
      content: row.content,
      bannerImage: row.banner_image,
      createdAt: row.created_at,
      category: {
        id: row.category_id,
        name: row.category_name,
        slug: row.category_slug,
      },
      tags: (row.tags || []).filter((t: any) => t?.id),
    }));

    const category = pages[0]?.category || null;

    res.json({ category, pages });
  } catch (error) {
    console.error("[public-categories] Get category pages error:", error);
    res.status(500).json({ error: "Failed to fetch category pages" });
  }
});

export default router;
