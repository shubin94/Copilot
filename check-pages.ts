import "./server/lib/loadEnv.ts";
import { pool } from "./db/index.ts";

async function check() {
  try {
    const result = await pool.query("SELECT id, key, name FROM access_pages ORDER BY name");
    console.log("✅ Access pages in database:");
    result.rows.forEach(row => console.log(`  - ${row.key}: ${row.name}`));
    process.exit(0);
  } catch (e: any) {
    console.error("❌ Error:", e.message);
    process.exit(1);
  }
}

check();
