import { Router, Request, Response } from "express";
import { z } from "zod";
import { fromZodError } from "zod-validation-error";
import { pool } from "../../db/index.js";
import { uploadDataUrl } from "../supabase.js";
import { requireRole } from "../authMiddleware.js";
import {
  isImageBlock,
  parseContentBlocks,
  stringifyContentBlocks,
} from "../../shared/content-blocks.js";
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
} from "../storage/cms.js";
import * as cache from "../lib/cache.js";

const router = Router();

// Prevent caching on admin endpoints - admin data must always be fresh
router.use((_req: Request, res: Response, next) => {
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

    // Invalidate caches when category is updated
    try {
      cache.del("cms:admin:categories");
      cache.del("cms:admin:tags");
      cache.del("cms:admin:pages");
      // Clear service caches since services reference categories
      cache.keys().filter(k => k.startsWith("services:")).forEach(k => cache.del(k));
      // Clear detective profile caches since they contain service data with categories
      cache.keys().filter(k => k.startsWith("detective:public:")).forEach(k => cache.del(k));
      console.debug("[cache INVALIDATE] Category updated - cleared CMS and service caches");
    } catch (cacheError) {
      console.warn("[cache] Error invalidating caches:", cacheError instanceof Error ? cacheError.message : String(cacheError));
      // Don't fail the response if cache invalidation fails
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
router.get("/tags/debug/all", requireRole("admin", "employee"), async (_req: Request, res: Response) => {
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
    const statusParam = req.query.status as string | undefined;
    const allowedStatuses = new Set(["published", "draft", "archived"]);
    const status = allowedStatuses.has(statusParam || "") ? statusParam as "published" | "draft" | "archived" : "published";

    const pages = await getPages(status);
    const filtered = pages.filter((p) => p.status === status);
    res.json({ pages: filtered });
  } catch (error) {
    console.error("[cms] Get pages error:", error);
    res.status(500).json({ error: "Failed to fetch pages" });
  }
});

// POST /api/admin/pages
router.post("/pages", requireRole("admin", "employee"), async (req: Request, res: Response) => {
  const { title, slug, categoryId } = req.body;

  try {
    const parsed = z
      .object({
        title: z.string().min(1),
        slug: z.string().min(1),
        categoryId: z.string().uuid(),
        content: z.string().default(""),
        bannerImage: z.string().optional(),
        tagIds: z.array(z.string().uuid()).min(1, "At least one tag required"),
        status: z.enum(["published", "draft", "archived"]).optional(),
        authorBio: z.string().optional(),
        authorSocial: z.array(z.object({ platform: z.string(), url: z.string() })).optional(),
      })
      .parse(req.body);

    const {
      title: validatedTitle,
      slug: validatedSlug,
      categoryId: validatedCategoryId,
      content,
      bannerImage,
      tagIds,
      status,
      authorBio,
      authorSocial,
    } = parsed;

    // Check slug uniqueness
    const existingPage = await pool.query("SELECT id FROM pages WHERE slug = $1", [validatedSlug]);
    if (existingPage.rows.length > 0) {
      return res.status(409).json({ error: "Slug already exists" });
    }

    // Verify category exists
    const category = await getCategoryById(validatedCategoryId);
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

    // Get author info from session - with safe fallbacks
    const authorName = req.session?.userName || req.session?.userEmail?.split("@")[0] || "Admin";
    const authorEmail = req.session?.userEmail || "";
    
    // Build author meta with bio and social profiles
    const authorMeta = (authorName && authorName !== "Admin") || authorEmail 
      ? { 
          name: authorName, 
          email: authorEmail,
          bio: authorBio || undefined,
          socialProfiles: (authorSocial && authorSocial.length > 0) ? authorSocial : undefined
        }
      : undefined;

    // Default to 'published' if no status provided
    const pageStatus = status || 'published';

    const page = await createPage(validatedTitle, validatedSlug, validatedCategoryId, uploadedContent || content, bannerImageUrl, tagIds, pageStatus, authorMeta);
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
    console.error("[cms] Create page error:", {
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      title,
      slug,
      categoryId
    });
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
    res.json({
      page: {
        ...page,
        title_tag: page.metaTitle ?? null,
        meta_description: page.metaDescription ?? null,
        h1: page.h1 ?? null,
      },
    });
  } catch (error) {
    console.error("[cms] Get page by ID error:", error);
    res.status(500).json({ error: "Failed to fetch page" });
  }
});

// PATCH /api/admin/pages/:id
router.patch("/pages/:id", requireRole("admin", "employee"), async (req: Request, res: Response) => {
  try {
    const {
      title,
      slug,
      categoryId,
      status,
      content,
      bannerImage,
      tagIds,
      metaTitle,
      metaDescription,
      title_tag,
      meta_description,
      h1,
    } = z
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
        title_tag: z.string().optional(),
        meta_description: z.string().optional(),
        h1: z.string().optional(),
      })
      .parse(req.body);

    const resolvedMetaTitle = title_tag !== undefined ? title_tag : metaTitle;
    const resolvedMetaDescription = meta_description !== undefined ? meta_description : metaDescription;

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
      resolvedMetaTitle,
      resolvedMetaDescription,
      h1
    );
    if (!page) {
      return res.status(404).json({ error: "Page not found" });
    }

    res.json({
      page: {
        ...page,
        title_tag: page.metaTitle ?? null,
        meta_description: page.metaDescription ?? null,
        h1: page.h1 ?? null,
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      const errorMsg = (error as any).message || "Validation failed";
      console.warn("[cms] Validation error updating page:", errorMsg);
      return res.status(400).json({ error: errorMsg });
    }
    console.error("[cms] Update page error - system error:", error instanceof Error ? error.message : String(error));
    res.status(500).json({ error: "Failed to update page" });
  }
});

// PUT /api/admin/pages/:id
// Admin-only SEO editor endpoint for title tag, meta description, and H1
router.put("/pages/:id", requireRole("admin"), async (req: Request, res: Response) => {
  try {
    const payload = z.object({
      title_tag: z.string().nullable().optional(),
      meta_description: z.string().nullable().optional(),
      h1: z.string().nullable().optional(),
    }).refine(
      (value) => value.title_tag !== undefined || value.meta_description !== undefined || value.h1 !== undefined,
      { message: "At least one SEO field is required" }
    ).parse(req.body);

    const page = await updatePage(
      req.params.id,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      payload.title_tag,
      payload.meta_description,
      payload.h1
    );

    if (!page) {
      return res.status(404).json({ error: "Page not found" });
    }

    try {
      cache.del(`cms:page:${page.slug}`);
      if (page.category?.slug) {
        cache.del(`cms:page:${page.category.slug}:${page.slug}`);
      }
    } catch (_) {
      // Cache invalidation failure should not break SEO updates
    }

    res.json({
      page: {
        ...page,
        title_tag: page.metaTitle ?? null,
        meta_description: page.metaDescription ?? null,
        h1: page.h1 ?? null,
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: fromZodError(error).message });
    }

    console.error("[cms] SEO PUT update error:", error instanceof Error ? error.message : String(error));
    res.status(500).json({ error: "Failed to update page SEO" });
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

// Static site pages that always appear in the admin pages list
// defaultTitle/Description/H1 = what the page currently shows when no DB override exists
const STATIC_PAGES = [
  {
    slug: "/", name: "Homepage",
    defaultTitle: "Find Detectives - Hire Top Private Investigators | AskDetectives",
    defaultDescription: "The world's first dedicated detective service platform. A single place to discover, compare, and hire professional detectives across verified categories.",
    defaultH1: "Find the Perfect Private Detectives Near You - AskDetectives",
  },
  {
    slug: "about", name: "About",
    defaultTitle: "About AskDetectives",
    defaultDescription: "Learn more about AskDetectives, the dedicated platform for discovering and connecting with professional private investigators.",
    defaultH1: "About AskDetectives",
  },
  {
    slug: "contact", name: "Contact",
    defaultTitle: "Contact Us",
    defaultDescription: "Get in touch with the Ask Detectives team.",
    defaultH1: "Contact Us",
  },
  {
    slug: "terms", name: "Terms & Conditions",
    defaultTitle: "Terms and Conditions",
    defaultDescription: "AskDetectives is a directory platform only. Review our terms of service covering platform use, user responsibilities, disclaimer of liability, and how detective listings work.",
    defaultH1: "Terms and Conditions",
  },
  {
    slug: "privacy", name: "Privacy Policy",
    defaultTitle: "Privacy Policy",
    defaultDescription: "AskDetectives collects minimal data and does not store personal conversations, case details, or payment information. Read our full privacy policy to understand how your data is protected.",
    defaultH1: "Privacy Policy",
  },
  {
    slug: "packages", name: "Pricing & Packages",
    defaultTitle: "Pricing & Packages",
    defaultDescription: "Compare AskDetectives subscription plans for private investigators. Choose a plan to list your services, get verified, and connect with clients worldwide.",
    defaultH1: "Simple, Transparent Pricing",
  },
  {
    slug: "categories", name: "Browse Categories",
    defaultTitle: "Browse Categories",
    defaultDescription: "Browse all private investigation service categories on AskDetectives — including background checks, surveillance, matrimonial investigations, cyber investigations, and more.",
    defaultH1: "Browse Categories",
  },
  {
    slug: "blog", name: "Blog",
    defaultTitle: "Blog | AskDetectives",
    defaultDescription: "Latest news, tips, and insights from the world of private investigation.",
    defaultH1: "Blog",
  },
  {
    slug: "support", name: "Support",
    defaultTitle: "Support Center & FAQ | AskDetectives",
    defaultDescription: "Find answers to common questions about hiring a detective, privacy policies, and verification processes at AskDetectives.",
    defaultH1: "Help Center",
  },
];

// GET /api/admin/static-pages
// Returns SEO data for all static pages (from DB if saved, otherwise empty)
router.get("/static-pages", requireRole("admin", "employee"), async (_req: Request, res: Response) => {
  try {
    const slugs = STATIC_PAGES.map((p) => p.slug);
    const result = await pool.query(
      `SELECT slug, meta_title, meta_description, h1 FROM pages WHERE slug = ANY($1::text[])`,
      [slugs]
    );
    const dbBySlug: Record<string, { metaTitle: string | null; metaDescription: string | null; h1: string | null }> = {};
    for (const row of result.rows) {
      dbBySlug[row.slug] = {
        metaTitle: row.meta_title ?? null,
        metaDescription: row.meta_description ?? null,
        h1: row.h1 ?? null,
      };
    }
    const pages = STATIC_PAGES.map((p) => {
      const db = dbBySlug[p.slug];
      return {
        slug: p.slug,
        name: p.name,
        url: p.slug === "/" ? "/" : `/${p.slug}`,
        metaTitle: db?.metaTitle ?? p.defaultTitle,
        metaDescription: db?.metaDescription ?? p.defaultDescription,
        h1: db?.h1 ?? p.defaultH1,
        isCustom: !!db,  // true = saved in DB, false = showing component default
      };
    });
    res.json({ pages });
  } catch (error) {
    console.error("[cms] static-pages GET error:", error instanceof Error ? error.message : String(error));
    res.status(500).json({ error: "Failed to load static pages" });
  }
});

// POST /api/admin/static-pages/seo
// Upserts SEO (title, description, h1) for a static page — slug comes in body to avoid URL encoding issues with "/"
router.post("/static-pages/seo", requireRole("admin"), async (req: Request, res: Response) => {
  try {
    const payload = z.object({
      slug: z.string(),
      title_tag: z.string().nullable().optional(),
      meta_description: z.string().nullable().optional(),
      h1: z.string().nullable().optional(),
    }).parse(req.body);

    const slug = payload.slug;
    const validSlugs = STATIC_PAGES.map((p) => p.slug);
    if (!validSlugs.includes(slug)) {
      return res.status(400).json({ error: "Invalid static page slug" });
    }

    const staticPage = STATIC_PAGES.find((p) => p.slug === slug)!;

    // Rows are pre-seeded via SQL — just UPDATE the existing row
    const result = await pool.query(
      `UPDATE pages SET
         meta_title = $1,
         meta_description = $2,
         h1 = $3,
         updated_at = NOW()
       WHERE slug = $4`,
      [payload.title_tag ?? null, payload.meta_description ?? null, payload.h1 ?? null, slug]
    );

    // If row doesn't exist yet, insert it with the static-pages category
    if (result.rowCount === 0) {
      await pool.query(
        `INSERT INTO pages (id, title, slug, category_id, content, status, meta_title, meta_description, h1, created_at, updated_at)
         SELECT gen_random_uuid(), $1, $2, c.id, '', 'published', $3, $4, $5, NOW(), NOW()
         FROM categories c WHERE c.slug = 'static-pages' LIMIT 1`,
        [staticPage.name, slug, payload.title_tag ?? null, payload.meta_description ?? null, payload.h1 ?? null]
      );
    }

    // Invalidate cache
    try {
      cache.del(`cms:page:${slug}`);
    } catch (_) {}

    res.json({
      slug,
      metaTitle: payload.title_tag ?? null,
      metaDescription: payload.meta_description ?? null,
      h1: payload.h1 ?? null,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: fromZodError(error).message });
    }
    console.error("[cms] static-pages PUT error:", error instanceof Error ? error.message : String(error));
    res.status(500).json({ error: "Failed to update static page SEO" });
  }
});

export default router;

