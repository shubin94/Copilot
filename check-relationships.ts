/**
 * Check if states have correct country_id set
 */
import * as dotenv from "dotenv";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, ".env.local"), override: true });

import { db, pool } from "./db/index.ts";
import { sql } from "drizzle-orm";

async function check() {
  try {
    console.log("\n🔍 Checking state-country relationships\n");

    const result = await db.execute(sql`
      SELECT 
        s.id, 
        s.name,
        s.country_id,
        c.name as country_name,
        COUNT(d.id) as detective_count
      FROM states s
      LEFT JOIN countries c ON s.country_id = c.id
      LEFT JOIN detectives d ON d.state_id = s.id AND d.status = 'active'
      GROUP BY s.id, s.name, s.country_id, c.name
      ORDER BY s.country_id, s.name
    `);

    console.log("States and their countries:");
    result.rows?.forEach((row: any) => {
      console.log(`  - ${row.name} (ID: ${row.id}, country_id: ${row.country_id}, country: ${row.country_name}), detectives: ${row.detective_count}`);
    });

    console.log("\n🔍 Checking detective details\n");

    const detResult = await db.execute(sql`
      SELECT 
        id,
        state,
        state_id,
        city_id,
        country_id,
        status
      FROM detectives
      WHERE status = 'active'
      LIMIT 10
    `);

    console.log("Detectives:");
    detResult.rows?.forEach((row: any) => {
      console.log(`  - State: "${row.state}", state_id: ${row.state_id}, city_id: ${row.city_id}, country_id: ${row.country_id}, status: ${row.status}`);
    });

    await pool.end();
  } catch (error) {
    console.error("Error:", error);
    await pool.end();
  }
}

check();
