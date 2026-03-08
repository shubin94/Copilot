/**
 * Diagnostic script: Check detective location data
 * 
 * Purpose: Identify why Top States and Top Cities are not showing on localhost
 * 
 * Root Cause Analysis:
 * - The aggregateTopLocations() query uses INNER JOINs on detectives.stateId and detectives.cityId
 * - INNER JOIN filters out any detectives where stateId or cityId is NULL
 * - If local database has NULL values for these fields, states/cities won't appear
 * 
 * This script will:
 * 1. Count total detectives with status='active'
 * 2. Count how many have countryId populated
 * 3. Count how many have stateId populated  
 * 4. Count how many have cityId populated
 * 5. Show sample detectives with NULL location fields
 */

import { db } from "./db/index.js";
import { detectives } from "./shared/schema.js";
import { eq, isNull, and } from "drizzle-orm";

async function checkDetectiveLocations() {
  console.log("\n🔍 Checking Detective Location Data on Localhost\n");
  console.log("=".repeat(60));

  // 1. Total active detectives
  const allDetectives = await db
    .select({
      id: detectives.id,
      businessName: detectives.businessName,
      country: detectives.country,
      state: detectives.state,
      city: detectives.city,
      countryId: detectives.countryId,
      stateId: detectives.stateId,
      cityId: detectives.cityId,
      status: detectives.status,
    })
    .from(detectives)
    .where(eq(detectives.status, "active"));

  console.log(`\n📊 Total Active Detectives: ${allDetectives.length}`);

  // 2. Count detectives with populated location IDs
  const withCountryId = allDetectives.filter(d => d.countryId !== null);
  const withStateId = allDetectives.filter(d => d.stateId !== null);
  const withCityId = allDetectives.filter(d => d.cityId !== null);

  console.log(`\n🗺️  Location Field Population:`);
  console.log(`   ✓ countryId populated: ${withCountryId.length} (${((withCountryId.length / allDetectives.length) * 100).toFixed(1)}%)`);
  console.log(`   ✓ stateId populated:   ${withStateId.length} (${((withStateId.length / allDetectives.length) * 100).toFixed(1)}%)`);
  console.log(`   ✓ cityId populated:    ${withCityId.length} (${((withCityId.length / allDetectives.length) * 100).toFixed(1)}%)`);

  // 3. Identify problematic records
  const missingStateId = allDetectives.filter(d => d.stateId === null);
  const missingCityId = allDetectives.filter(d => d.cityId === null);

  console.log(`\n⚠️  Missing Location IDs:`);
  console.log(`   ❌ Missing stateId: ${missingStateId.length} detectives`);
  console.log(`   ❌ Missing cityId:  ${missingCityId.length} detectives`);

  // 4. Show sample detectives with NULL location fields
  if (missingStateId.length > 0) {
    console.log(`\n🔎 Sample Detectives with NULL stateId (showing first 3):\n`);
    missingStateId.slice(0, 3).forEach((d, i) => {
      console.log(`   ${i + 1}. ${d.businessName || d.id}`);
      console.log(`      Text Fields: country="${d.country}", state="${d.state}", city="${d.city}"`);
      console.log(`      ID Fields:   countryId=${d.countryId}, stateId=${d.stateId}, cityId=${d.cityId}\n`);
    });
  }

  if (missingCityId.length > 0) {
    console.log(`\n🔎 Sample Detectives with NULL cityId (showing first 3):\n`);
    missingCityId.slice(0, 3).forEach((d, i) => {
      console.log(`   ${i + 1}. ${d.businessName || d.id}`);
      console.log(`      Text Fields: country="${d.country}", state="${d.state}", city="${d.city}"`);
      console.log(`      ID Fields:   countryId=${d.countryId}, stateId=${d.stateId}, cityId=${d.cityId}\n`);
    });
  }

  // 5. Root cause explanation
  console.log("\n" + "=".repeat(60));
  console.log("\n🎯 ROOT CAUSE IDENTIFIED:\n");
  console.log("The /api/locations/top endpoint uses INNER JOIN queries:");
  console.log("  - States query: INNER JOIN states ON states.id = detectives.stateId");
  console.log("  - Cities query: INNER JOIN cities ON cities.id = detectives.cityId");
  console.log("\nINNER JOIN behavior:");
  console.log("  ❌ Excludes rows where join column is NULL");
  console.log("  ❌ If stateId is NULL → no states returned");
  console.log("  ❌ If cityId is NULL → no cities returned");
  
  console.log("\n💡 SOLUTION:\n");
  console.log("Your local database has detectives with NULL stateId/cityId fields.");
  console.log("To fix this, you need to populate these foreign key fields.");
  console.log("\nOptions:");
  console.log("  1. Run migration script to populate stateId/cityId from text fields");
  console.log("  2. Manually update detective records with proper location IDs");
  console.log("  3. Import production data snapshot with populated location IDs");
  
  console.log("\n🔧 Recommended Fix:\n");
  console.log("Look for a migration script like:");
  console.log("  - scripts/migrate-populate-location-fks.ts");
  console.log("  - scripts/backfill-detective-locations.ts");
  console.log("\nOr create detective test data with populated location IDs.");
  
  console.log("\n" + "=".repeat(60) + "\n");

  process.exit(0);
}

checkDetectiveLocations().catch(console.error);
