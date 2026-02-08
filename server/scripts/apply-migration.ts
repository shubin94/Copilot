import { readFileSync } from "fs";
import { resolve } from "path";
import * as dotenv from "dotenv";

// Load environment variables first
const envPath = resolve(".env.local");
dotenv.config({ path: envPath });

// Now import pool after env is loaded
const { pool } = await import("../../db/index.ts");

async function runMigration() {
  try {
    console.log("Reading migration file...");
    const migrationPath = resolve("./supabase/migrations/20260206102801_add_category_tag_parents.sql");
    const sql = readFileSync(migrationPath, "utf-8");
    
    console.log("Executing migration...");
    console.log(sql.substring(0, 200) + "...");
    
    await pool.query(sql);
    console.log("✅ Migration applied successfully!");
    process.exit(0);
  } catch (error) {
    console.error("❌ Migration failed:", error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

runMigration();
