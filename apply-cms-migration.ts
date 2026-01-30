import "dotenv/config";
import fs from "fs";
import pkg from "pg";
const { Pool } = pkg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === "production"
    ? { rejectUnauthorized: true }
    : (process.env.DB_ALLOW_INSECURE_DEV === "true" ? { rejectUnauthorized: false } : undefined)
});

async function applyMigration() {
  const client = await pool.connect();
  try {
    console.log("\n📋 APPLYING CMS MIGRATION...\n");
    
    // Read migration file
    const migrationPath = "supabase/migrations/20260130_add_cms_tables.sql";
    const sql = fs.readFileSync(migrationPath, "utf-8");
    
    // Split by statement-breakpoint marker or use simple approach
    // Handle dollar-quoted strings properly by running entire file
    console.log("Executing migration file...\n");
    
    try {
      await client.query(sql);
      console.log("✅ MIGRATION APPLIED SUCCESSFULLY!\n");
    } catch (error: any) {
      console.error(`❌ FAILED`);
      console.error(`Error: ${error.message}\n`);
      throw error;
    }
    
  } catch (error) {
    console.error("❌ MIGRATION FAILED");
    throw error;
  } finally {
    await client.end();
  }
}

applyMigration().catch((error) => {
  console.error("Fatal error:", error.message);
  process.exit(1);
});
