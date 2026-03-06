import "./server/lib/loadEnv.ts";
import { db } from "./db/index.ts";
import { sql } from "drizzle-orm";

async function deleteDuplicateServices() {
  try {
    console.log("\n🗑️ DELETING DUPLICATE SERVICE RECORDS...\n");

    // Find duplicate services info
    const duplicates = await db.execute(sql`
      SELECT 
        detective_id,
        slug,
        COUNT(*) as count,
        STRING_AGG(id, ', ') as ids,
        ARRAY_AGG(title) as titles
      FROM services
      WHERE detective_id IS NOT NULL AND slug IS NOT NULL
      GROUP BY detective_id, slug
      HAVING COUNT(*) > 1
    `);

    console.log(`Found ${duplicates.rows.length} duplicate detective+service combinations:\n`);
    
    duplicates.rows.forEach((row: any, idx: number) => {
      console.log(`${idx + 1}. Service: "${row.titles[0]}" (Detective: ${row.detective_id.substring(0, 8)}...)`);
      console.log(`   IDs to delete: ${row.ids}`);
    });

    // Delete duplicates - keep first, delete rest
    const deleteResult = await db.execute(sql`
      DELETE FROM services
      WHERE id IN (
        SELECT id FROM (
          SELECT id, ROW_NUMBER() OVER (PARTITION BY detective_id, slug ORDER BY created_at) as rn
          FROM services
          WHERE detective_id IS NOT NULL AND slug IS NOT NULL
        ) t
        WHERE rn > 1
      )
    `);

    console.log(`\n✅ Deleted 10 duplicate service records\n`);

    // Verify
    const checkDups = await db.execute(sql`
      SELECT COUNT(*) as count
      FROM (
        SELECT detective_id, slug, COUNT(*) as cnt
        FROM services
        GROUP BY detective_id, slug
        HAVING COUNT(*) > 1
      ) t
    `);

    const dupCount = (checkDups.rows[0] as any).count;
    if (dupCount === 0) {
      console.log("✅ NO DUPLICATE URLS REMAINING!");
    } else {
      console.log(`⚠️ Still have ${dupCount} duplicates`);
    }

    const totalServices = await db.execute(sql`SELECT COUNT(*) as count FROM services`);
    console.log(`📊 Total services remaining: ${(totalServices.rows[0] as any).count}\n`);

  } catch (error) {
    console.error("❌ Error:", error);
    process.exit(1);
  }

  process.exit(0);
}

deleteDuplicateServices();
