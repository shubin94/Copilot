/**
 * Seed countries, states, and cities from the 'country-state-city' library
 * Run with: DATABASE_URL="..." npx tsx seed-locations.ts
 */

import pkg from "pg";
const { Pool } = pkg;
import { Country, State, City } from "country-state-city";

async function seedLocations() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
  });

  try {
    console.log("🌍 Seeding countries, states, and cities...\n");

    // Helper to generate slug
    const generateSlug = (text: string): string => {
      if (!text) return "unknown";
      return text
        .toLowerCase()
        .trim()
        .replace(/[^\w\s-]/g, "")
        .replace(/\s+/g, "-")
        .replace(/-+/g, "-")
        .replace(/^-+|-+$/g, "");
    };

    // Get all countries from library
    const allCountries = Country.getAllCountries();
    console.log(`Found ${allCountries.length} countries`);

    // Seed countries
    console.log("📍 Seeding countries...");
    const countryMap = new Map<string, string>(); // name -> id

    for (const country of allCountries) {
      const countryId = `c-${generateSlug(country.name)}`;
      const slug = generateSlug(country.name);

      try {
        await pool.query(
          `INSERT INTO countries (id, code, name, slug, created_at, updated_at)
           VALUES ($1, $2, $3, $4, NOW(), NOW())
           ON CONFLICT (code) DO UPDATE SET slug = $4`,
          [countryId, country.isoCode, country.name, slug]
        );
        countryMap.set(country.isoCode, countryId);
        console.log(`  ✓ ${country.name}`);
      } catch (error) {
        console.error(`  ✗ Failed to seed ${country.name}:`, error);
      }
    }

    // Seed states
    console.log("\n📍 Seeding states...");
    const stateMap = new Map<string, string>(); // countryCode:stateName -> id

    for (const country of allCountries) {
      const countryId = countryMap.get(country.isoCode);
      if (!countryId) continue;

      const countryStates = State.getStatesOfCountry(country.isoCode);

      for (const state of countryStates) {
        const stateId = `s-${generateSlug(country.name)}-${generateSlug(state.name)}`;
        const slug = generateSlug(state.name);

        try {
          await pool.query(
            `INSERT INTO states (id, country_id, name, slug, created_at, updated_at)
             VALUES ($1, $2, $3, $4, NOW(), NOW())
             ON CONFLICT (country_id, name) DO UPDATE SET slug = $4`,
            [stateId, countryId, state.name, slug]
          );
          stateMap.set(`${country.isoCode}:${state.name}`, stateId);
        } catch (error) {
          // Silently skip duplicates
        }
      }

      console.log(`  ✓ ${country.name}: ${countryStates.length} states`);
    }

    // Seed cities
    console.log("\n📍 Seeding cities...");
    let cityCount = 0;
    let cityErrors = 0;

    for (const country of allCountries) {
      const countryStates = State.getStatesOfCountry(country.isoCode);

      for (const state of countryStates) {
        const stateId = stateMap.get(`${country.isoCode}:${state.name}`);
        if (!stateId) continue;

        const stateCities = City.getCitiesOfState(country.isoCode, state.isoCode);

        for (const city of stateCities) {
          const cityId = `c-${generateSlug(country.name)}-${generateSlug(state.name)}-${generateSlug(city.name)}`;
          const slug = generateSlug(city.name);

          try {
            await pool.query(
              `INSERT INTO cities (id, state_id, name, slug, created_at, updated_at)
               VALUES ($1, $2, $3, $4, NOW(), NOW())
               ON CONFLICT (state_id, name) DO UPDATE SET slug = $4`,
              [cityId, stateId, city.name, slug]
            );
            cityCount++;
          } catch (error) {
            cityErrors++;
          }
        }
      }
    }

    console.log(`  ✓ Seeded ${cityCount} cities (${cityErrors} skipped duplicates)`);

    // Verify
    console.log("\n✅ Verification:");
    const countryResult = await pool.query("SELECT COUNT(*) as count FROM countries");
    const stateResult = await pool.query("SELECT COUNT(*) as count FROM states");
    const cityResult = await pool.query("SELECT COUNT(*) as count FROM cities");

    console.log(`   Countries: ${countryResult.rows[0].count}`);
    console.log(`   States: ${stateResult.rows[0].count}`);
    console.log(`   Cities: ${cityResult.rows[0].count}`);

    console.log("\n✅ Seeding complete!");
  } catch (error) {
    console.error("❌ Error seeding locations:", error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

seedLocations();
