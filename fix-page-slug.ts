import * as fs from "fs";
import * as path from "path";
import { pool } from "./db/index.ts";

async function fixPageSlug() {
  try {
    // Fetch all pages with their categories
    const result = await pool.query(`
      SELECT 
        p.id, 
        p.title, 
        p.slug,
        p.category_id,
        c.id as cat_id, 
        c.name, 
        c.slug as cat_slug
      FROM pages p 
      LEFT JOIN categories c ON p.category_id = c.id
    `);

    console.log("Current pages and categories:");
    for (const row of result.rows) {
      const pageSlug = row.slug;
      const categorySlug = row.cat_slug;
      
      // Check if page slug already includes category prefix
      if (categorySlug && !pageSlug.startsWith(categorySlug + "/")) {
        // Extract the page slug part (just the last segment)
        const pageSlugPart = pageSlug.split("/").pop();
        const newSlug = `${categorySlug}/${pageSlugPart}`;
        
        console.log(`\nUpdating page: ${row.title}`);
        console.log(`  Old slug: ${pageSlug}`);
        console.log(`  Category: ${row.name} (${categorySlug})`);
        console.log(`  New slug: ${newSlug}`);
        
        // Update the page slug
        await pool.query(
          "UPDATE pages SET slug = $1 WHERE id = $2",
          [newSlug, row.id]
        );
        
        console.log(`  ✓ Updated!`);
      } else if (categorySlug) {
        console.log(`\n${row.title}: Already has correct format (${pageSlug})`);
      } else {
        console.log(`\n${row.title}: No category assigned, keeping slug as is (${pageSlug})`);
      }
    }

    console.log("\n\nAll pages updated successfully!");
    process.exit(0);
  } catch (error) {
    console.error("Error:", error);
    process.exit(1);
  }
}

fixPageSlug();
