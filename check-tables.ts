import "./server/lib/loadEnv.ts";
import { pool } from "./db/index.ts";

async function check() {
  try {
    // Check for access_pages table
    const result1 = await pool.query(
      "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'access_pages'"
    );
    console.log("✅ access_pages table exists:", result1.rows.length > 0);

    // Check for user_pages table
    const result2 = await pool.query(
      "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'user_pages'"
    );
    console.log("✅ user_pages table exists:", result2.rows.length > 0);

    // Check columns in users table
    const result3 = await pool.query(
      "SELECT column_name FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'is_active'"
    );
    console.log("✅ is_active column on users exists:", result3.rows.length > 0);

    // Check access_pages data
    const result4 = await pool.query("SELECT COUNT(*) as count FROM access_pages");
    console.log("✅ access_pages records:", result4.rows[0]?.count || 0);

    process.exit(0);
  } catch (e: any) {
    console.error("❌ Error:", e.message);
    process.exit(1);
  }
}

check();
