// Load environment variables FIRST before any other imports
import { config } from "dotenv";
import { resolve } from "path";
// Try loading .env.local first, fallback to .env
config({ path: resolve(process.cwd(), ".env.local") });
config({ path: resolve(process.cwd(), ".env") });

// Now import db after env is loaded
import { pool } from "./db/index.ts";

async function checkDetectivePackages() {
  try {
    console.log("Checking detective packages...\n");

    // Get all detectives with their package details using raw SQL
    const result = await pool.query(`
      SELECT 
        d.id,
        d.business_name,
        d.city,
        d.state,
        d.status,
        d.is_claimed,
        d.subscription_package_id,
        d.level,
        d.years_experience,
        sp.name as package_name,
        sp.display_name as package_display_name,
        sp.monthly_price,
        sp.yearly_price
      FROM detectives d
      LEFT JOIN subscription_plans sp ON d.subscription_package_id = sp.id
      WHERE d.status = 'active'
      ORDER BY d.business_name
    `);

    const allDetectives = result.rows;

    console.log("Found detectives:", allDetectives.length);
    console.log("\n=== DETECTIVE PACKAGES ===\n");

    for (const detective of allDetectives) {
      console.log(`Detective: ${detective.business_name}`);
      console.log(`  Location: ${detective.city}, ${detective.state}`);
      console.log(`  Status: ${detective.status}`);
      console.log(`  Claimed: ${detective.is_claimed ? "Yes" : "No"}`);
      console.log(`  Level: ${detective.level || "Not set"}`);
      console.log(`  Years of Experience: ${detective.years_experience || "Not set"}`);
      console.log(`  Package ID: ${detective.subscription_package_id || "None"}`);
      console.log(`  Package Name: ${detective.package_name || "None/Free"}`);
      console.log(`  Package Display Name: ${detective.package_display_name || "None/Free"}`);
      console.log(`  Monthly Price: $${detective.monthly_price || 0}`);
      console.log(`  Yearly Price: $${detective.yearly_price || 0}`);
      console.log(`  ---`);
    }

    // Count services for specific detectives
    const test1 = allDetectives.find(d => d.business_name === "Test 1");
    const changappa = allDetectives.find(d => d.business_name === "Changappa A K");

    if (test1) {
      const test1Services = await pool.query(
        `SELECT COUNT(*) as count FROM services WHERE detective_id = $1 AND is_active = true`,
        [test1.id]
      );
      console.log(`\nTest 1 active services: ${test1Services.rows[0].count}`);
    }

    if (changappa) {
      const changappaServices = await pool.query(
        `SELECT COUNT(*) as count FROM services WHERE detective_id = $1 AND is_active = true`,
        [changappa.id]
      );
      console.log(`Changappa A K active services: ${changappaServices.rows[0].count}`);
    }

  } catch (error) {
    console.error("Error checking detective packages:", error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

checkDetectivePackages();
