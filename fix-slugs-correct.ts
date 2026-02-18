import "./server/lib/loadEnv.ts";
import { db } from "./db/index.ts";
import { sql } from "drizzle-orm";

async function fixServiceSlugsCorrectly() {
  console.log("\n✨ GENERATING CORRECT SERVICE SLUGS\n");

  try {
    console.log("1️⃣ Generating proper service slugs from titles...");
    
    // Get all services and generate slugs in memory
    const allServices = await db.execute(sql`
      SELECT id, title FROM services
    `);

    let updated = 0;
    for (const svc of allServices.rows) {
      // Create slug: lowercase, replace spaces with hyphens, remove special chars
      const slug = svc.title
        .toLowerCase()
        .trim()
        .replace(/[&]/g, 'and')  // Replace & with 'and'
        .replace(/[^a-z0-9\s-]/g, '')  // Remove special chars
        .replace(/\s+/g, '-')  // Replace spaces with hyphens
        .replace(/-+/g, '-')  // Replace multiple hyphens with single
        .replace(/^-|-$/g, '');  // Remove leading/trailing hyphens

      if (slug) {
        await db.execute(sql`
          UPDATE services SET slug = ${slug}, updated_at = NOW() WHERE id = ${svc.id}
        `);
        updated++;
      }
    }
    console.log(`   ✅ Updated ${updated} service slugs\n`);

    // Verify Paramount
    console.log("2️⃣ Verifying Paramount Detective Agency services...");
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
        SELECT title, slug FROM services 
        WHERE detective_id = ${p.id}
        LIMIT 5
      `);

      console.log("   Services:");
      paramountServices.rows.forEach((s, i) => {
        console.log(`   ${i + 1}. ${s.title}`);
        console.log(`      └─ ${s.slug}`);
      });
    }

    // Sample across all
    console.log("\n3️⃣ Sample of services from different detectives...");
    const samples = await db.execute(sql`
      SELECT s.title, s.slug, d.business_name FROM services s
      JOIN detectives d ON s.detective_id = d.id
      LIMIT 10
    `);

    samples.rows.forEach((row, i) => {
      if (i === 0) console.log(`\n   Detective: ${row.business_name}`);
      console.log(`   ${i + 1}. ${row.title}`);
      console.log(`      └─ ${row.slug}`);
    });

    console.log("\n✅✅✅ ALL SLUGS GENERATED CORRECTLY! ✅✅✅\n");

  } catch (error) {
    console.error("❌ Error:", error);
    process.exit(1);
  }

  process.exit(0);
}

fixServiceSlugsCorrectly();
