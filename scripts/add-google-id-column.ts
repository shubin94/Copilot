import "../server/lib/loadEnv";
import { Pool } from "pg";

async function addGoogleIdColumn() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error("DATABASE_URL environment variable is not set");
    process.exit(1);
  }

  const pool = new Pool({
    connectionString: url,
    // SSL not supported on local dev database
  });

  try {
    const result = await pool.query(`
      ALTER TABLE users ADD COLUMN IF NOT EXISTS google_id TEXT UNIQUE;
    `);
    console.log("✅ Successfully added google_id column to users table");
    process.exit(0);
  } catch (error) {
    console.error("Failed to add google_id column:", error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

addGoogleIdColumn();
