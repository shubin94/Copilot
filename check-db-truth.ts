import { config } from "dotenv";
import { resolve } from "path";
config({ path: resolve(process.cwd(), ".env.local") });
config({ path: resolve(process.cwd(), ".env") });

import { pool } from "./db/index.ts";

async function checkDatabaseTruth() {
  try {
    const result = await pool.query(`
      SELECT 
        d.id,
        d.business_name,
        d.subscription_package_id,
        sp.name as package_name,
        sp.display_name as package_display_name
      FROM detectives d
      LEFT JOIN subscription_plans sp ON d.subscription_package_id = sp.id
      WHERE d.status = 'active'
      ORDER BY d.business_name
    `);
    
    console.log("\n=== DATABASE STATE (Source of Truth) ===\n");
    for (const row of result.rows) {
      console.log(`Detective: ${row.business_name}`);
      console.log(`  Package ID: ${row.subscription_package_id || "NULL (should use Free)"}`);
      console.log(`  Package Name: ${row.package_name || "free"}`);
      console.log(`  Display Name: ${row.package_display_name || "Free"}`);
      console.log("");
    }
    
    console.log("✅ This is what MUST be shown in the UI!");
    process.exitCode = 0;
  } catch (error) {
    console.error("Error:", error);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

checkDatabaseTruth();
