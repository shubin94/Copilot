import { config } from "dotenv";
import { resolve } from "path";
config({ path: resolve(process.cwd(), ".env.local") });
config({ path: resolve(process.cwd(), ".env") });

import { pool } from "./db/index.js";

async function checkPlans() {
  try {
    const result = await pool.query(`
      SELECT id, name, display_name, monthly_price, yearly_price 
      FROM subscription_plans 
      ORDER BY name
    `);
    
    console.log("\n=== SUBSCRIPTION PLANS ===\n");
    for (const plan of result.rows) {
      console.log(`ID: ${plan.id}`);
      console.log(`  Name: ${plan.name}`);
      console.log(`  Display Name: ${plan.display_name}`);
      console.log(`  Monthly: $${plan.monthly_price}`);
      console.log(`  Yearly: $${plan.yearly_price}`);
      console.log(`  ---`);
    }
  } catch (error) {
    console.error("Error:", error);
  } finally {
    process.exit(0);
  }
}

checkPlans();
