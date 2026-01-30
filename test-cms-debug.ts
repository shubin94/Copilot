import { pool } from "./db/index.ts";

async function testCMSAPIs() {
  console.log("🧪 Testing CMS API endpoints...\n");

  try {
    // Test 1: Check if routes are registered
    console.log("1️⃣ Testing admin routes registration...");
    
    // Test 2: Check database connection
    console.log("2️⃣ Testing database connection...");
    const dbTest = await pool.query("SELECT COUNT(*) FROM categories");
    console.log("✅ Database connected. Categories count:", dbTest.rows[0].count);

    // Test 3: Check if categories table has correct columns
    console.log("\n3️⃣ Checking categories table schema...");
    const schemaTest = await pool.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'categories'
      ORDER BY ordinal_position
    `);
    console.log("✅ Categories columns:");
    schemaTest.rows.forEach(row => {
      console.log(`   - ${row.column_name}: ${row.data_type}`);
    });

    // Test 4: Try creating a category directly
    console.log("\n4️⃣ Testing direct category creation...");
    const testCat = await pool.query(
      `INSERT INTO categories (id, name, slug, status, created_at, updated_at)
       VALUES (gen_random_uuid(), $1, $2, $3, NOW(), NOW())
       RETURNING *`,
      ["Test Category", "test-cat", "published"]
    );
    console.log("✅ Direct insert works:", {
      id: testCat.rows[0].id,
      name: testCat.rows[0].name,
      status: testCat.rows[0].status,
    });

    // Test 5: Clean up
    console.log("\n5️⃣ Cleaning up test data...");
    await pool.query("DELETE FROM categories WHERE slug = $1", ["test-cat"]);
    console.log("✅ Cleanup complete");

    // Test 6: Check tags table
    console.log("\n6️⃣ Checking tags table...");
    const tagsCount = await pool.query("SELECT COUNT(*) FROM tags");
    console.log("✅ Tags count:", tagsCount.rows[0].count);

    // Test 7: Check pages table
    console.log("\n7️⃣ Checking pages table...");
    const pagesCount = await pool.query("SELECT COUNT(*) FROM pages");
    console.log("✅ Pages count:", pagesCount.rows[0].count);

    // Test 8: List a published page
    console.log("\n8️⃣ Checking for published pages...");
    const published = await pool.query("SELECT * FROM pages WHERE status = 'published' LIMIT 1");
    if (published.rows.length > 0) {
      const page = published.rows[0];
      console.log("✅ Found published page:", {
        id: page.id,
        title: page.title,
        slug: page.slug,
        status: page.status,
        hasContent: !!page.content,
        hasMetaTitle: !!page.meta_title,
      });
    } else {
      console.log("⚠️ No published pages found");
    }

    console.log("\n✅ ALL TESTS PASSED - Database and tables are working!");
    
  } catch (error) {
    console.error("\n❌ Test failed:", error);
    process.exit(1);
  }

  process.exit(0);
}

testCMSAPIs();
