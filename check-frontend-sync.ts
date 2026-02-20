/**
 * Check if frontend API is returning correct blue tick data
 */

import { db } from "./db/index.ts";
import { detectives, subscriptionPlans } from "./db/schema.ts";
import { eq } from "drizzle-orm";

async function checkFrontendSync() {
  console.log("Checking what API would return for detectives...\n");

  // Get detectives with their subscription packages (like the API should)
  const results = await db
    .select({
      detectiveId: detectives.id,
      businessName: detectives.businessName,
      hasBlueTick: detectives.hasBlueTick,
      blueTickAddon: detectives.blueTickAddon,
      subscriptionPackageId: detectives.subscriptionPackageId,
      subscriptionExpiresAt: detectives.subscriptionExpiresAt,
      packageName: subscriptionPlans.name,
      packageBadges: subscriptionPlans.badges,
    })
    .from(detectives)
    .leftJoin(subscriptionPlans, eq(detectives.subscriptionPackageId, subscriptionPlans.id))
    .where(eq(detectives.isActive, true))
    .limit(10);

  console.log("Sample of 10 active detectives:\n");
  
  for (const det of results) {
    const packageBadges = det.packageBadges as any;
    const blueTickFromPackage = packageBadges?.blueTick === true;
    const blueTickFromAddon = det.blueTickAddon === true;
    const effectiveBlueTick = blueTickFromAddon || blueTickFromPackage;

    console.log(`${det.businessName}:`);
    console.log(`  Database has_blue_tick: ${det.hasBlueTick}`);
    console.log(`  Database blue_tick_addon: ${det.blueTickAddon}`);
    console.log(`  Package: ${det.packageName}`);
    console.log(`  Package blueTick badge: ${blueTickFromPackage}`);
    console.log(`  -> Effective blue tick (what frontend SHOULD show): ${effectiveBlueTick}`);
    console.log("");
  }

  // Get summary stats
  const summary = await db
    .select({
      packageName: subscriptionPlans.name,
      packageBlueTick: subscriptionPlans.badges,
      totalDetectives: db.selectCountDistractors(),
    })
    .from(detectives)
    .leftJoin(subscriptionPlans, eq(detectives.subscriptionPackageId, subscriptionPlans.id))
    .where(eq(detectives.isActive, true))
    .groupBy(subscriptionPlans.name, subscriptionPlans.badges);

  console.log("\n=== SUMMARY BY PACKAGE ===\n");
  for (const s of summary as any[]) {
    const badges = s.packageBlueTick as any;
    console.log(`Package: ${s.packageName || 'NO PACKAGE'}`);
    console.log(`  Blue tick in package: ${badges?.blueTick === true}`);
    console.log(`  Total detectives: ${s.totalDetectives || 'N/A'}`);
    console.log("");
  }
}

checkFrontendSync()
  .then(() => {
    console.log("✅ Check complete");
    process.exit(0);
  })
  .catch((error) => {
    console.error("Error:", error);
    process.exit(1);
  });
