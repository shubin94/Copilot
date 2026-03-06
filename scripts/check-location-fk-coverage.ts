import "../server/lib/loadEnv.js";
import { db } from "../db/index.ts";
import { count, eq, isNull } from "drizzle-orm";
import { detectives } from "../shared/schema.ts";
import { pool } from "../db/index.ts";

/**
 * Check script to verify coverage of stateId and cityId foreign keys
 * Helps determine if location normalization migration is ready to deploy
 * 
 * Run: npm run check:location-fk-coverage
 */

async function checkFkCoverage() {
  console.log("🔍 Checking location FK coverage in detectives table...\n");

  // Get total active detectives
  const totalCountResult = await db
    .select({ count: count() })
    .from(detectives)
    .where(eq(detectives.status, "active"));
  
  const total = totalCountResult[0]?.count || 0;

  // Count detectives with stateId
  const stateIdResult = await db
    .select({ count: count() })
    .from(detectives)
    .where(
      eq(detectives.status, "active"),
      isNull(detectives.stateId) === false
    );
  
  const withStateId = stateIdResult[0]?.count || 0;

  // Count detectives with cityId
  const cityIdResult = await db
    .select({ count: count() })
    .from(detectives)
    .where(
      eq(detectives.status, "active"),
      isNull(detectives.cityId) === false
    );
  
  const withCityId = cityIdResult[0]?.count || 0;

  // Count detectives with both (complete records)
  const completeResult = await db
    .select({ count: count() })
    .from(detectives)
    .where(
      eq(detectives.status, "active"),
      isNull(detectives.stateId) === false,
      isNull(detectives.cityId) === false
    );
  
  const complete = completeResult[0]?.count || 0;

  // Count detectives missing stateId
  const missingStateResult = await db
    .select({ count: count() })
    .from(detectives)
    .where(
      eq(detectives.status, "active"),
      isNull(detectives.stateId) === true
    );
  
  const missingState = missingStateResult[0]?.count || 0;

  // Count detectives missing cityId
  const missingCityResult = await db
    .select({ count: count() })
    .from(detectives)
    .where(
      eq(detectives.status, "active"),
      isNull(detectives.cityId) === true
    );
  
  const missingCity = missingCityResult[0]?.count || 0;

  // Calculate percentages
  const stateIdCoverage = total > 0 ? ((withStateId / total) * 100).toFixed(1) : "0.0";
  const cityIdCoverage = total > 0 ? ((withCityId / total) * 100).toFixed(1) : "0.0";
  const completeCoverage = total > 0 ? ((complete / total) * 100).toFixed(1) : "0.0";

  console.log("=".repeat(70));
  console.log("LOCATION FK COVERAGE REPORT");
  console.log("=".repeat(70));
  console.log(`Total active detectives: ${total}`);
  console.log("");
  console.log("By Foreign Key:");
  console.log(`  ✅ With stateId:    ${withStateId}/${total} (${stateIdCoverage}%)`);
  console.log(`  ❌ Missing stateId: ${missingState}/${total} (${(100 - Number(stateIdCoverage)).toFixed(1)}%)`);
  console.log("");
  console.log(`  ✅ With cityId:     ${withCityId}/${total} (${cityIdCoverage}%)`);
  console.log(`  ❌ Missing cityId:  ${missingCity}/${total} (${(100 - Number(cityIdCoverage)).toFixed(1)}%)`);
  console.log("");
  console.log("Combined Status:");
  console.log(`  ✅ Both FK present: ${complete}/${total} (${completeCoverage}%)`);
  console.log(`  ⚠️  At least one FK missing: ${total - complete}/${total} (${(100 - Number(completeCoverage)).toFixed(1)}%)`);
  console.log("");
  console.log("=".repeat(70));

  // Provide recommendations
  console.log("\n📊 MIGRATION READINESS CHECK\n");

  if (Number(completeCoverage) >= 95) {
    console.log("✅ READY TO DEPLOY");
    console.log("   > 95% of detectives have both stateId and cityId");
    console.log("   > Endpoint can be safely updated to use INNER JOINs");
  } else if (Number(completeCoverage) >= 80) {
    console.log("⚠️  CAUTION - PARTIAL COVERAGE");
    console.log(`   > ${(100 - Number(completeCoverage)).toFixed(1)}% of detectives are missing FK references`);
    console.log("   > Run migration script first: npm run migrate:populate-location-fks -- --apply");
    console.log("   > Re-check coverage after migration");
  } else {
    console.log("❌ NOT READY");
    console.log(`   > ${(100 - Number(completeCoverage)).toFixed(1)}% of detectives missing FK references`);
    console.log("   > Must run FK population migration before endpoint update");
    console.log("   > Run: npm run migrate:populate-location-fks -- --apply");
  }

  console.log("\n" + "=".repeat(70) + "\n");
}

async function main() {
  await checkFkCoverage();
}

main()
  .catch((error) => {
    console.error("Check failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });
