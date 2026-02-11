/**
 * Apply missing claim_tokens table migration
 */

import "../server/lib/loadEnv";
import { db } from "../db/index";
import { sql } from "drizzle-orm";
import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, "..");

async function main() {
  console.log("\n🔧 Applying missing claim_tokens table migration...\n");

  const migrationPath = path.join(projectRoot, "migrations", "0015_add_claim_tokens_table.sql");
  
  if (!fs.existsSync(migrationPath)) {
    console.error("❌ Migration file not found:", migrationPath);
    process.exit(1);
  }

  const migrationSQL = fs.readFileSync(migrationPath, "utf-8");
  
  console.log("📄 Migration SQL:");
  console.log(migrationSQL);
  console.log("\n⏳ Executing migration...\n");

  try {
    // Check if table already exists
    const tableExists = await db.execute(sql`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public'
        AND table_name = 'claim_tokens'
      ) AS exists
    `);

    if (tableExists.rows[0]?.exists) {
      console.log("✅ Table claim_tokens already exists - no action needed");
      return;
    }

    // Apply the migration
    await db.execute(sql.raw(migrationSQL));

    console.log("✅ Migration applied successfully!");
    
    // Verify table was created
    const verifyResult = await db.execute(sql`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'claim_tokens'
      ORDER BY ordinal_position
    `);

    console.log("\n📊 Created table structure:");
    for (const row of verifyResult.rows) {
      console.log(`  - ${row.column_name}: ${row.data_type} ${row.is_nullable === 'NO' ? 'NOT NULL' : ''}`);
    }

    console.log("\n✅ claim_tokens table is now ready!");

  } catch (error) {
    console.error("\n❌ Migration failed:");
    console.error(error);
    process.exitCode = 1;
  } finally {
    if (db && typeof (db as any).end === 'function') {
      await (db as any).end();
    } else if (db && typeof (db as any).close === 'function') {
      await (db as any).close();
    }
  }
}

main();
