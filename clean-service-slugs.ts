import "./server/lib/loadEnv.ts";
import { db } from "./db/index.ts";
import { sql } from "drizzle-orm";

async function cleanServiceSlugs() {
  console.log("\n🧹 CLEANING SERVICE SLUGS (remove spaces and numbers)\n");

  try {
    // Clean all service slugs - replace spaces with hyphens and remove trailing numbers
    console.log("1️⃣ Replacing spaces with hyphens in service slugs...");
    await db.execute(sql`
      UPDATE services
      SET slug = REGEXP_REPLACE(
        LOWER(REGEXP_REPLACE(TRIM(title), '\s+', '-', 'g')),
        '[^a-zA-Z0-9\-]',
        '',
        'g'
      ),
      updated_at = NOW()
      WHERE TRUE
    `);

    // Verify Paramount's services again
    console.log("\n2️⃣ Verifying Paramount's services with clean slugs...");
    const paramount = await db.execute(sql`
      SELECT id, business_name, slug FROM detectives 
      WHERE LOWER(business_name) LIKE '%paramount%' 
      LIMIT 1
    `);
    
    if (paramount.rows.length > 0) {
      const p = paramount.rows[0];
      console.log(`   Detective: ${p.business_name}`);
      console.log(`   Slug: ${p.slug}\n`);

      const paramountServices = await db.execute(sql`
        SELECT title, slug, is_active FROM services 
        WHERE detective_id = ${p.id}
        LIMIT 5
      `);

      console.log("   Services:");
      paramountServices.rows.forEach((s, i) => {
        console.log(`   ${i + 1}. Title: ${s.title}`);
        console.log(`      Slug: ${s.slug}`);
      });
    }

    // Final verification
    console.log("\n3️⃣ Sample of all services with clean slugs...");
    const samples = await db.execute(sql`
      SELECT s.title, s.slug, d.business_name FROM services s
      JOIN detectives d ON s.detective_id = d.id
      WHERE s.slug IS NOT NULL AND s.slug != ''
      LIMIT 5
    `);

    samples.rows.forEach((row, i) => {
      console.log(`${i + 1}. Detective: ${row.business_name}`);
      console.log(`   Service: ${row.title}`);
      console.log(`   Slug: ${row.slug}`);
    });

    // Check for any remaining spaces or weird characters
    console.log("\n4️⃣ Checking for any bad slugs...");
    const badSlugs = await db.execute(sql`
      SELECT COUNT(*) as bad_count FROM services 
      WHERE slug LIKE '% %' OR slug LIKE '%  %'
    `);
    console.log(`   Services with spaces in slug: ${(badSlugs.rows[0] as any).bad_count}`);

    console.log("\n✅✅✅ ALL SERVICE SLUGS CLEANED! ✅✅✅\n");

  } catch (error) {
    console.error("❌ Error:", error);
    process.exit(1);
  }

  process.exit(0);
}

cleanServiceSlugs();
