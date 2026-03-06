import "./server/lib/loadEnv.ts";
import { db } from "./db/index.ts";
import { services, detectives } from "./shared/schema.ts";
import { eq, sql } from "drizzle-orm";

async function debug() {
  console.log("\n🔍 DEBUGGING SERVICE ISSUES\n");

  try {
    // Check slug status
    const slugStats = await db.execute(sql`
      SELECT 
        COUNT(*) as total_services,
        SUM(CASE WHEN slug IS NOT NULL AND slug != '' THEN 1 ELSE 0 END)::int as with_slugs,
        SUM(CASE WHEN slug IS NULL OR slug = '' THEN 1 ELSE 0 END)::int as without_slugs
      FROM services
    `);
    console.log("📊 Service Slug Status:");
    console.log(slugStats.rows);

    // Check detective exists
    const paramount = await db.execute(sql`
      SELECT id, business_name, slug FROM detectives 
      WHERE LOWER(business_name) LIKE '%paramount%' 
      LIMIT 1
    `);
    console.log("\n🔎 Paramount Detective:");
    if (paramount.rows.length > 0) {
      console.log(paramount.rows[0]);
    } else {
      console.log("❌ NOT FOUND!");
    }

    // Check services for that detective
    if (paramount.rows.length > 0) {
      const detectiveId = paramount.rows[0].id;
      const detectiveServices = await db.execute(sql`
        SELECT id, title, slug, is_active, images 
        FROM services 
        WHERE detective_id = ${detectiveId}
        LIMIT 5
      `);
      console.log("\n📦 Services for Paramount:");
      console.log(`Count: ${detectiveServices.rows.length}`);
      detectiveServices.rows.forEach(s => {
        console.log(`  - ${s.title} | slug: ${s.slug} | active: ${s.is_active} | images: ${s.images ? 'YES' : 'NO'}`);
      });
    }

    // Check total services with images
    const totalWithImages = await db.execute(sql`
      SELECT COUNT(*) as count FROM services 
      WHERE images IS NOT NULL AND array_length(images, 1) > 0
    `);
    console.log("\n✅ Total services WITH images:", totalWithImages.rows[0]);

    // Sample services
    const sample = await db.execute(sql`
      SELECT id, title, slug, is_active, images FROM services 
      WHERE slug IS NOT NULL AND slug != ''
      LIMIT 3
    `);
    console.log("\n📋 Sample services with slugs:");
    sample.rows.forEach(s => {
      console.log(`  - ${s.title} | slug: ${s.slug}`);
    });

  } catch (error) {
    console.error("❌ Error:", error);
  }

  process.exit(0);
}

debug();
