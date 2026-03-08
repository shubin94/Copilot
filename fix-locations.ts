/**
 * Quick fix script to populate state_id and city_id for detectives
 */
import * as dotenv from "dotenv";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, ".env.local") });

import { db, pool } from "./db/index.ts";
import { detectives, states, cities } from "./shared/schema.ts";
import { sql } from "drizzle-orm";

async function fixLocations() {
  try {
    console.log("🔍 Checking what we have...\n");

    // 1. Check detectives using raw SQL
    const detectivesList = await db.execute(sql`
      SELECT id, name, state, city, state_id, city_id, status 
      FROM detectives 
      LIMIT 10
    `);

    console.log("📍 Detectives found:");
    detectivesList.rows?.forEach((d: any) => {
      console.log(
        `  - ${d.name}: state="${d.state}" (ID: ${d.state_id}), city="${d.city}" (ID: ${d.city_id}), status: ${d.status}`
      );
    });

    // 2. Check states using raw SQL
    const statesList = await db.execute(sql`
      SELECT id, name FROM states LIMIT 20
    `);

    console.log("\n📍 States available:");
    statesList.rows?.forEach((s: any) => {
      console.log(`  - ${s.name} (ID: ${s.id})`);
    });

    // 3. Check cities using raw SQL
    const citiesList = await db.execute(sql`
      SELECT id, name, state_id FROM cities LIMIT 20
    `);

    console.log("\n📍 Cities available:");
    citiesList.rows?.forEach((c: any) => {
      console.log(`  - ${c.name} (ID: ${c.id}, state_id: ${c.state_id})`);
    });

    // 3. Now do direct SQL updates
    console.log("\n🔧 Running updates...\n");

    // Update state_id
    const stateResult = await db.execute(sql`
      UPDATE detectives d
      SET state_id = s.id
      FROM states s
      WHERE d.state IS NOT NULL 
        AND LOWER(d.state) = LOWER(s.name)
        AND d.state_id IS NULL
        AND d.status = 'active'
    `);
    console.log("✅ Updated state_id for detectives");

    // Update city_id
    const cityResult = await db.execute(sql`
      UPDATE detectives d
      SET city_id = c.id
      FROM cities c
      JOIN states s ON c.state_id = s.id
      WHERE d.city IS NOT NULL 
        AND d.state IS NOT NULL
        AND LOWER(d.city) = LOWER(c.name)
        AND LOWER(d.state) = LOWER(s.name)
        AND d.city_id IS NULL
        AND d.status = 'active'
    `);
    console.log("✅ Updated city_id for detectives");

    // 4. Verify the updates
    console.log("\n✨ Checking results after update...\n");
    const verifyResult = await db.execute(sql`
      SELECT id, name, state, city, state_id, city_id, status 
      FROM detectives 
      WHERE status = 'active'
    `);

    verifyResult.rows?.forEach((d: any) => {
      console.log(
        `  ✓ ${d.name}: state_id=${d.state_id ? "✅" : "❌"}, city_id=${d.city_id ? "✅" : "❌"}`
      );
    });

    console.log("\n✨ Done! State and city IDs should now be populated.\n");

    await pool.end();
  } catch (error) {
    console.error("❌ Error:", error);
    await pool.end();
    process.exit(1);
  }
}

fixLocations();
