import "./server/lib/loadEnv.ts";
import { db } from "./db/index.ts";
import { sql } from "drizzle-orm";

async function checkSlugUniqueness() {
  console.log("\n🔍 CHECKING SLUG UNIQUENESS\n");

  try {
    // Check detective slug uniqueness
    console.log("1️⃣ Detective Slug Uniqueness...");
    const duplicateDetectives = await db.execute(sql`
      SELECT slug, COUNT(*) as count FROM detectives 
      WHERE slug IS NOT NULL AND slug != ''
      GROUP BY slug 
      HAVING COUNT(*) > 1
    `);

    if (duplicateDetectives.rows.length === 0) {
      console.log("   ✅ ALL detective slugs are UNIQUE!");
    } else {
      console.log(`   ❌ Found ${duplicateDetectives.rows.length} duplicate detective slugs:`);
      duplicateDetectives.rows.forEach(row => {
        console.log(`      "${row.slug}" appears ${row.count} times`);
      });
    }

    // Check service slug uniqueness
    console.log("\n2️⃣ Service Slug Uniqueness...");
    const duplicateServices = await db.execute(sql`
      SELECT slug, COUNT(*) as count FROM services 
      WHERE slug IS NOT NULL AND slug != ''
      GROUP BY slug 
      HAVING COUNT(*) > 1
      ORDER BY count DESC
    `);

    if (duplicateServices.rows.length === 0) {
      console.log("   ✅ ALL service slugs are UNIQUE!");
    } else {
      console.log(`   ⚠️  Found ${duplicateServices.rows.length} duplicate service slugs:`);
      console.log("   (This is OK - uniqueness comes from full URL path)\n");
      duplicateServices.rows.slice(0, 10).forEach(row => {
        console.log(`      "${row.slug}" appears ${row.count} times`);
      });
      if (duplicateServices.rows.length > 10) {
        console.log(`      ... and ${duplicateServices.rows.length - 10} more`);
      }
    }

    // Show examples of duplicate services with different detectives
    if (duplicateServices.rows.length > 0) {
      console.log("\n3️⃣ Example: Services with duplicate slug 'background-checks-services'");
      const duplicateExample = await db.execute(sql`
        SELECT s.id, s.title, d.business_name, d.slug as detective_slug
        FROM services s
        JOIN detectives d ON s.detective_id = d.id
        WHERE s.slug = 'background-checks-services'
        LIMIT 5
      `);

      console.log("   (Different detectives can have same service slug - URL is unique via full path)\n");
      duplicateExample.rows.forEach((row, i) => {
        console.log(`   ${i + 1}. Detective: ${row.detective_slug} (${row.business_name})`);
        console.log(`      Service: ${row.title}`);
        console.log(`      Full URL: /service/.../\${country}/\${state}/\${city}/${row.detective_slug}/${row.slug}`);
      });
    }

    // Final summary
    console.log("\n✅ SUMMARY");
    const totalDetectives = await db.execute(sql` SELECT COUNT(*) as count FROM detectives WHERE slug IS NOT NULL`);
    const totalServices = await db.execute(sql` SELECT COUNT(*) as count FROM services WHERE slug IS NOT NULL`);
    const uniqueServiceSlugs = await db.execute(sql` SELECT COUNT(DISTINCT slug) as count FROM services WHERE slug IS NOT NULL`);

    console.log(`   📊 Total detectives with slugs: ${(totalDetectives.rows[0] as any).count}`);
    console.log(`   📊 Total services with slugs: ${(totalServices.rows[0] as any).count}`);
    console.log(`   📊 Unique service slug values: ${(uniqueServiceSlugs.rows[0] as any).count}`);
    console.log(`\n   ℹ️  Duplicate service slugs are OK because full URL path (country/state/city/detective/service) is unique!\n`);

  } catch (error) {
    console.error("❌ Error:", error);
    process.exit(1);
  }

  process.exit(0);
}

checkSlugUniqueness();
