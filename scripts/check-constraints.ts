/**
 * Check what CHECK constraints exist in the database
 */

import "../server/lib/loadEnv";
import { db } from "../db/index";
import { sql } from "drizzle-orm";

async function main() {
  console.log("\n🔍 Checking constraints in database...\n");

  try {
    // Get the CHECK constraints
    const result = await db.execute<{
      conname: string;
      definition: string;
      tablename: string;
    }>(sql`
      SELECT 
        conname,
        pg_get_constraintdef(c.oid) as definition,
        t.relname as tablename
      FROM pg_constraint c
      JOIN pg_class t ON c.conrelid = t.oid
      WHERE conname IN ('categories_status_check', 'pages_status_check', 'tags_status_check')
      ORDER BY tablename
    `);

    if (result.rows.length === 0) {
      console.log("❌ No constraints found with these names");
    } else {
      console.log("Found constraints:\n");
      for (const row of result.rows) {
        console.log(`📋 ${row.tablename}.${row.conname}`);
        console.log(`   Definition: ${row.definition}\n`);
      }
    }
  } catch (error) {
    console.error("❌ Error checking constraints:", error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

main().catch((error) => {
  console.error("Fatal error:", error instanceof Error ? error.message : String(error));
  process.exit(1);
});
