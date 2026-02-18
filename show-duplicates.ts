import "./server/lib/loadEnv.ts";
import { db } from "./db/index.ts";
import { sql } from "drizzle-orm";

async function showDuplicates() {
  try {
    // Show duplicate detective slugs
    console.log("\n🔴 DUPLICATE DETECTIVE SLUGS:\n");
    const detectiveDups = await db.execute(sql`
      SELECT slug, COUNT(*) as count, STRING_AGG(business_name, ' | ') as names
      FROM detectives
      WHERE slug IS NOT NULL AND slug != ''
      GROUP BY slug
      HAVING COUNT(*) > 1
      ORDER BY count DESC
    `);

    if (detectiveDups.rows.length > 0) {
      detectiveDups.rows.forEach((row: any) => {
        console.log(`Slug: ${row.slug}`);
        console.log(`Count: ${row.count}`);
        console.log(`Names: ${row.names}\n`);
      });
    } else {
      console.log("✅ No duplicate detective slugs!\n");
    }

    // Show duplicate service slugs
    console.log("🔴 DUPLICATE SERVICE SLUGS:\n");
    const serviceDups = await db.execute(sql`
      SELECT slug, COUNT(*) as count, STRING_AGG(DISTINCT title, ' | ') as titles
      FROM services
      WHERE slug IS NOT NULL AND slug != ''
      GROUP BY slug
      HAVING COUNT(*) > 1
      ORDER BY count DESC
    `);

    if (serviceDups.rows.length > 0) {
      console.log(`Total duplicate service slugs: ${serviceDups.rows.length}`);
      serviceDups.rows.slice(0, 10).forEach((row: any) => {
        console.log(`  ${row.slug} (${row.count}x)`);
      });
    } else {
      console.log("✅ No duplicate service slugs!\n");
    }

  } catch (error) {
    console.error("Error:", error);
  }

  process.exit(0);
}

showDuplicates();
