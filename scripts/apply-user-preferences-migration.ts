import "../server/lib/loadEnv";
import pg from "pg";
import fs from "fs";
import path from "path";

const { Pool } = pg;

async function applyMigration() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === "production" ? { rejectUnauthorized: false } : undefined,
  });

  try {
    console.log("Applying migration: 0014_add_user_country_preferences.sql");
    
    const migrationPath = path.join(process.cwd(), "migrations", "0014_add_user_country_preferences.sql");
    const sql = fs.readFileSync(migrationPath, "utf-8");
    
    await pool.query(sql);
    
    console.log("✓ Migration applied successfully");
    console.log("✓ Added columns: preferred_country, preferred_currency to users table");
  } catch (error) {
    console.error("Migration failed:", error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

applyMigration();
