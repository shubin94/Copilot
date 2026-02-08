#!/usr/bin/env tsx
import "./server/lib/loadEnv.ts";
import { pool } from "./db/index.ts";

async function checkSchema() {
  const client = await pool.connect();
  try {
    // Check if is_active column exists
    const result = await client.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'users' AND column_name = 'is_active'
    `);
    
    if (result.rows.length > 0) {
      console.log("✅ is_active column EXISTS in users table");
      console.log("   Column details:", result.rows[0]);
    } else {
      console.log("❌ is_active column MISSING in users table");
      console.log("   You need to run migration: npx ts-node db/migrate-access-control.ts");
      process.exitCode = 1;
    }
    
    // Try to query a user
    const userResult = await client.query("SELECT id, is_active FROM users LIMIT 1");
    if (userResult.rows.length > 0) {
      console.log("✅ Can query users with is_active field");
      console.log("   Sample user (ID, is_active):", { id: userResult.rows[0].id, is_active: userResult.rows[0].is_active });
    }
  } catch (error) {
    console.error("❌ Error checking schema:", error);
    process.exitCode = 1;
  } finally {
    client.release();
  }
}

(async () => {
  try {
    await checkSchema();
  } catch (error) {
    console.error("Fatal error:", error);
    process.exitCode = 1;
  } finally {
    await pool.end();
    process.exit(process.exitCode);
  }
})();
