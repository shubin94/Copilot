import { config } from "dotenv";
import { resolve } from "path";
config({ path: resolve(process.cwd(), ".env.local") });
config({ path: resolve(process.cwd(), ".env") });

import { pool } from "./db/index.js";

async function listPlans() {
  let exitCode = 0;
  try {
    const result = await pool.query(`
      SELECT id, name, display_name, monthly_price, yearly_price, is_active
      FROM subscription_plans
      ORDER BY monthly_price NULLS LAST, name
    `);
    console.log(JSON.stringify(result.rows, null, 2));
  } catch (error) {
    console.error("Error:", error);
    exitCode = 1;
  } finally {
    await pool.end();
    process.exitCode = exitCode;
  }
}

listPlans();
