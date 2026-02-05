/**
 * Ensures app_secrets table exists. Run once: npm run db:ensure-app-secrets
 */
import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import pkg from "pg";
const { Pool } = pkg;

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error("DATABASE_URL is not set in .env");
    process.exit(1);
  }
  const sqlPath = path.join(process.cwd(), "migrations", "0025_add_app_secrets.sql");
  const sql = await fs.promises.readFile(sqlPath, "utf-8");
  const pool = new Pool({
    connectionString: url,
    ssl: url.includes("supabase") || process.env.NODE_ENV === "production"
      ? { rejectUnauthorized: process.env.NODE_ENV === "production" }
      : undefined,
  });
  try {
    await pool.query(sql);
    console.log("✅ app_secrets table is ready.");
  } catch (e: any) {
    if (e?.code === "42P07") {
      console.log("✅ app_secrets table already exists.");
    } else {
      console.error(e);
      process.exit(1);
    }
  } finally {
    await pool.end();
  }
}

main();
