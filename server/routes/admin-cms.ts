import { Router, Request, Response } from "express";
import { z } from "zod";
import { fromZodError } from "zod-validation-error";
import { pool } from "../../db/index.ts";
import { uploadDataUrl } from "../supabase.ts";
import { requireRole } from "../authMiddleware.ts";
import {
  isImageBlock,
  parseContentBlocks,
  stringifyContentBlocks,
} from "../../client/src/shared/content-blocks.ts";
import {
  getCategories,
  getCategoryById,
  createCategory,
  updateCategory,
  getTags,
  getTagById,
  createTag,
  updateTag,
  getPages,
  getPageById,
  createPage,
  updatePage,
  deletePage,
} from "../storage/cms.ts";
import * as cache from "../lib/cache.ts";

const router = Router();

// Prevent caching on admin endpoints - admin data must always be fresh
router.use((req: Request, res: Response, next) => {
  res.set("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
  res.set("Pragma", "no-cache");
  res.set("Expires", "0");
  next();
});

// Helper functions
async function getCategoryBySlug(slug: string) {
  const res = await pool.query("SELECT * FROM categories WHERE slug = $1", [slug]);
  return res.rows[0];
}

async function getTagBySlug(slug: string) {
  const res = await pool.query("SELECT * FROM tags WHERE slug = $1", [slug]);
  return res.rows[0];
}

async function uploadContentImages(content?: string) {
  if (!content) return content;
  const blocks = parseContentBlocks(content);
  if (blocks.length === 0) return content;

  let changed = false;
  for (const block of blocks) {
    if (isImageBlock(block) && block.url && block.url.startsWith("data:")) {
      try {
        const uploaded = await uploadDataUrl(
          "page-assets",
          `content-images/${Date.now()}-${Math.random()}.png`,
          block.url
        );
        block.url = uploaded;
        changed = true;
      } catch (error) {
        console.warn("[cms] Content image upload failed, using data URL", {
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }
  }

  return changed ? stringifyContentBlocks(blocks) : content;
}

// ============== CATEGORIES ==============

// GET /api/admin/categories
router.get("/categories", requireRole("admin", "employee"), async (req: Request, res: Response) => {
  try {
    const status = req.query.status as string | undefined;
    const categories = await getCategories(status);
    res.json({ categories });
  } catch (error) {
    console.error("[cms] Get categories error:", error);
    res.status(500).json({ error: "Failed to fetch categories" });
  }
});

// POST /api/admin/categories
router.post("/categories", requireRole("admin", "employee"), async (req: Request, res: Response) => {
  try {
    const { name, slug, status, parentId } = z
      .object({
        name: z.string().min(1),
        slug: z.string().min(1),
        status: z.enum(["published", "draft", "archived"]).optional(),
        parentId: z.string().uuid().nullable().optional(),
      })
      .parse(req.body);

    // Check slug uniqueness
    const existing = await getCategoryBySlug(slug);
    if (existing) {
      return res.status(409).json({ error: "Slug already exists" });
    }

    const category = await createCategory(name, slug, status, parentId);
    if (!category) {
      console.error("[cms] Create category error - null result after INSERT", { name, slug, status, parentId });
      return res.status(500).json({ error: "Failed to create category" });
    }
    res.json({ category });
  } catch (error) {
    if (error instanceof z.ZodError) {
      console.warn("[cms] Validation error creating category:", fromZodError(error).message);
      return res.status(400).json({ error: fromZodError(error).message });
    }
    console.error("[cms] Create category error - system error:", {
      name: req.body.name,
      slug: req.body.slug,
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined
    });
    res.status(500).json({ error: "Failed to create category" });
  }
});

// PATCH /api/admin/categories/:id
router.patch("/categories/:id", requireRole("admin", "employee"), async (req: Request, res: Response) => {
  try {
    const { name, slug, status, parentId } = z
      .object({
        name: z.string().optional(),
        slug: z.string().optional(),
        status: z.enum(["published", "draft", "archived"]).optional(),
        parentId: z.string().uuid().nullable().optional(),
      })
      .parse(req.body);

    const category = await updateCategory(req.params.id, name, slug, status, parentId);
    if (!category) {
      return res.status(404).json({ error: "Category not found" });
    }

    res.json({ category });
  } catch (error) {
    if (error instanceof z.ZodError) {
      console.warn("[cms] Validation error updating category:", fromZodError(error).message);
      return res.status(400).json({ error: fromZodError(error).message });
    }
    console.error("[cms] Update category error - system error:", error instanceof Error ? error.message : String(error));
    res.status(500).json({ error: "Failed to update category" });
  }
});

// DELETE /api/admin/categories/:id
router.delete("/categories/:id", requireRole("admin", "employee"), async (req: Request, res: Response) => {
  try {
    const categoryId = req.params.id;

    // Check if category has any associated pages
    const pagesResult = await pool.query(
      "SELECT COUNT(*) as count FROM pages WHERE category_id = $1",
      [categoryId]
    );

    const pageCount = parseInt(pagesResult.rows[0].count, 10);
    if (pageCount > 0) {
      return res.status(409).json({
        error: `Cannot delete category: ${pageCount} page(s) still associated with it. Please delete or move the pages first.`,
      });
    }

    // First, remove parent relationship from any child categories to avoid FK constraint issues
    // This is necessary because ON DELETE SET NULL can trigger unique constraint violations
    // if there are duplicate slugs in the database
    await pool.query(
      "UPDATE categories SET parent_id = NULL WHERE parent_id = $1",
      [categoryId]
    );

    // Hard delete from database
    const deleteResult = await pool.query(
      "DELETE FROM categories WHERE id = $1 RETURNING id",
      [categoryId]
    );

    if (deleteResult.rows.length === 0) {
      return res.status(404).json({ error: "Category not found" });
    }

    // Invalidate admin cache
    try {
      cache.del("cms:admin:categories");
      cache.del("cms:admin:tags");
      cache.del("cms:admin:pages");
    } catch (_) {
      // Cache invalidation failure should not break the response
    }

    res.json({ message: "Category deleted successfully" });
  } catch (error) {
    console.error("[cms] Delete category error - system error:", error instanceof Error ? error.message : String(error));
    res.status(500).json({ error: "Failed to delete category" });
  }
});

// ============== TAGS ==============

// GET /api/admin/tags
router.get("/tags", requireRole("admin", "employee"), async (req: Request, res: Response) => {
  try {
    const status = req.query.status as string | undefined;
    const tags = await getTags(status);
    res.json({ tags });
  } catch (error) {
    console.error("[cms] Get tags error:", error);
    res.status(500).json({ error: "Failed to fetch tags" });
  }
});

// DEBUG: GET /api/admin/tags/debug/all - Show all tags including duplicates
router.get("/tags/debug/all", requireRole("admin", "employee"), async (req: Request, res: Response) => {
  // DEBUG endpoint disabled in production
  if (process.env.NODE_ENV === "production") {
    return res.status(403).json({ error: "Debug endpoint not available in production" });
  }

  try {
    const result = await pool.query(`
      SELECT id, name, slug, parent_id, status, created_at
      FROM tags
      ORDER BY slug, created_at;
    `);
    
    const duplicatesResult = await pool.query(`
      SELECT slug, COUNT(*) as count, array_agg(id) as ids
      FROM tags
      GROUP BY slug
      HAVING COUNT(*) > 1;
    `);
    
    res.json({ 
      tags: result.rows,
      duplicates: duplicatesResult.rows
    });
  } catch (error) {
    console.error("[cms] Debug tags error:", error);
    res.status(500).json({ error: "Failed to fetch debug tags" });
  }
});

// POST /api/admin/tags
router.post("/tags", requireRole("admin", "employee"), async (req: Request, res: Response) => {
  try {
    const { name, slug, status, parentId } = z
      .object({
        name: z.string().min(1),
        slug: z.string().min(1),
        status: z.enum(["published", "draft", "archived"]).optional(),
        parentId: z.string().uuid().nullable().optional(),
      })
      .parse(req.body);

    // Check slug uniqueness
    const existing = await getTagBySlug(slug);
    if (existing) {
      return res.status(409).json({ error: "Slug already exists" });
    }

    const tag = await createTag(name, slug, status, parentId);
    if (!tag) {
      console.error("[cms] Create tag error - null result after INSERT");
      return res.status(500).json({ error: "Failed to create tag" });
    }
    res.json({ tag });
  } catch (error) {
    if (error instanceof z.ZodError) {
      console.warn("[cms] Validation error creating tag:", fromZodError(error).message);
      return res.status(400).json({ error: fromZodError(error).message });
    }
    console.error("[cms] Create tag error - system error:", error instanceof Error ? error.message : String(error));
    res.status(500).json({ error: "Failed to create tag" });
  }
});

// PATCH /api/admin/tags/:id
router.patch("/tags/:id", requireRole("admin", "employee"), async (req: Request, res: Response) => {
  try {
    const { name, slug, status, parentId } = z
      .object({
        name: z.string().optional(),
        slug: z.string().optional(),
        status: z.enum(["published", "draft", "archived"]).optional(),
        parentId: z.string().uuid().nullable().optional(),
      })
      .parse(req.body);

    const tag = await updateTag(req.params.id, name, slug, status, parentId);
    if (!tag) {
      return res.status(404).json({ error: "Tag not found" });
    }

    res.json({ tag });
  } catch (error) {
    if (error instanceof z.ZodError) {
      console.warn("[cms] Validation error updating tag:", fromZodError(error).message);
      return res.status(400).json({ error: fromZodError(error).message });
    }
    console.error("[cms] Update tag error - system error:", {
      tagId: req.params.id,
      name: req.body.name,
      status: req.body.status,
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined
    });
    res.status(500).json({ error: "Failed to update tag" });
  }
});

// DELETE /api/admin/tags/:id
router.delete("/tags/:id", requireRole("admin", "employee"), async (req: Request, res: Response) => {
  try {
    const tagId = req.params.id;

    // Check if tag has any associated pages via page_tags junction table
    const pagesResult = await pool.query(
      "SELECT COUNT(*) as count FROM page_tags WHERE tag_id = $1",
      [tagId]
    );

    const pageCount = parseInt(pagesResult.rows[0].count, 10);
    if (pageCount > 0) {
      return res.status(409).json({
        error: `Cannot delete tag: ${pageCount} page(s) still associated with it. Please remove the tag from those pages first.`,
      });
    }

    // First, remove parent relationship from any child tags to avoid FK constraint issues
    // This is necessary because ON DELETE SET NULL can trigger unique constraint violations
    // if there are duplicate slugs in the database
    await pool.query(
      "UPDATE tags SET parent_id = NULL WHERE parent_id = $1",
      [tagId]
    );

    // Hard delete from database
    const deleteResult = await pool.query(
      "DELETE FROM tags WHERE id = $1 RETURNING id",
      [tagId]
    );

    if (deleteResult.rows.length === 0) {
      return res.status(404).json({ error: "Tag not found" });
    }

    // Invalidate admin cache
    try {
      cache.del("cms:admin:categories");
      cache.del("cms:admin:tags");
      cache.del("cms:admin:pages");
    } catch (_) {
      // Cache invalidation failure should not break the response
    }

    res.json({ message: "Tag deleted successfully" });
  } catch (error) {
    console.error("[cms] Delete tag error - system error:", error instanceof Error ? error.message : String(error));
    res.status(500).json({ error: "Failed to delete tag" });
  }
});

// ============== PAGES ==============

// GET /api/admin/pages
router.get("/pages", requireRole("admin", "employee"), async (req: Request, res: Response) => {
  try {
    const status = req.query.status as string | undefined;
    // By default, exclude archived items. Only show archived if explicitly requested.
    const pages = await getPages(status === "archived" ? "archived" : undefined);
    const filtered = status === "archived" 
      ? pages.filter(p => p.status === "archived")
      : pages.filter(p => p.status !== "archived");
    res.json({ pages: filtered });
  } catch (error) {
    console.error("[cms] Get pages error:", error);
    res.status(500).json({ error: "Failed to fetch pages" });
  }
});

// POST /api/admin/pages
router.post("/pages", requireRole("admin", "employee"), async (req: Request, res: Response) => {
  try {
    const { title, slug, categoryId, content, bannerImage, tagIds, status } = z
      .object({
        title: z.string().min(1),
        slug: z.string().min(1),
        categoryId: z.string().uuid(),
        content: z.string().default(""),
        bannerImage: z.string().optional(),
        tagIds: z.array(z.string().uuid()).min(1, "At least one tag required"),
        status: z.enum(["published", "draft", "archived"]).optional(),
      })
      .parse(req.body);

    // Check slug uniqueness
    const existingPage = await pool.query("SELECT id FROM pages WHERE slug = $1", [slug]);
    if (existingPage.rows.length > 0) {
      return res.status(409).json({ error: "Slug already exists" });
    }

    // Verify category exists
    const category = await getCategoryById(categoryId);
    if (!category) {
      return res.status(400).json({ error: "Category not found" });
    }

    // Verify all tags exist
    for (const tagId of tagIds) {
      const tag = await getTagById(tagId);
      if (!tag) {
        return res.status(400).json({ error: `Tag ${tagId} not found` });
      }
    }

    let bannerImageUrl = bannerImage;
    if (bannerImage && bannerImage.startsWith("data:")) {
      try {
        bannerImageUrl = await uploadDataUrl(
          "page-assets",
          `banners/${Date.now()}-${Math.random()}.png`,
          bannerImage
        );
      } catch (error) {
        console.warn("[cms] Banner upload failed, using data URL", {
          error: error instanceof Error ? error.message : String(error),
        });
        bannerImageUrl = bannerImage;
      }
    }

    const uploadedContent = await uploadContentImages(content);

    const page = await createPage(title, slug, categoryId, uploadedContent || content, bannerImageUrl, tagIds, status);
    if (!page) {
      console.error("[cms] Create page: returned null page");
      return res.status(500).json({ error: "Failed to create page" });
    }
    try {
      cache.del(`cms:page:${page.slug}`);
      if (category?.slug) cache.del(`cms:page:${category.slug}:${page.slug}`);
      console.debug("[cache INVALIDATE]", `cms:page:${page.slug}`);
    } catch (_) {
      // Cache invalidation must not fail the request
    }
    res.json({ page });
  } catch (error) {
    if (error instanceof z.ZodError) {
      console.warn("[cms] Create page validation error:", fromZodError(error).message);
      return res.status(400).json({ error: fromZodError(error).message });
    }
    console.error("[cms] Create page error:", error instanceof Error ? error.message : error);
    res.status(500).json({ error: "Failed to create page" });
  }
});

// GET /api/admin/pages/:id
router.get("/pages/:id", requireRole("admin", "employee"), async (req: Request, res: Response) => {
  try {
    const page = await getPageById(req.params.id);
    if (!page) {
      return res.status(404).json({ error: "Page not found" });
    }
    res.json({ page });
  } catch (error) {
    console.error("[cms] Get page by ID error:", error);
    res.status(500).json({ error: "Failed to fetch page" });
  }
});

// PATCH /api/admin/pages/:id
router.patch("/pages/:id", requireRole("admin", "employee"), async (req: Request, res: Response) => {
  try {
    const { title, slug, categoryId, status, content, bannerImage, tagIds, metaTitle, metaDescription } = z
      .object({
        title: z.string().optional(),
        slug: z.string().optional(),
        categoryId: z.string().uuid().optional(),
        status: z.enum(["published", "draft", "archived"]).optional(),
        content: z.string().optional(),
        bannerImage: z.string().optional(),
        tagIds: z.array(z.string().uuid()).optional(),
        metaTitle: z.string().optional(),
        metaDescription: z.string().optional(),
      })
      .parse(req.body);

    // Check slug uniqueness if changing slug
    if (slug) {
      const existingPage = await pool.query("SELECT id FROM pages WHERE slug = $1 AND id != $2", [slug, req.params.id]);
      if (existingPage.rows.length > 0) {
        return res.status(409).json({ error: "Slug already exists" });
      }
    }

    // Verify category exists if changing
    if (categoryId) {
      const category = await getCategoryById(categoryId);
      if (!category) {
        return res.status(400).json({ error: "Category not found" });
      }
    }

    // Verify all tags exist
    if (tagIds) {
      for (const tagId of tagIds) {
        const tag = await getTagById(tagId);
        if (!tag) {
          return res.status(400).json({ error: `Tag ${tagId} not found` });
        }
      }
    }

    let bannerImageUrl = bannerImage;
    if (bannerImage && bannerImage.startsWith("data:")) {
      try {
        bannerImageUrl = await uploadDataUrl(
          "page-assets",
          `banners/${Date.now()}-${Math.random()}.png`,
          bannerImage
        );
      } catch (error) {
        console.warn("[cms] Banner upload failed, using data URL", {
          error: error instanceof Error ? error.message : String(error),
        });
        bannerImageUrl = bannerImage;
      }
    }

    const uploadedContent = await uploadContentImages(content);

    const page = await updatePage(
      req.params.id,
      title,
      slug,
      categoryId,
      status,
      uploadedContent ?? content,
      bannerImageUrl,
      tagIds,
      metaTitle,
      metaDescription
    );
    if (!page) {
      return res.status(404).json({ error: "Page not found" });
    }

    res.json({ page });
  } catch (error) {
    if (error instanceof z.ZodError) {
      console.warn("[cms] Validation error updating page:", fromZodError(error).message);
      return res.status(400).json({ error: fromZodError(error).message });
    }
    console.error("[cms] Update page error - system error:", error instanceof Error ? error.message : String(error));
    res.status(500).json({ error: "Failed to update page" });
  }
});

// DELETE /api/admin/pages/:id
router.delete("/pages/:id", requireRole("admin", "employee"), async (req: Request, res: Response) => {
  try {
    const pageBeforeDelete = await getPageById(req.params.id);
    const success = await deletePage(req.params.id);
    if (!success) {
      return res.status(404).json({ error: "Page not found" });
    }
    if (pageBeforeDelete) {
      try {
        cache.del(`cms:page:${pageBeforeDelete.slug}`);
        if (pageBeforeDelete.category?.slug) cache.del(`cms:page:${pageBeforeDelete.category.slug}:${pageBeforeDelete.slug}`);
        console.debug("[cache INVALIDATE]", `cms:page:${pageBeforeDelete.slug}`);
      } catch (_) {
        // Cache invalidation must not fail the request
      }
    }
    res.json({ message: "Page deleted" });
  } catch (error) {
    console.error("[cms] Delete page error - system error:", error instanceof Error ? error.message : String(error));
    res.status(500).json({ error: "Failed to delete page" });
  }
});

export default router;

