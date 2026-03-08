/**
 * Fix: Delete duplicate states and re-link detectives to correct ones
 */
import * as dotenv from "dotenv";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, ".env.local"), override: true });

import { db, pool } from "./db/index.ts";
import { sql } from "drizzle-orm";

async function fixDuplicates() {
  try {
    console.log("\n🔧 Fixing duplicate states\n");

    // Step 1: Create mapping of correct state IDs
    const stateMap = [
      { correct_id: 6, name: 'Assam' },
      { correct_id: 7, name: 'Kerala' },
      { correct_id: 8, name: 'Arunachal Pradesh' },
      { correct_id: 9, name: 'Karnataka' },
      { correct_id: 10, name: 'Arizona' }
    ];

    // Step 2: Update detectives to use correct state IDs
    console.log("📍 Updating detectives to correct state IDs...");
    for (const mapping of stateMap) {
      const result = await db.execute(sql`
        UPDATE detectives
        SET state_id = ${mapping.correct_id}
        WHERE state = ${mapping.name}
          AND status = 'active'
      `);
      console.log(`  ✅ ${mapping.name}: state_id = ${mapping.correct_id}`);
    }

    // Step 3: Delete duplicate states
    console.log("\n🗑️  Deleting duplicate states...");
    const delResult = await db.execute(sql`
      DELETE FROM states WHERE id IN (1, 2, 3, 4, 5)
    `);
    console.log("  ✅ Deleted duplicate states (IDs 1-5)");

    // Step 4: Also need to fix cities - they're probably linked to wrong state IDs too
    console.log("\n📍 Fixing cities...");
    
    // Get correct city-state mappings
    const citiesData = [
      { name: 'Dibang Valley', correct_state_id: 8 }, // Arunachal Pradesh
      { name: 'Barpeta', correct_state_id: 6 }, // Assam
      { name: 'Bengaluru', correct_state_id: 9 }, // Karnataka
      { name: 'Bangalore', correct_state_id: 9 }, // Karnataka
      { name: 'Glendale', correct_state_id: 10 } // Arizona
    ];

    for (const city of citiesData) {
      const result = await db.execute(sql`
        UPDATE cities
        SET state_id = ${city.correct_state_id}
        WHERE name = ${city.name}
      `);
      console.log(`  ✅ ${city.name}: state_id = ${city.correct_state_id}`);
    }

    // Step 5: Re-update detective city_id with corrected mapping
    console.log("\n📍 Re-linking detectives to correct cities...");
    const relink = await db.execute(sql`
      UPDATE detectives d
      SET city_id = c.id
      FROM cities c
      WHERE d.city = c.name
        AND d.state_id = c.state_id
        AND d.status = 'active'
    `);
    console.log("  ✅ City links updated");

    // Step 6: Verify
    console.log("\n✨ Verification:\n");
    const verify = await db.execute(sql`
      SELECT 
        d.state, d.state_id, s.name as state_name,
        d.city, d.city_id, c.name as city_name,
        s.country_id, cn.name as country_name
      FROM detectives d
      LEFT JOIN states s ON d.state_id = s.id
      LEFT JOIN cities c ON d.city_id = c.id
      LEFT JOIN countries cn ON s.country_id = cn.id
      WHERE d.status = 'active'
      ORDER BY d.state
    `);

    verify.rows?.forEach((row: any) => {
      console.log(`${row.state_name || '❌ NOT FOUND'} (ID: ${row.state_id}), Country: ${row.country_name}`);
      console.log(`  → City: ${row.city_name || '❌ NOT FOUND'} (ID: ${row.city_id})\n`);
    });

    console.log("✅ Done!\n");
    await pool.end();
  } catch (error) {
    console.error("Error:", error);
    await pool.end();
    process.exit(1);
  }
}

fixDuplicates();
