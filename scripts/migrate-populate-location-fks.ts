import "../server/lib/loadEnv.js";
import { pool } from "../db/index.ts";
import { eq, sql } from "drizzle-orm";
import { db } from "../db/index.ts";
import { detectives, states, cities, countries } from "../shared/schema.ts";

/**
 * Migration script to populate missing stateId and cityId foreign keys
 * This enables strict normalization for /api/locations/top endpoint
 * 
 * Run: npm run migrate:populate-location-fks
 * Run with --apply: npm run migrate:populate-location-fks -- --apply
 */

interface MigrationStats {
  totalDetectives: number;
  alreadyHaveStateId: number;
  alreadyHaveCityId: number;
  matchedStates: number;
  matchedCities: number;
  unmatchedStates: Set<string>;
  unmatchedCities: Set<string>;
}

const stats: MigrationStats = {
  totalDetectives: 0,
  alreadyHaveStateId: 0,
  alreadyHaveCityId: 0,
  matchedStates: 0,
  matchedCities: 0,
  unmatchedStates: new Set(),
  unmatchedCities: new Set(),
};

interface CountryMap {
  [key: string]: string; // key: code/name/slug -> value: country id
}

interface StateMap {
  [key: string]: string; // key: countryId-stateName -> value: state id
}

interface CityMap {
  [key: string]: string; // key: stateId-cityName -> value: city id
}

/**
 * Normalize location name for comparison
 */
function normalizeForMatch(name: string): string {
  return name.toLowerCase().trim().replace(/\s+/g, "-");
}

async function buildLocationMaps() {
  console.log("📦 Building in-memory location maps...");

  // Fetch all countries into memory
  const allCountries = await db.select().from(countries);
  const countryMap: CountryMap = {};
  for (const country of allCountries) {
    countryMap[country.code.toUpperCase()] = country.id;
    countryMap[country.name.toLowerCase()] = country.id;
    countryMap[normalizeForMatch(country.slug)] = country.id;
  }

  // Fetch all states into memory
  const allStates = await db.select().from(states);
  const stateMap: StateMap = {};
  for (const state of allStates) {
    const cId = state.countryId;
    stateMap[`${cId}-${state.name.toLowerCase()}`] = state.id;
    stateMap[`${cId}-${normalizeForMatch(state.slug)}`] = state.id;
  }

  // Fetch all cities into memory
  const allCities = await db.select().from(cities);
  const cityMap: CityMap = {};
  for (const city of allCities) {
    const sId = city.stateId;
    cityMap[`${sId}-${city.name.toLowerCase()}`] = city.id;
    cityMap[`${sId}-${normalizeForMatch(city.slug)}`] = city.id;
  }

  console.log(`   ✅ Countries: ${Object.keys(countryMap).length} entries`);
  console.log(`   ✅ States: ${Object.keys(stateMap).length} entries`);
  console.log(`   ✅ Cities: ${Object.keys(cityMap).length} entries\n`);

  return { countryMap, stateMap, cityMap };
}

/**
 * Matching logic: Find FK references for a single detective record
 * Pure business logic - no I/O or side effects
 */
function matchDetectiveLocationFks(
  detective: any,
  countryMap: CountryMap,
  stateMap: StateMap,
  cityMap: CityMap,
  unmatchedStates: Set<string>,
  unmatchedCities: Set<string>
): { stateId: string | null; cityId: string | null; matched: { states: number; cities: number } } {
  const matched = { states: 0, cities: 0 };

  // Find country using in-memory map
  const countryId = countryMap[detective.country.toUpperCase()] ||
    countryMap[detective.country.toLowerCase()] ||
    countryMap[normalizeForMatch(detective.country)];

  if (!countryId) {
    return { stateId: detective.stateId, cityId: detective.cityId, matched };
  }

  let stateId = detective.stateId;
  let cityId = detective.cityId;

  // Match and populate stateId if missing (using in-memory map)
  if (!stateId && detective.state) {
    const stateKey1 = `${countryId}-${detective.state.toLowerCase()}`;
    const stateKey2 = `${countryId}-${normalizeForMatch(detective.state)}`;
    stateId = stateMap[stateKey1] || stateMap[stateKey2];

    if (stateId) {
      matched.states = 1;
    } else {
      unmatchedStates.add(detective.state);
    }
  }

  // Match and populate cityId if missing (using in-memory map)
  if (!cityId && stateId && detective.city) {
    const cityKey1 = `${stateId}-${detective.city.toLowerCase()}`;
    const cityKey2 = `${stateId}-${normalizeForMatch(detective.city)}`;
    cityId = cityMap[cityKey1] || cityMap[cityKey2];

    if (cityId) {
      matched.cities = 1;
    } else {
      unmatchedCities.add(detective.city);
    }
  }

  return { stateId, cityId, matched };
}

/**
 * Analyze detectives and collect updates needed
 * Separates matching logic from I/O orchestration
 */
function analyzeDetectivesForUpdate(
  allDetectives: any[],
  countryMap: CountryMap,
  stateMap: StateMap,
  cityMap: CityMap
): {
  updates: Array<{ id: string; stateId: string | null; cityId: string | null }>;
  stats: MigrationStats;
  withBoth: number;
} {
  const unmatchedStates = new Set<string>();
  const unmatchedCities = new Set<string>();
  const updates: Array<{ id: string; stateId: string | null; cityId: string | null }> = [];

  // Count existing FK coverage upfront
  const withStateId = allDetectives.filter(d => d.stateId).length;
  const withCityId = allDetectives.filter(d => d.cityId).length;
  const withBoth = allDetectives.filter(d => d.stateId && d.cityId).length;

  let matchedStates = 0;
  let matchedCities = 0;

  for (const detective of allDetectives) {
    // Skip if already has both FK references
    if (detective.stateId && detective.cityId) {
      continue;
    }

    const { stateId, cityId, matched } = matchDetectiveLocationFks(
      detective,
      countryMap,
      stateMap,
      cityMap,
      unmatchedStates,
      unmatchedCities
    );

    matchedStates += matched.states;
    matchedCities += matched.cities;

    // Collect updates that change existing values
    if (stateId !== detective.stateId || cityId !== detective.cityId) {
      updates.push({
        id: detective.id,
        stateId: stateId || null,
        cityId: cityId || null,
      });
    }
  }

  const migrationStats: MigrationStats = {
    totalDetectives: allDetectives.length,
    alreadyHaveStateId: withStateId,
    alreadyHaveCityId: withCityId,
    matchedStates,
    matchedCities,
    unmatchedStates,
    unmatchedCities,
  };

  return { updates, stats: migrationStats, withBoth };
}

/**
 * Execute batch updates using parameterized queries
 * Handles all database I/O with transaction safety
 */
async function executeBatchUpdates(
  updates: Array<{ id: string; stateId: string | null; cityId: string | null }>,
  apply: boolean
): Promise<void> {
  if (!apply || updates.length === 0) {
    return;
  }

  console.log(`\n📊 Applying ${updates.length} updates...\n`);

  try {
    // Use transaction for data consistency
    await pool.query('BEGIN');

    // Process updates in safe batches using parameterized queries
    const batchSize = 100;
    for (let i = 0; i < updates.length; i += batchSize) {
      const batch = updates.slice(i, i + batchSize);

      // Build parameterized query for batch
      const placeholders = batch
        .map((_, idx) => {
          const paramIdx = idx * 4;
          return `($${paramIdx + 1}, $${paramIdx + 2}, $${paramIdx + 3}, $${paramIdx + 4})`;
        })
        .join(',');

      const params = batch.flatMap(u => [u.id, u.stateId, u.cityId, u.id]);

      // Single UPDATE query with VALUES clause
      const query = `
        UPDATE detectives AS d SET
          state_id = up.state_id,
          city_id = up.city_id
        FROM (VALUES ${placeholders}) AS up(id, state_id, city_id, match_id)
        WHERE d.id = up.match_id
      `;

      await pool.query(query, params);
    }

    await pool.query('COMMIT');
    console.log(`✅ Batch update completed: ${updates.length} records updated\n`);
  } catch (error) {
    await pool.query('ROLLBACK');
    console.error('Batch update failed:', error);
    process.exitCode = 1;
  }
}

/**
 * Format and display migration report
 * Pure presentation logic - no I/O beyond console
 */
function displayMigrationReport(
  apply: boolean,
  updates: Array<{ id: string; stateId: string | null; cityId: string | null }>,
  stats: MigrationStats,
  withBoth: number
): void {
  // Display dry-run preview if not applying
  if (!apply && updates.length > 0) {
    console.log(`\n📝 Dry-run: Would update ${updates.length} detectives:\n`);
    updates.slice(0, 10).forEach(update => {
      console.log(
        `   Detective ${update.id}: stateId=${update.stateId || 'null'}, cityId=${update.cityId || 'null'}`
      );
    });
    if (updates.length > 10) {
      console.log(`   ... and ${updates.length - 10} more detectives`);
    }
    console.log('\n   Optimization: Will execute as parameterized batch query\n');
  }

  // Print summary
  console.log('\n' + '='.repeat(70));
  console.log('MIGRATION SUMMARY');
  console.log('='.repeat(70));
  console.log(`Total detectives: ${stats.totalDetectives}`);
  console.log(`Already have stateId: ${stats.alreadyHaveStateId}`);
  console.log(`Already have cityId: ${stats.alreadyHaveCityId}`);
  console.log(`Newly matched states: ${stats.matchedStates}`);
  console.log(`Newly matched cities: ${stats.matchedCities}`);
  console.log(`Updates to apply: ${updates.length}`);

  if (stats.unmatchedStates.size > 0) {
    console.log(`\n⚠️  Unmatched states (${stats.unmatchedStates.size}):`);
    stats.unmatchedStates.forEach((state) => console.log(`   - ${state}`));
  }

  if (stats.unmatchedCities.size > 0) {
    console.log(`\n⚠️  Unmatched cities (${stats.unmatchedCities.size}):`);
    stats.unmatchedCities.forEach((city) => console.log(`   - ${city}`));
  }

  // Calculate coverage percentage
  const finalStatesCoverage =
    ((stats.alreadyHaveStateId + stats.matchedStates) / stats.totalDetectives) * 100;
  const finalCitiesCoverage =
    ((stats.alreadyHaveCityId + stats.matchedCities) / stats.totalDetectives) * 100;

  // For complete coverage: count detectives that will have BOTH FKs after migration
  const willHaveBothAfterMigration = updates.filter(u => u.stateId && u.cityId).length;
  const finalCompleteCoverage =
    ((withBoth + willHaveBothAfterMigration) / stats.totalDetectives) * 100;

  console.log(`\n📊 Coverage after migration:`);
  console.log(`   States: ${finalStatesCoverage.toFixed(1)}%`);
  console.log(`   Cities: ${finalCitiesCoverage.toFixed(1)}%`);
  console.log(`   Complete (both FK): ${finalCompleteCoverage.toFixed(1)}%`);

  if (!apply) {
    console.log('\n💡 Dry-run mode: Use --apply to execute the migration');
  }

  console.log('='.repeat(70) + '\n');
}

/**
 * Main migration orchestration - coordinates all steps
 * Separates concerns: data loading → analysis → execution → reporting
 */
async function populateLocationFks(options: { apply: boolean }) {
  const { apply } = options;

  // Load in-memory maps (eliminates N+1 queries)
  const { countryMap, stateMap, cityMap } = await buildLocationMaps();
  console.log("🔍 Analyzing detective location data...\n");

  // Fetch all active detectives once
  const allDetectives = await db
    .select()
    .from(detectives)
    .where(eq(detectives.status, "active"));

  console.log(`Total active detectives: ${allDetectives.length}`);

  // Analyze and collect updates (pure business logic - no I/O)
  const { updates, stats: analysisStats, withBoth } = analyzeDetectivesForUpdate(
    allDetectives,
    countryMap,
    stateMap,
    cityMap
  );

  // Update global stats for reporting
  stats.totalDetectives = analysisStats.totalDetectives;
  stats.alreadyHaveStateId = analysisStats.alreadyHaveStateId;
  stats.alreadyHaveCityId = analysisStats.alreadyHaveCityId;
  stats.matchedStates = analysisStats.matchedStates;
  stats.matchedCities = analysisStats.matchedCities;
  stats.unmatchedStates = analysisStats.unmatchedStates;
  stats.unmatchedCities = analysisStats.unmatchedCities;

  // Execute batch updates if apply flag is set
  await executeBatchUpdates(updates, apply);

  // Display migration report
  displayMigrationReport(apply, updates, analysisStats, withBoth);
}

async function main() {
  const args = process.argv.slice(2);
  const apply = args.includes("--apply");

  if (apply) {
    console.log("⚠️  Running in APPLY mode - changes will be committed to database\n");
  } else {
    console.log("Running in DRY-RUN mode\n");
  }

  await populateLocationFks({ apply });
}

main()
  .catch((error) => {
    console.error("Migration failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });
