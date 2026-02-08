import { Router, Request, Response } from "express";
import { pool } from "../../db/index.ts";

const router = Router();

// GET /api/public/tags/:parent/:slug/pages
router.get("/:parent/:slug/pages", async (req: Request, res: Response) => {
  try {
    const { parent, slug } = req.params;
    if (!slug || !parent) {
      return res.status(400).json({ error: "Parent and slug parameters are required" });
    }

    const tagSlug = `${parent}/${slug}`;
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
        t.id as tag_id,
        t.name as tag_name,
        t.slug as tag_slug,
        ARRAY_AGG(JSON_BUILD_OBJECT('id', t2.id, 'name', t2.name, 'slug', t2.slug)) as tags
       FROM pages p
       JOIN page_tags pt ON p.id = pt.page_id
       JOIN tags t ON pt.tag_id = t.id
       LEFT JOIN categories c ON p.category_id = c.id
       LEFT JOIN page_tags pt2 ON p.id = pt2.page_id
       LEFT JOIN tags t2 ON pt2.tag_id = t2.id
       WHERE p.status = 'published' AND t.slug = $1
       GROUP BY p.id, c.id, c.name, c.slug, t.id, t.name, t.slug
       ORDER BY p.created_at DESC`,
      [tagSlug]
    );

    const pages = result.rows.map((row) => ({
      id: row.id,
      title: row.title,
      slug: row.slug,
      content: row.content,
      bannerImage: row.banner_image,
      createdAt: row.created_at,
      category: row.category_id
        ? { id: row.category_id, name: row.category_name, slug: row.category_slug }
        : null,
      tags: (row.tags || []).filter((t: any) => t?.id),
    }));

    const tag = result.rows[0]
      ? { id: result.rows[0].tag_id, name: result.rows[0].tag_name, slug: result.rows[0].tag_slug }
      : null;

    res.json({ tag, pages });
  } catch (error) {
    console.error("[public-tags] Get tag pages error:", error);
    res.status(500).json({ error: "Failed to fetch tag pages" });
  }
});

// GET /api/public/tags/:slug/pages
router.get("/:slug/pages", async (req: Request, res: Response) => {
  try {
    const { slug } = req.params;
    if (!slug) {
      return res.status(400).json({ error: "Tag slug is required" });
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
        t.id as tag_id,
        t.name as tag_name,
        t.slug as tag_slug,
        ARRAY_AGG(JSON_BUILD_OBJECT('id', t2.id, 'name', t2.name, 'slug', t2.slug)) as tags
       FROM pages p
       JOIN page_tags pt ON p.id = pt.page_id
       JOIN tags t ON pt.tag_id = t.id
       LEFT JOIN categories c ON p.category_id = c.id
       LEFT JOIN page_tags pt2 ON p.id = pt2.page_id
       LEFT JOIN tags t2 ON pt2.tag_id = t2.id
       WHERE p.status = 'published' AND t.slug = $1
       GROUP BY p.id, c.id, c.name, c.slug, t.id, t.name, t.slug
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
      category: row.category_id
        ? { id: row.category_id, name: row.category_name, slug: row.category_slug }
        : null,
      tags: (row.tags || []).filter((t: any) => t?.id),
    }));

    const tag = result.rows[0]
      ? { id: result.rows[0].tag_id, name: result.rows[0].tag_name, slug: result.rows[0].tag_slug }
      : null;

    res.json({ tag, pages });
  } catch (error) {
    console.error("[public-tags] Get tag pages error:", error);
    res.status(500).json({ error: "Failed to fetch tag pages" });
  }
});

export default router;
