/**
 * Directly update detectives with state_id and city_id using simple SQL
 */
import * as dotenv from "dotenv";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, ".env.local"), override: true });

import { db, pool } from "./db/index.ts";
import { sql } from "drizzle-orm";

async function updateDetectives() {
  try {
    console.log("\n🔄 Updating detectives with location foreign keys\n");

    // Update state_id
    const stateUpdate = await db.execute(sql`
      UPDATE detectives d
      SET state_id = s.id
      FROM states s
      WHERE d.state = s.name
        AND d.state_id IS NULL
        AND d.status = 'active'
    `);
    console.log("✅ Updated state_id");

    // Update city_id
    const cityUpdate = await db.execute(sql`
      UPDATE detectives d
      SET city_id = c.id
      FROM cities c
      JOIN states s ON c.state_id = s.id
      WHERE d.city = c.name
        AND d.state = s.name
        AND d.city_id IS NULL
        AND d.status = 'active'
    `);
    console.log("✅ Updated city_id");

    // Verify the updates
    const result = await db.execute(sql`
      SELECT 
        id,
        state,
        city,
        state_id,
        city_id
      FROM detectives
      WHERE status = 'active'
      LIMIT 5
    `);

    console.log("\n📍 Detective locations after update:\n");
    result.rows?.forEach((d: any) => {
      const stateStatus = d.state_id ? "✅" : "❌";
      const cityStatus = d.city_id ? "✅" : "❌";
      console.log(`${stateStatus} State: ${d.state} (ID: ${d.state_id})`);
      console.log(`${cityStatus} City: ${d.city} (ID: ${d.city_id})\n`);
    });

    console.log("✨ Done! Testing API now...\n");

    await pool.end();
  } catch (error) {
    console.error("❌ Error:", error);
    await pool.end();
    process.exit(1);
  }
}

updateDetectives();
