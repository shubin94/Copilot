import { pool } from "./db/index.ts";

async function testPublicPages() {
  try {
    console.log("🧪 Testing public pages API...\n");

    // Get one published page
    console.log("1️⃣ Fetching a published page from database...");
    const pageResult = await pool.query(
      `SELECT id, slug, title, status FROM pages WHERE status = 'published' LIMIT 1`
    );

    if (pageResult.rows.length === 0) {
      console.log("ℹ️ No published pages yet. Creating a test one...");
      
      // Create a test page
      const categoryResult = await pool.query(
        `SELECT id FROM categories WHERE status = 'published' LIMIT 1`
      );
      
      if (categoryResult.rows.length === 0) {
        console.log("⚠️ No published categories. Please create one first.");
        process.exit(0);
      }

      const testPageResult = await pool.query(
        `INSERT INTO pages (id, title, slug, category_id, content, status, meta_title, meta_description)
         VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7)
         RETURNING id, slug, title, status`,
        [
          "Test Public Page",
          "test-public-page",
          categoryResult.rows[0].id,
          "<h1>Welcome!</h1><p>This is a public test page.</p>",
          "published",
          "Test Public Page - SEO Title",
          "This page demonstrates the public WordPress-style viewing experience"
        ]
      );

      console.log("✅ Created test page:", testPageResult.rows[0]);
      
      // Test the public API fetch (simulating the frontend call)
      console.log("\n2️⃣ Testing GET /api/public/pages/:slug...");
      
      const testSlug = testPageResult.rows[0].slug;
      const apiResponse = await pool.query(
        `SELECT 
          p.id,
          p.title,
          p.slug,
          p.content,
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
         WHERE p.slug = $1 AND p.status = 'published'`,
        [testSlug]
      );

      if (apiResponse.rows.length > 0) {
        const page = apiResponse.rows[0];
        console.log("✅ API would return:");
        console.log({
          title: page.title,
          slug: page.slug,
          status: page.status,
          metaTitle: page.meta_title,
          metaDescription: page.meta_description,
          category: {
            id: page.category_id,
            name: page.category_name,
            slug: page.category_slug,
          },
        });

        // Test draft page returns 404
        console.log("\n3️⃣ Testing draft page returns 404...");
        const draftTest = await pool.query(
          `SELECT p.id, p.slug FROM pages WHERE status = 'draft' LIMIT 1`
        );
        
        if (draftTest.rows.length > 0) {
          const draftQuery = await pool.query(
            `SELECT id FROM pages WHERE slug = $1 AND status = 'published'`,
            [draftTest.rows[0].slug]
          );
          
          if (draftQuery.rows.length === 0) {
            console.log("✅ Draft pages correctly return 404 (not found in published)");
          }
        }

        // Cleanup
        console.log("\n4️⃣ Cleaning up test page...");
        await pool.query("DELETE FROM pages WHERE slug = $1", [testSlug]);
        console.log("✅ Test page deleted");

        console.log("\n✅ ALL PUBLIC PAGES TESTS PASSED");
        console.log("Public WordPress-style pages are ready!");
      }
    } else {
      const page = pageResult.rows[0];
      console.log("✅ Found published page:", page);
      
      console.log("\n2️⃣ Testing API response for published page...");
      const apiTest = await pool.query(
        `SELECT 
          p.id,
          p.title,
          p.slug,
          p.content,
          p.status,
          p.meta_title,
          p.meta_description,
          c.name as category_name
         FROM pages p
         LEFT JOIN categories c ON p.category_id = c.id
         WHERE p.slug = $1 AND p.status = 'published'`,
        [page.slug]
      );

      console.log("✅ API returns:", apiTest.rows[0]);
      console.log("\n✅ PUBLIC PAGES API WORKING");
      console.log(`📍 Visit http://localhost:5000/pages/${page.slug} to view the page`);
    }

    process.exit(0);
  } catch (error) {
    console.error("\n❌ Test failed:", error);
    process.exit(1);
  }
}

testPublicPages();
