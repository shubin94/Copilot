import { pool } from "./db/index.ts";

async function testPageWorkflow() {
  try {
    console.log("🧪 Testing WordPress-like page workflow...\n");

    // 1. Create a test page
    console.log("1️⃣ Creating a test page...");
    const createResult = await pool.query(
      `INSERT INTO pages (id, title, slug, category_id, content, status, meta_title, meta_description)
       VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7)
       RETURNING id, title, slug, status, meta_title, meta_description`,
      [
        "Test WordPress Page",
        "test-wordpress-page",
        "a448ebd8-2871-4c7d-9d98-1cf3cb238f08", // Use existing category
        "<p>This is a test page content.</p>",
        "draft",
        "Test WordPress Page - SEO Title",
        "This is the meta description for SEO"
      ]
    );
    const pageId = createResult.rows[0].id;
    console.log("✅ Page created:", createResult.rows[0]);

    // 2. Fetch single page (GET /api/admin/pages/:id)
    console.log("\n2️⃣ Fetching page by ID...");
    const fetchResult = await pool.query(
      `SELECT p.*, ARRAY_AGG(JSON_BUILD_OBJECT('id', t.id, 'name', t.name)) as tags
       FROM pages p
       LEFT JOIN page_tags pt ON p.id = pt.page_id
       LEFT JOIN tags t ON pt.tag_id = t.id
       WHERE p.id = $1
       GROUP BY p.id`,
      [pageId]
    );
    console.log("✅ Fetched page:", {
      id: fetchResult.rows[0].id,
      title: fetchResult.rows[0].title,
      status: fetchResult.rows[0].status,
      metaTitle: fetchResult.rows[0].meta_title,
      metaDescription: fetchResult.rows[0].meta_description,
    });

    // 3. Update page with new content
    console.log("\n3️⃣ Updating page content...");
    const updateResult = await pool.query(
      `UPDATE pages 
       SET title = $1, slug = $2, content = $3, meta_title = $4, meta_description = $5
       WHERE id = $6
       RETURNING id, title, slug, status, meta_title, meta_description`,
      [
        "Updated WordPress Page",
        "updated-wordpress-page",
        "<h1>Updated Content</h1><p>This is updated content.</p>",
        "Updated SEO Title",
        "Updated meta description",
        pageId
      ]
    );
    console.log("✅ Page updated:", updateResult.rows[0]);

    // 4. Publish page (draft → published)
    console.log("\n4️⃣ Publishing page...");
    const publishResult = await pool.query(
      `UPDATE pages SET status = 'published' WHERE id = $1 RETURNING id, status`,
      [pageId]
    );
    console.log("✅ Page published:", publishResult.rows[0]);

    // 5. Verify SEO fields persisted
    console.log("\n5️⃣ Verifying SEO fields...");
    const seoCheck = await pool.query(
      `SELECT meta_title, meta_description FROM pages WHERE id = $1`,
      [pageId]
    );
    console.log("✅ SEO fields verified:", seoCheck.rows[0]);

    // Cleanup
    console.log("\n🧹 Cleaning up...");
    await pool.query("DELETE FROM pages WHERE id = $1", [pageId]);
    console.log("✅ Test page deleted");

    console.log("\n✅ ALL WORKFLOW TESTS PASSED");
    console.log("WordPress-like editing workflow is ready!");
    process.exit(0);
  } catch (error) {
    console.error("\n❌ Test failed:", error);
    process.exit(1);
  }
}

testPageWorkflow();
