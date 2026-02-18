import "./server/lib/loadEnv.ts";
import { db } from "./db/index.ts";
import { sql } from "drizzle-orm";

async function fixDuplicateDetectiveSlugs() {
  console.log("\n🔧 FIXING DUPLICATE DETECTIVE SLUGS\n");

  try {
    // Find duplicate detective slugs
    const duplicates = await db.execute(sql`
      SELECT slug, COUNT(*) as count FROM detectives 
      WHERE slug IS NOT NULL AND slug != ''
      GROUP BY slug 
      HAVING COUNT(*) > 1
    `);

    console.log(`Found ${duplicates.rows.length} duplicate detective slugs\n`);

    for (const dup of duplicates.rows) {
      console.log(`Fixing "${dup.slug}" (appears ${dup.count} times):`);
      
      const detectives = await db.execute(sql`
        SELECT id, business_name FROM detectives 
        WHERE slug = ${dup.slug}
        ORDER BY created_at
      `);

      // Keep first one unchanged, add hash suffix to others
      for (let i = 1; i < detectives.rows.length; i++) {
        const det = detectives.rows[i];
        const hash = det.id.substring(0, 8); // Use first 8 chars of ID
        const newSlug = `${dup.slug}-${hash}`;
        
        await db.execute(sql`
          UPDATE detectives SET slug = ${newSlug}, updated_at = NOW() WHERE id = ${det.id}
        `);
        
        console.log(`  ${i}. "${det.business_name}" → ${newSlug}`);
      }
      console.log();
    }

    // Verify
    console.log("✅ VERIFICATION");
    const dupCheck = await db.execute(sql`
      SELECT slug, COUNT(*) as count FROM detectives 
      WHERE slug IS NOT NULL AND slug != ''
      GROUP BY slug 
      HAVING COUNT(*) > 1
    `);

    if (dupCheck.rows.length === 0) {
      console.log("   ✅ All detective slugs are now UNIQUE!");
    } else {
      console.log(`   ❌ Still have ${dupCheck.rows.length} duplicates`);
    }

    const totalUnique = await db.execute(sql`
      SELECT COUNT(DISTINCT slug) as count FROM detectives WHERE slug IS NOT NULL
    `);
    console.log(`   📊 Total unique detective slugs: ${(totalUnique.rows[0] as any).count}\n`);

  } catch (error) {
    console.error("❌ Error:", error);
    process.exit(1);
  }

  process.exit(0);
}

fixDuplicateDetectiveSlugs();
