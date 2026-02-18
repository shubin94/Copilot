import "./server/lib/loadEnv.ts";
import { db } from "./db/index.ts";
import { sql } from "drizzle-orm";

async function checkDuplicate() {
  try {
    // First, just get one service to see what columns exist
    const sample = await db.execute(sql`SELECT * FROM services LIMIT 1`);
    console.log("Service columns:", Object.keys(sample.rows[0]));
    
    // Check for duplicate by detective_id + slug combination
    const duplicates = await db.execute(sql`
      SELECT 
        detective_id,
        slug,
        COUNT(*) as count,
        STRING_AGG(id, ', ') as ids
      FROM services
      WHERE detective_id IS NOT NULL AND slug IS NOT NULL
      GROUP BY detective_id, slug
      HAVING COUNT(*) > 1
    `);

    console.log(`\n🔍 DUPLICATE URLS (detective_id + service_slug): ${duplicates.rows.length}\n`);
    
    if (duplicates.rows.length > 0) {
      console.log("Found duplicates:");
      duplicates.rows.forEach((row: any) => {
        console.log(`  Detective ${row.detective_id} + Slug "${row.slug}": ${row.count} times`);
      });
    } else {
      console.log("✅ NO DUPLICATE URLs!");
    }

  } catch (error: any) {
    console.error("Error:", error.message);
  }

  process.exit(0);
}

checkDuplicate();
