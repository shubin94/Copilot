import "./server/lib/loadEnv.ts";
import { db } from "./db/index.ts";
import { sql } from "drizzle-orm";

async function checkDuplicateUrls() {
  try {
    console.log("\n🔍 CHECKING FOR DUPLICATE URLS...\n");

    // Check for duplicate URL paths: country/state/city/detective_id/service_slug
    const duplicateUrls = await db.execute(sql`
      SELECT 
        country,
        state,
        city,
        detective_id,
        service_slug,
        COUNT(*) as count,
        STRING_AGG(id, ', ') as service_ids
      FROM services
      WHERE country IS NOT NULL AND state IS NOT NULL AND city IS NOT NULL 
        AND detective_id IS NOT NULL AND service_slug IS NOT NULL
      GROUP BY country, state, city, detective_id, service_slug
      HAVING COUNT(*) > 1
    `);

    if (duplicateUrls.rows.length === 0) {
      console.log("✅ NO DUPLICATE URLS FOUND!");
      console.log("   All URL paths are unique (country/state/city/detective/service)\n");
    } else {
      console.log(`❌ Found ${duplicateUrls.rows.length} duplicate URL paths:\n`);
      duplicateUrls.rows.forEach((row: any) => {
        console.log(`URL: /${row.country}/${row.state}/${row.city}/${row.detective_id}/${row.service_slug}`);
        console.log(`   Count: ${row.count}`);
        console.log(`   Service IDs: ${row.service_ids}\n`);
      });
    }

    // Summary
    const totalServices = await db.execute(sql`SELECT COUNT(*) as count FROM services`);
    const uniqueUrls = await db.execute(sql`
      SELECT COUNT(DISTINCT CONCAT(country, '/', state, '/', city, '/', detective_id, '/', service_slug)) as count 
      FROM services
    `);

    console.log(`📊 Summary:`);
    console.log(`   Total services: ${(totalServices.rows[0] as any).count}`);
    console.log(`   Unique URLs: ${(uniqueUrls.rows[0] as any).count}\n`);

  } catch (error) {
    console.error("❌ Error:", error);
    process.exit(1);
  }

  process.exit(0);
}

checkDuplicateUrls();
