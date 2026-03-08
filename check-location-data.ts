/**
 * Quick script to list what's in the location tables
 */
import "../server/lib/loadEnv.js";
import { db } from "../db/index.js";
import { countries, states, cities } from "../shared/schema.js";

async function main() {
  console.log("\n🗺️  Location Data in Database:\n");

  // Get all countries
  const allCountries = await db.select({
    id: countries.id,
    code: countries.code,
    name: countries.name,
    slug: countries.slug,
  }).from(countries);

  console.log(`📍 Countries (${allCountries.length}):`);
  allCountries.forEach(c => {
    console.log(`   ${c.id}: ${c.name} (${c.code})`);
  });

  // Get all states
  const allStates = await db.select({
    id: states.id,
    countryId: states.countryId,
    name: states.name,
    slug: states.slug,
  }).from(states);

  console.log(`\n🏙️  States (${allStates.length}):`);
  allStates.forEach(s => {
    console.log(`   ${s.id}: ${s.name} (countryId: ${s.countryId})`);
  });

  // Get all cities
  const allCities = await db.select({
    id: cities.id,
    stateId: cities.stateId,
    name: cities.name,
    slug: cities.slug,
  }).from(cities);

  console.log(`\n🌆 Cities (${allCities.length}):`);
  allCities.forEach(c => {
    console.log(`   ${c.id}: ${c.name} (stateId: ${c.stateId})`);
  });

  console.log("\n✅ Done\n");
  process.exit(0);
}

main().catch(console.error);
