/**
 * Add missing cities to match detective locations
 */
import * as dotenv from "dotenv";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, ".env.local"), override: true });

import { db, pool } from "./db/index.ts";
import { sql } from "drizzle-orm";

async function addMissingCities() {
  try {
    console.log("\n🏙️ Adding Missing Cities\n");

    // Get state IDs
    const statesResult = await db.execute(sql`
      SELECT id, name FROM states WHERE name IN ('Assam', 'Arizona', 'Kerala', 'Arunachal Pradesh', 'Karnataka')
    `);

    const stateMap: any = {};
    statesResult.rows?.forEach((s: any) => {
      stateMap[s.name] = s.id;
    });

    // Cities to add (map to states)
    const citiesToAdd = [
      { name: 'Barpeta', slug: 'barpeta', state: 'Assam' },
      { name: 'Glendale', slug: 'glendale', state: 'Arizona' },
      { name: 'Bangalore', slug: 'bangalore', state: 'Karnataka' },
      { name: 'Bengaluru', slug: 'bengaluru', state: 'Karnataka' },
      { name: 'Dibang Valley', slug: 'dibang-valley', state: 'Arunachal Pradesh' }
    ];

    console.log("📍 Adding cities...");
    for (const city of citiesToAdd) {
      const stateId = stateMap[city.state];
      if (!stateId) {
        console.log(`  ❌ ${city.name} - State not found: ${city.state}`);
        continue;
      }

      const result = await db.execute(sql`
        INSERT INTO cities (state_id, name, slug, is_active)
        VALUES (${stateId}, ${city.name}, ${city.slug}, true)
        ON CONFLICT DO NOTHING
        RETURNING id
      `);

      if (result.rows && result.rows.length > 0) {
        console.log(`  ✅ ${city.name} (${city.state})`);
      } else {
        console.log(`  ⏭️  ${city.name} (already exists)`);
      }
    }

    // Verify
    const allCities = await db.execute(sql`
      SELECT c.id, c.name, s.name as state_name FROM cities c
      JOIN states s ON c.state_id = s.id
      ORDER BY s.name, c.name
    `);

    console.log("\n📍 All cities now available:");
    allCities.rows?.forEach((c: any) => {
      console.log(`  - ${c.name} (${c.state_name})`);
    });

    console.log("\n✨ Done! Cities are now ready.\n");
    await pool.end();
  } catch (error) {
    console.error("❌ Error:", error);
    await pool.end();
    process.exit(1);
  }
}

addMissingCities();
