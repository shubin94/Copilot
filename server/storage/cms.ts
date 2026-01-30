import { pool } from "../../db/index.ts";
import { v4 as uuidv4 } from "uuid";
import { ContentBlock, parseContentBlocks } from "../../client/src/shared/content-blocks.ts";

// ============== CATEGORIES ==============

export interface Category {
  id: string;
  name: string;
  slug: string;
  status: "published" | "draft" | "archived";
  createdAt: string;
  updatedAt: string;
}

export async function getCategories(status?: string): Promise<Category[]> {
  let query = "SELECT * FROM categories";
  const params: any[] = [];

  if (status) {
    query += " WHERE status = $1";
    params.push(status);
  }

  query += " ORDER BY created_at DESC";

  const result = await pool.query(query, params);
  return result.rows.map((row) => ({
    id: row.id,
    name: row.name,
    slug: row.slug,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }));
}

export async function getCategoryById(id: string): Promise<Category | null> {
  const result = await pool.query("SELECT * FROM categories WHERE id = $1", [id]);
  if (result.rows.length === 0) return null;

  const row = result.rows[0];
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function getCategoryBySlug(slug: string): Promise<Category | null> {
  const result = await pool.query("SELECT * FROM categories WHERE slug = $1", [slug]);
  if (result.rows.length === 0) return null;

  const row = result.rows[0];
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function createCategory(name: string, slug: string, status?: string): Promise<Category> {
  const id = uuidv4();
  let query = "INSERT INTO categories (id, name, slug";
  const params: any[] = [id, name, slug];

  if (status) {
    query += ", status";
    params.push(status);
  }

  query += ") VALUES ($1, $2, $3";
  if (status) {
    query += ", $4";
  }
  query += ") RETURNING *";

  const result = await pool.query(query, params);
  const row = result.rows[0];
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function updateCategory(id: string, name?: string, status?: string): Promise<Category | null> {
  const updates: string[] = [];
  const params: any[] = [];
  let paramIndex = 1;

  if (name !== undefined) {
    updates.push(`name = $${paramIndex++}`);
    params.push(name);
  }
  if (status !== undefined) {
    updates.push(`status = $${paramIndex++}`);
    params.push(status);
  }

  if (updates.length === 0) return getCategoryById(id);

  params.push(id);
  const query = `UPDATE categories SET ${updates.join(", ")} WHERE id = $${paramIndex} RETURNING *`;

  const result = await pool.query(query, params);
  if (result.rows.length === 0) return null;

  const row = result.rows[0];
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// ============== TAGS ==============

export interface Tag {
  id: string;
  name: string;
  slug: string;
  status: "published" | "draft" | "archived";
  createdAt: string;
  updatedAt: string;
}

export async function getTags(status?: string): Promise<Tag[]> {
  let query = "SELECT * FROM tags";
  const params: any[] = [];

  if (status) {
    query += " WHERE status = $1";
    params.push(status);
  }

  query += " ORDER BY created_at DESC";

  const result = await pool.query(query, params);
  return result.rows.map((row) => ({
    id: row.id,
    name: row.name,
    slug: row.slug,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }));
}

export async function getTagById(id: string): Promise<Tag | null> {
  const result = await pool.query("SELECT * FROM tags WHERE id = $1", [id]);
  if (result.rows.length === 0) return null;

  const row = result.rows[0];
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function createTag(name: string, slug: string, status?: string): Promise<Tag> {
  const id = uuidv4();
  let query = "INSERT INTO tags (id, name, slug";
  const params: any[] = [id, name, slug];

  if (status) {
    query += ", status";
    params.push(status);
  }

  query += ") VALUES ($1, $2, $3";
  if (status) {
    query += ", $4";
  }
  query += ") RETURNING *";

  const result = await pool.query(query, params);
  const row = result.rows[0];
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function updateTag(id: string, name?: string, status?: string): Promise<Tag | null> {
  const updates: string[] = [];
  const params: any[] = [];
  let paramIndex = 1;

  if (name !== undefined) {
    updates.push(`name = $${paramIndex++}`);
    params.push(name);
  }
  if (status !== undefined) {
    updates.push(`status = $${paramIndex++}`);
    params.push(status);
  }

  if (updates.length === 0) return getTagById(id);

  params.push(id);
  const query = `UPDATE tags SET ${updates.join(", ")} WHERE id = $${paramIndex} RETURNING *`;

  const result = await pool.query(query, params);
  if (result.rows.length === 0) return null;

  const row = result.rows[0];
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// ============== PAGES ==============

export interface Page {
  id: string;
  title: string;
  slug: string;
  categoryId: string;
  content: string; // JSON string OR plain text (backward compatible)
  blocks?: ContentBlock[]; // Parsed blocks (for convenience)
  bannerImage?: string;
  category?: {
    id: string;
    name: string;
    slug: string;
  } | null;
  status: "published" | "draft" | "archived";
  metaTitle?: string;
  metaDescription?: string;
  createdAt: string;
  updatedAt: string;
  tags?: Tag[];
}

export async function getPages(status?: string): Promise<Page[]> {
  let query = `
    SELECT p.*, ARRAY_AGG(JSON_BUILD_OBJECT('id', t.id, 'name', t.name, 'slug', t.slug, 'status', t.status)) as tags
    FROM pages p
    LEFT JOIN page_tags pt ON p.id = pt.page_id
    LEFT JOIN tags t ON pt.tag_id = t.id
  `;
  const params: any[] = [];

  if (status) {
    query += " WHERE p.status = $1";
    params.push(status);
  }

  query += " GROUP BY p.id ORDER BY p.created_at DESC";

  const result = await pool.query(query, params);
  return result.rows.map((row) => {
    const blocks = parseContentBlocks(row.content);
    return {
      id: row.id,
      title: row.title,
      slug: row.slug,
      categoryId: row.category_id,
      content: row.content,
      blocks: blocks.length > 0 ? blocks : undefined,
      bannerImage: row.banner_image,
      status: row.status,
      metaTitle: row.meta_title,
      metaDescription: row.meta_description,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      tags: row.tags?.filter((t: any) => t.id) || [],
    };
  });
}

export async function getPageById(id: string): Promise<Page | null> {
  const result = await pool.query(
    `
    SELECT 
      p.*, 
      c.name as category_name,
      c.slug as category_slug,
      ARRAY_AGG(JSON_BUILD_OBJECT('id', t.id, 'name', t.name, 'slug', t.slug, 'status', t.status)) as tags
    FROM pages p
    LEFT JOIN categories c ON p.category_id = c.id
    LEFT JOIN page_tags pt ON p.id = pt.page_id
    LEFT JOIN tags t ON pt.tag_id = t.id
    WHERE p.id = $1
    GROUP BY p.id, c.name, c.slug
    `,
    [id]
  );

  if (result.rows.length === 0) return null;

  const row = result.rows[0];
  const blocks = parseContentBlocks(row.content);
  return {
    id: row.id,
    title: row.title,
    slug: row.slug,
    categoryId: row.category_id,
    content: row.content,
    blocks: blocks.length > 0 ? blocks : undefined,
    bannerImage: row.banner_image,
    category: row.category_id
      ? { id: row.category_id, name: row.category_name, slug: row.category_slug }
      : null,
    status: row.status,
    metaTitle: row.meta_title,
    metaDescription: row.meta_description,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    tags: row.tags?.filter((t: any) => t.id) || [],
  };
}

export async function createPage(
  title: string,
  slug: string,
  categoryId: string,
  content: string,
  bannerImage: string | undefined,
  tagIds: string[],
  status?: string
): Promise<Page> {
  const pageId = uuidv4();

  // Start transaction
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // Create page
    let query = "INSERT INTO pages (id, title, slug, category_id, content, banner_image";
    const params: any[] = [pageId, title, slug, categoryId, content, bannerImage || null];

    if (status) {
      query += ", status";
      params.push(status);
    }

    query += ") VALUES ($1, $2, $3, $4, $5, $6";
    if (status) {
      query += ", $7";
    }
    query += ") RETURNING *";

    const result = await client.query(query, params);
    if (!result.rows[0]) {
      throw new Error("Failed to insert page");
    }
    const pageRow = result.rows[0];

    // Add tags
    for (const tagId of tagIds) {
      await client.query("INSERT INTO page_tags (page_id, tag_id) VALUES ($1, $2)", [pageId, tagId]);
    }

    await client.query("COMMIT");

    // Fetch with tags
    const tagsResult = await client.query(
      "SELECT t.* FROM tags t JOIN page_tags pt ON t.id = pt.tag_id WHERE pt.page_id = $1",
      [pageId]
    );

    return {
      id: pageRow.id,
      title: pageRow.title,
      slug: pageRow.slug,
      categoryId: pageRow.category_id,
      content: pageRow.content,
      bannerImage: pageRow.banner_image,
      status: pageRow.status,
      metaTitle: pageRow.meta_title,
      metaDescription: pageRow.meta_description,
      createdAt: pageRow.created_at,
      updatedAt: pageRow.updated_at,
      tags: tagsResult.rows.map((row) => ({
        id: row.id,
        name: row.name,
        slug: row.slug,
        status: row.status,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      })),
    };
  } catch (error) {
    try {
      await client.query("ROLLBACK");
    } catch (rollbackError) {
      console.error("[cms] Rollback error:", rollbackError);
    }
    throw error;
  } finally {
    client.release();
  }
}

export async function updatePage(
  id: string,
  title?: string,
  slug?: string,
  categoryId?: string,
  status?: string,
  content?: string,
  bannerImage?: string,
  tagIds?: string[],
  metaTitle?: string,
  metaDescription?: string
): Promise<Page | null> {
  const updates: string[] = [];
  const params: any[] = [];
  let paramIndex = 1;

  if (title !== undefined) {
    updates.push(`title = $${paramIndex++}`);
    params.push(title);
  }
  if (slug !== undefined) {
    updates.push(`slug = $${paramIndex++}`);
    params.push(slug);
  }
  if (categoryId !== undefined) {
    updates.push(`category_id = $${paramIndex++}`);
    params.push(categoryId);
  }
  if (status !== undefined) {
    updates.push(`status = $${paramIndex++}`);
    params.push(status);
  }
  if (content !== undefined) {
    updates.push(`content = $${paramIndex++}`);
    params.push(content);
  }
  if (bannerImage !== undefined) {
    updates.push(`banner_image = $${paramIndex++}`);
    params.push(bannerImage);
  }
  if (metaTitle !== undefined) {
    updates.push(`meta_title = $${paramIndex++}`);
    params.push(metaTitle);
  }
  if (metaDescription !== undefined) {
    updates.push(`meta_description = $${paramIndex++}`);
    params.push(metaDescription);
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // Update page
    if (updates.length > 0) {
      params.push(id);
      const query = `UPDATE pages SET ${updates.join(", ")} WHERE id = $${paramIndex} RETURNING *`;
      await client.query(query, params);
    }

    // Update tags
    if (tagIds !== undefined) {
      await client.query("DELETE FROM page_tags WHERE page_id = $1", [id]);
      for (const tagId of tagIds) {
        await client.query("INSERT INTO page_tags (page_id, tag_id) VALUES ($1, $2)", [id, tagId]);
      }
    }

    await client.query("COMMIT");

    return getPageById(id);
  } catch (error) {
    try {
      await client.query("ROLLBACK");
    } catch (rollbackError) {
      console.error("[cms] Rollback error in updatePage:", rollbackError);
    }
    throw error;
  } finally {
    client.release();
  }
}

export async function deletePage(id: string): Promise<boolean> {
  const result = await pool.query("DELETE FROM pages WHERE id = $1", [id]);
  return result.rowCount > 0;
}
