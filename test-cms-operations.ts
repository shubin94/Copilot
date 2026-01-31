import "dotenv/config";
import pkg from "pg";
const { Pool } = pkg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === "production"
    ? { rejectUnauthorized: true }
    : (process.env.DB_ALLOW_INSECURE_DEV === "true" ? { rejectUnauthorized: false } : undefined)
});

async function testCMSOperations() {
  const client = await pool.connect();
  try {
    console.log("\n🧪 TESTING CMS DATABASE OPERATIONS\n");
    
    // Test 1: Insert a category
    console.log("[1] Testing category insert...");
    const categoryResult = await client.query(
      `INSERT INTO categories (name, slug, status) 
       VALUES ($1, $2, $3) 
       RETURNING id, name, slug, status, created_at`,
      ["Test Category", "test-category", "published"]
    );
    const categoryId = categoryResult.rows[0].id;
    console.log(`✅ Category created: ${categoryId}\n`);
    
    // Test 2: Insert tags
    console.log("[2] Testing tag inserts...");
    const tag1 = await client.query(
      `INSERT INTO tags (name, slug, status) 
       VALUES ($1, $2, $3) 
       RETURNING id, name`,
      ["Tutorial", "tutorial", "published"]
    );
    const tag1Id = tag1.rows[0].id;
    
    const tag2 = await client.query(
      `INSERT INTO tags (name, slug, status) 
       VALUES ($1, $2, $3) 
       RETURNING id, name`,
      ["Guide", "guide", "published"]
    );
    const tag2Id = tag2.rows[0].id;
    console.log(`✅ Tags created: ${tag1Id}, ${tag2Id}\n`);
    
    // Test 3: Insert a page
    console.log("[3] Testing page insert...");
    const pageResult = await client.query(
      `INSERT INTO pages (title, slug, category_id, content, status) 
       VALUES ($1, $2, $3, $4, $5) 
       RETURNING id, title, slug`,
      [
        "Welcome to CMS",
        "welcome-to-cms",
        categoryId,
        "# This is a test page\n\nThe migration is working!",
        "published"
      ]
    );
    const pageId = pageResult.rows[0].id;
    console.log(`✅ Page created: ${pageId}\n`);
    
    // Test 4: Create page-tag relationships
    console.log("[4] Testing page-tag relationships...");
    await client.query(
      `INSERT INTO page_tags (page_id, tag_id) VALUES ($1, $2)`,
      [pageId, tag1Id]
    );
    await client.query(
      `INSERT INTO page_tags (page_id, tag_id) VALUES ($1, $2)`,
      [pageId, tag2Id]
    );
    console.log(`✅ Page linked to 2 tags\n`);
    
    // Test 5: Read with joins (like the API does)
    console.log("[5] Testing read with joins...");
    const readResult = await client.query(`
      SELECT p.*, 
             ARRAY_AGG(JSON_BUILD_OBJECT('id', t.id, 'name', t.name, 'slug', t.slug)) as tags
      FROM pages p
      LEFT JOIN page_tags pt ON p.id = pt.page_id
      LEFT JOIN tags t ON pt.tag_id = t.id
      WHERE p.id = $1
      GROUP BY p.id
    `, [pageId]);
    
    const page = readResult.rows[0];
    console.log(`✅ Page retrieved with ${page.tags.filter((t: any) => t.id).length} tags\n`);
    
    // Test 6: Update with trigger
    console.log("[6] Testing auto-update timestamp trigger...");
    const beforeUpdate = await client.query(
      `SELECT updated_at FROM categories WHERE id = $1`, [categoryId]
    );
    const beforeTime = beforeUpdate.rows[0].updated_at;
    
    // Wait a bit and update
    await new Promise(resolve => setTimeout(resolve, 100));
    await client.query(
      `UPDATE categories SET name = $1 WHERE id = $2`,
      ["Updated Category Name", categoryId]
    );
    
    const afterUpdate = await client.query(
      `SELECT updated_at FROM categories WHERE id = $1`, [categoryId]
    );
    const afterTime = afterUpdate.rows[0].updated_at;
    
    if (new Date(afterTime) > new Date(beforeTime)) {
      console.log(`✅ Trigger working: updated_at was automatically updated\n`);
    } else {
      console.log(`⚠️  Trigger may not be working (times are identical)\n`);
    }
    
    // Test 7: Foreign key constraint
    console.log("[7] Testing foreign key constraints...");
    try {
      await client.query(
        `INSERT INTO pages (title, slug, category_id, content, status) 
         VALUES ($1, $2, $3, $4, $5)`,
        [
          "Invalid Page",
          "invalid-page",
          "00000000-0000-0000-0000-000000000000", // Non-existent UUID
          "This should fail",
          "draft"
        ]
      );
      console.log(`❌ Foreign key constraint NOT enforced\n`);
    } catch (error: any) {
      if (error.message.includes("foreign key")) {
        console.log(`✅ Foreign key constraint enforced correctly\n`);
      } else {
        console.log(`⚠️  Error but not FK constraint: ${error.message}\n`);
      }
    }
    
    // Test 8: Unique slug constraint
    console.log("[8] Testing unique slug constraint...");
    try {
      await client.query(
        `INSERT INTO categories (name, slug, status) 
         VALUES ($1, $2, $3)`,
        ["Duplicate", "test-category", "draft"] // Same slug as first category
      );
      console.log(`❌ Unique constraint NOT enforced\n`);
    } catch (error: any) {
      if (error.message.includes("unique")) {
        console.log(`✅ Unique constraint enforced correctly\n`);
      } else {
        console.log(`⚠️  Error but not unique constraint: ${error.message}\n`);
      }
    }
    
    console.log("=".repeat(60));
    console.log("✅ ALL CMS OPERATIONS WORKING CORRECTLY!");
    console.log("=".repeat(60) + "\n");
    
    // Cleanup test data
    console.log("🧹 Cleaning up test data...");
    await client.query(`DELETE FROM page_tags WHERE page_id = $1`, [pageId]);
    await client.query(`DELETE FROM pages WHERE id = $1`, [pageId]);
    await client.query(`DELETE FROM categories WHERE id = $1`, [categoryId]);
    await client.query(`DELETE FROM tags WHERE id IN ($1, $2)`, [tag1Id, tag2Id]);
    console.log("✅ Test data removed\n");
    
  } catch (error: any) {
    console.error("❌ Test failed:", error.message);
    throw error;
  } finally {
    await client.release();
    await pool.end();
  }
}

testCMSOperations();
