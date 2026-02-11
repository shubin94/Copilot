import "./server/lib/loadEnv.ts";
import { pool } from "./db/index.ts";

async function check() {
  try {
    // Check for access_pages table
    const result1 = await pool.query(
      "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'access_pages'"
    );
    const hasAccessPages = result1.rows.length > 0;
    console.log(`${hasAccessPages ? '✅' : '❌'} access_pages table exists:`, hasAccessPages);

    // Check for user_pages table
    const result2 = await pool.query(
      "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'user_pages'"
    );
    const hasUserPages = result2.rows.length > 0;
    console.log(`${hasUserPages ? '✅' : '❌'} user_pages table exists:`, hasUserPages);

    // Check columns in users table
    const result3 = await pool.query(
      "SELECT column_name FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'is_active'"
    );
    const hasIsActiveColumn = result3.rows.length > 0;
    console.log(`${hasIsActiveColumn ? '✅' : '❌'} is_active column on users exists:`, hasIsActiveColumn);

    // Check access_pages data
    if (hasAccessPages) {
      const result4 = await pool.query("SELECT COUNT(*) as count FROM access_pages");
      console.log("✅ access_pages records:", result4.rows[0]?.count || 0);
    } else {
      console.log("⚠️ access_pages table not present. Skipping count.");
    }

    process.exitCode = 0;
  } catch (e: any) {
    console.error("❌ Error:", e.message);
    process.exitCode = 1;
  } finally {
    try {
      await pool.end();
    } catch (closeError) {
      console.error("Error closing database:", closeError);
    }
    process.exit(process.exitCode);
  }
}

check();
