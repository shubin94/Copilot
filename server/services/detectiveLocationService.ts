// server/services/detectiveLocationService.ts


import { db } from '../../db/index.js';
import { countries, states, cities } from '../../shared/schema.js';
import { eq, and } from 'drizzle-orm';

/**
 * Canonical detective location query using text columns and slug-to-name conversion.
 */
async function getDetectivesByLocation(countrySlug, stateSlug, citySlug) {
  if (!countrySlug) return [];

  // --- STEP 1: Resolve Country ---
  const countryRow = await db.query.countries.findFirst({
    where: eq(countries.slug, countrySlug)
  });
  if (!countryRow) {
    console.log("Country slug not found:", countrySlug);
    return [];
  }
  const countryName = countryRow.name;
  const countryCode = countryRow.code;

  // --- STEP 2: Resolve State ---
  let stateName = null;
  let stateId = null;
  if (stateSlug) {
    const stateRow = await db.query.states.findFirst({
      where: and(
        eq(states.slug, stateSlug),
        eq(states.countryId, countryRow.id)
      )
    });
    if (!stateRow) {
      console.log("State slug not found:", stateSlug, "for country:", countrySlug);
      return [];
    }
    stateName = stateRow.name;
    stateId = stateRow.id;
  }

  // --- STEP 3: Resolve City ---
  let cityName = null;
  if (citySlug && stateId) {
    const cityRow = await db.query.cities.findFirst({
      where: and(
        eq(cities.slug, citySlug),
        eq(cities.stateId, stateId)
      )
    });
    if (!cityRow) {
      console.log("City slug not found:", citySlug, "for state:", stateSlug);
      return [];
    }
    cityName = cityRow.name;
  }

  // --- STEP 4: Query Detectives ---
  const conditions = [eq(db.schema.detectives.country, countryCode)];
  if (stateName) {
    conditions.push(eq(db.schema.detectives.state, stateName));
  }
  if (cityName) {
    conditions.push(eq(db.schema.detectives.city, cityName));
  }
  console.log("Resolved location:", { countryCode, stateName, cityName });
  console.log("Detective filter conditions:", conditions);
  const detectives = await db.query.detectives.findMany({
    where: and(...conditions)
  });
  console.log("Detectives returned:", detectives.length);
  return detectives;
}

export { getDetectivesByLocation };
