import "dotenv/config";
import { pool } from "./db/index.ts";

async function main() {
  console.log("Testing connection to database...");
  try {
    const result = await pool.query("SELECT NOW()");
    console.log("✅ Database connection successful:", result.rows[0]);
    
    // Test the actual pages table
    const pagesResult = await pool.query("SELECT id, slug, category_id FROM pages LIMIT 1");
    console.log("✅ Pages table exists, sample:", pagesResult.rows[0]);
    
    // Check if test page exists
    const testPage = await pool.query("SELECT id, slug, category_id FROM pages WHERE slug = 'csdcsdc' LIMIT 1");
    console.log("✅ Test page query result:", testPage.rows);
    
    // Check specific category
    const categoryCheck = await pool.query(
      `SELECT p.id, p.slug, c.slug as category_slug, c.name 
       FROM pages p 
       LEFT JOIN categories c ON p.category_id = c.id 
       WHERE c.slug = 'test-cat-1' LIMIT 1`
    );
    console.log("✅ Category pages check:", categoryCheck.rows);
    
    process.exit(0);
  } catch (error) {
    console.error("❌ Error:", error);
    process.exit(1);
  }
}

main();
