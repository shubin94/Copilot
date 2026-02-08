import "./server/lib/loadEnv.ts";
import { pool } from "./db/index.ts";

async function checkCategories() {
  try {
    const result = await pool.query(`
      SELECT 
        c.id, 
        c.name, 
        c.slug,
        c.parent_id,
        p.name as parent_name,
        p.slug as parent_slug
      FROM categories c
      LEFT JOIN categories p ON c.parent_id = p.id
      ORDER BY c.name
    `);
    
    console.log("Categories structure:");
    for (const row of result.rows) {
      if (row.parent_id) {
        console.log(`  ${row.name} (slug: ${row.slug}) -> Parent: ${row.parent_name} (slug: ${row.parent_slug})`);
      } else {
        console.log(`  ${row.name} (slug: ${row.slug})`);
      }
    }
  } catch (error) {
    console.error("Error:", error);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

checkCategories();
