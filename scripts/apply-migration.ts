import "../server/lib/loadEnv";
import fs from "node:fs";
import pkg from "pg";
const { Pool } = pkg;

async function main() {
  const url = process.env.DATABASE_URL!;
  const file = process.env.MIGRATION_FILE || "migrations/0000_foamy_cammi.sql";
  const sql = await fs.promises.readFile(file, "utf-8");
  const statements = sql.split("--> statement-breakpoint").map(s => s.trim()).filter(Boolean);
  const pool = new Pool({ connectionString: url, ssl: { rejectUnauthorized: false } });
  const client = await pool.connect();
  try {
    for (const stmt of statements) {
      try {
        await client.query(stmt);
      } catch (e: any) {
        const code = e?.code;
        if (code === "42710" /* duplicate_object, e.g., enum/type exists */ ||
            code === "42P07" /* duplicate_table */ ||
            code === "42701" /* duplicate_column */) {
          console.warn("Skipping duplicate object:", code);
          continue;
        }
        throw e;
      }
    }
    console.log("Applied migration:", file);
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

