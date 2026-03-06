import "./server/lib/loadEnv.ts";
import { db } from "./db/index.ts";
import { sql } from "drizzle-orm";

async function deleteDuplicateDetectives() {
  try {
    console.log("\n🗑️ DELETING DUPLICATE DETECTIVES...\n");

    // Get the IDs that will be deleted
    const toDelete = await db.execute(sql`
      SELECT id, business_name, slug FROM (
        SELECT id, business_name, slug, ROW_NUMBER() OVER (PARTITION BY slug ORDER BY created_at) as rn
        FROM detectives
        WHERE slug IN ('venusdetectiveagency', 'nipidetectivenetworkindia', 'garudadetectives')
      ) t
      WHERE rn > 1
    `);

    console.log(`Found ${toDelete.rows.length} duplicate detectives to delete:\n`);
    toDelete.rows.forEach((row: any) => {
      console.log(`  ❌ ${row.business_name} (${row.slug})`);
    });

    // Delete them
    const result = await db.execute(sql`
      DELETE FROM detectives 
      WHERE id IN (
        SELECT id FROM (
          SELECT id, ROW_NUMBER() OVER (PARTITION BY slug ORDER BY created_at) as rn
          FROM detectives
          WHERE slug IN ('venusdetectiveagency', 'nipidetectivenetworkindia', 'garudadetectives')
        ) t
        WHERE rn > 1
      )
    `);

    console.log(`\n✅ Deleted ${toDelete.rows.length} duplicate detective records\n`);

    // Verify
    const remaining = await db.execute(sql`
      SELECT COUNT(*) as count FROM detectives
    `);

    console.log(`📊 Total detectives remaining: ${(remaining.rows[0] as any).count}`);

  } catch (error) {
    console.error("❌ Error:", error);
    process.exit(1);
  }

  process.exit(0);
}

deleteDuplicateDetectives();
