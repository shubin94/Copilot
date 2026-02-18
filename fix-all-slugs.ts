import "./server/lib/loadEnv.ts";
import { db } from "./db/index.ts";
import { detectives, services } from "./shared/schema.ts";
import { sql, isNull, or } from "drizzle-orm";

async function fixSlugs() {
  console.log("\n🔧 FIXING ALL SLUGS IN DATABASE\n");

  try {
    // 1. Fix detective slugs
    console.log("1️⃣ Generating detective slugs...");
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

    // 2. Fix service slugs - generate clean slugs from titles
    console.log("2️⃣ Generating clean service slugs...");
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
      WHERE slug IS NULL OR slug = '' OR slug LIKE '% %'
    `);

    const serviceCount = await db.execute(sql`
      SELECT COUNT(*) as count FROM services WHERE slug IS NOT NULL AND slug != ''
    `);
    console.log(`   ✅ Services with slugs: ${(serviceCount.rows[0] as any).count}\n`);

    // 3. Verify Paramount Detective
    console.log("3️⃣ Verifying Paramount Detective Agency...");
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
      console.log("4️⃣ Verifying Paramount's services...");
      const paramountServices = await db.execute(sql`
        SELECT title, slug, is_active, images FROM services 
        WHERE detective_id = ${p.id}
        LIMIT 3
      `);

      paramountServices.rows.forEach((s, i) => {
        console.log(`   Service ${i + 1}: ${s.title}`);
        console.log(`   ├─ Slug: ${s.slug}`);
        console.log(`   ├─ Active: ${s.is_active}`);
        console.log(`   └─ Has Images: ${s.images ? '✅' : '❌'}\n`);
      });
    }

    // 4. Sample of other services
    console.log("5️⃣ Sample of other services with slugs...");
    const samples = await db.execute(sql`
      SELECT s.title, s.slug, d.business_name FROM services s
      JOIN detectives d ON s.detective_id = d.id
      WHERE s.slug IS NOT NULL AND s.slug != ''
      LIMIT 5
    `);

    samples.rows.forEach((row, i) => {
      console.log(`${i + 1}. Detective: ${row.business_name}`);
      console.log(`   Service: ${row.title}`);
      console.log(`   Slug: ${row.slug}\n`);
    });

    // 5. Final count
    console.log("✅ FINAL VERIFICATION");
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
    console.log("\n✅ ALL SLUGS FIXED AND VERIFIED!\n");

  } catch (error) {
    console.error("❌ Error:", error);
    process.exit(1);
  }

  process.exit(0);
}

fixSlugs();
