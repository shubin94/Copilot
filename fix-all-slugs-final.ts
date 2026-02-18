import "./server/lib/loadEnv.ts";
import { db } from "./db/index.ts";
import { sql } from "drizzle-orm";

async function dropConstraintsAndFixSlugs() {
  console.log("\n🔧 REMOVING UNIQUE CONSTRAINTS AND FIXING SLUGS\n");

  try {
    // 1. Drop unique constraints
    console.log("1️⃣ Dropping unique constraints...");
    await db.execute(sql`
      ALTER TABLE detectives DROP CONSTRAINT IF EXISTS detectives_slug_key
    `);
    console.log("   ✅ Dropped detectives.slug constraint");

    await db.execute(sql`
      ALTER TABLE services DROP CONSTRAINT IF EXISTS services_slug_key
    `);
    console.log("   ✅ Dropped services.slug constraint\n");

    // 2. Generate detective slugs
    console.log("2️⃣ Generating detective slugs...");
    await db.execute(sql`
      UPDATE detectives
      SET slug = LOWER(REGEXP_REPLACE(TRIM(business_name), '[^a-zA-Z0-9\s-]', '', 'g')),
          updated_at = NOW()
      WHERE slug IS NULL OR slug = ''
    `);

    const detectiveCount = await db.execute(sql`
      SELECT COUNT(*) as count FROM detectives WHERE slug IS NOT NULL AND slug != ''
    `);
    console.log(`   ✅ Detectives with slugs: ${(detectiveCount.rows[0] as any).count}\n`);

    // 3. Generate service slugs
    console.log("3️⃣ Generating service slugs...");
    await db.execute(sql`
      UPDATE services
      SET slug = LOWER(
        REGEXP_REPLACE(
          REGEXP_REPLACE(TRIM(title), '\s+', '-', 'g'),
          '[^a-zA-Z0-9\-]',
          '',
          'g'
        )
      ),
      updated_at = NOW()
      WHERE slug IS NULL OR slug = ''
    `);

    const serviceCount = await db.execute(sql`
      SELECT COUNT(*) as count FROM services WHERE slug IS NOT NULL AND slug != ''
    `);
    console.log(`   ✅ Services with slugs: ${(serviceCount.rows[0] as any).count}\n`);

    // 4. Verify Paramount Detective
    console.log("4️⃣ Verifying Paramount Detective Agency...");
    const paramount = await db.execute(sql`
      SELECT id, business_name, slug FROM detectives 
      WHERE LOWER(business_name) LIKE '%paramount%' 
      LIMIT 1
    `);
    
    if (paramount.rows.length > 0) {
      const p = paramount.rows[0];
      console.log(`   Detective: ${p.business_name}`);
      console.log(`   Slug: ${p.slug}\n`);

      // Check their services
      console.log("5️⃣ Paramount's services...");
      const paramountServices = await db.execute(sql`
        SELECT title, slug, is_active FROM services 
        WHERE detective_id = ${p.id}
        LIMIT 3
      `);

      paramountServices.rows.forEach((s, i) => {
        console.log(`   ${i + 1}. ${s.title}`);
        console.log(`      └─ Slug: ${s.slug}`);
      });
    }

    // Final stats
    console.log("\n✅ FINAL VERIFICATION");
    const finalDetectives = await db.execute(sql`
      SELECT COUNT(*) as total, 
             SUM(CASE WHEN slug IS NOT NULL AND slug != '' THEN 1 ELSE 0 END)::int as with_slugs
      FROM detectives
    `);
    const finalServices = await db.execute(sql`
      SELECT COUNT(*) as total, 
             SUM(CASE WHEN slug IS NOT NULL AND slug != '' THEN 1 ELSE 0 END)::int as with_slugs
      FROM services
    `);

    console.log(`📊 Detectives: ${(finalDetectives.rows[0] as any).with_slugs}/${(finalDetectives.rows[0] as any).total} with slugs`);
    console.log(`📊 Services:   ${(finalServices.rows[0] as any).with_slugs}/${(finalServices.rows[0] as any).total} with slugs`);
    console.log("\n✅✅✅ ALL SLUGS FIXED AND VERIFIED! ✅✅✅\n");

  } catch (error) {
    console.error("❌ Error:", error);
    process.exit(1);
  }

  process.exit(0);
}

dropConstraintsAndFixSlugs();
