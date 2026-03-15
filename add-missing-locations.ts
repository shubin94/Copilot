/**
 * Add missing states and cities to support detectives
 */
import * as dotenv from "dotenv";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, ".env.local"), override: true });

// Verify we have the right DATABASE_URL
console.log("Database URL:", process.env.DATABASE_URL ? "✅ Loaded" : "❌ Not loaded");

import { db, pool } from "./db/index.ts";
import { sql } from "drizzle-orm";

async function addMissingLocations() {
  try {
    console.log("\n🌍 Adding Missing States and Cities\n");

    // Step 1: Get country IDs
    const countriesResult = await db.execute(sql`
      SELECT id, name, code FROM countries WHERE code IN ('IN', 'US')
    `);
    
    const countries: any = {};
    countriesResult.rows?.forEach((c: any) => {
      countries[c.code] = c.id;
    });

    console.log("📍 Countries found:");
    Object.entries(countries).forEach(([code, id]) => {
      console.log(`  - ${code}: ${id}`);
    });

    // Step 2: Insert missing Indian states
    const indiaId = countries['IN'];
    const indiaStates = [
      { name: 'Assam', slug: 'assam' },
      { name: 'Kerala', slug: 'kerala' },
      { name: 'Arunachal Pradesh', slug: 'arunachal-pradesh' },
      { name: 'Karnataka', slug: 'karnataka' }
    ];

    console.log("\n📍 Adding Indian states...");
    for (const state of indiaStates) {
      const result = await db.execute(sql`
        INSERT INTO states (country_id, name, slug, is_active)
        VALUES (${indiaId}, ${state.name}, ${state.slug}, true)
        ON CONFLICT DO NOTHING
        RETURNING id
      `);
      if (result.rows && result.rows.length > 0) {
        console.log(`  ✅ ${state.name}`);
      }
    }

    // Step 3: Insert missing US states
    const usaId = countries['US'];
    const usStates = [
      { name: 'Arizona', slug: 'arizona' }
    ];

    console.log("\n📍 Adding US states...");
    for (const state of usStates) {
      const result = await db.execute(sql`
        INSERT INTO states (country_id, name, slug, is_active)
        VALUES (${usaId}, ${state.name}, ${state.slug}, true)
        ON CONFLICT DO NOTHING
        RETURNING id
      `);
      if (result.rows && result.rows.length > 0) {
        console.log(`  ✅ ${state.name}`);
      }
    }

    // Step 4: Get all states we now have
    const allStates = await db.execute(sql`
      SELECT id, country_id, name, slug FROM states ORDER BY name
    `);

    console.log("\n📍 All states now available:");
    const stateMap: any = {};
    allStates.rows?.forEach((s: any) => {
      console.log(`  - ${s.name} (${s.slug})`);
      stateMap[s.slug] = s.id;
    });

    console.log("\n✨ Done! States are now ready for detective location updates.\n");

    await pool.end();
  } catch (error) {
    console.error("❌ Error:", error);
    await pool.end();
    process.exit(1);
  }
}

addMissingLocations();
