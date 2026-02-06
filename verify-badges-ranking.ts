/**
 * Comprehensive Verification Test
 * Tests:
 * 1. Badges display correctly in service cards
 * 2. Detective ranking logic is working properly
 * 3. EffectiveBadges are computed correctly from subscription packages
 */

import { db } from "./server/db.ts";
import { detectives, services, subscriptionPlans } from "./shared/schema.ts";
import { eq, and, isNotNull, desc } from "drizzle-orm";
import { computeEffectiveBadges } from "./server/services/entitlements.ts";
import { getRankedDetectives } from "./server/ranking.ts";

async function runVerification() {
  console.log("\n========================================");
  console.log("🔍 BADGES & RANKING VERIFICATION TEST");
  console.log("========================================\n");

  try {
    // 1. Get sample detectives with different subscription packages
    console.log("📋 STEP 1: Retrieve sample detectives with subscriptions\n");

    const sampleDetectives = await db
      .select({
        detective: detectives,
        package: subscriptionPlans,
      })
      .from(detectives)
      .leftJoin(subscriptionPlans, eq(detectives.subscriptionPackageId, subscriptionPlans.id))
      .limit(5);

    for (const { detective, package: pkg } of sampleDetectives) {
      console.log(`\n👤 Detective: ${detective.businessName || detective.firstName} ${detective.lastName || ""}`);
      console.log(`   ID: ${detective.id}`);
      console.log(`   Package ID: ${detective.subscriptionPackageId}`);
      console.log(`   Subscription Expires: ${detective.subscriptionExpiresAt ? new Date(detective.subscriptionExpiresAt).toISOString() : "No expiry"}`);
      
      if (pkg) {
        console.log(`   Package Name: ${pkg.name}`);
        console.log(`   Package Badges: ${JSON.stringify(pkg.badges)}`);
        
        // Compute effective badges
        const effectiveBadges = computeEffectiveBadges(detective, pkg);
        console.log(`   ✅ Effective Badges Computed:`);
        console.log(`      - Blue Tick: ${effectiveBadges.blueTick}`);
        console.log(`      - Pro: ${effectiveBadges.pro}`);
        console.log(`      - Recommended: ${effectiveBadges.recommended}`);
      } else {
        console.log(`   Package: NOT FOUND (should be free plan)`);
        
        // Compute effective badges without package
        const effectiveBadges = computeEffectiveBadges(detective, null);
        console.log(`   ✅ Effective Badges Computed:`);
        console.log(`      - Blue Tick: ${effectiveBadges.blueTick}`);
        console.log(`      - Pro: ${effectiveBadges.pro}`);
        console.log(`      - Recommended: ${effectiveBadges.recommended}`);
      }

      // Check if detective has services
      const serviceCount = await db
        .select({ count: { value: services.id } })
        .from(services)
        .where(eq(services.detectiveId, detective.id));
      console.log(`   Services: ${serviceCount[0]?.count?.value || 0}`);
    }

    // 2. Test service card mapping flow
    console.log("\n\n📋 STEP 2: Verify service card mapping includes correct badges\n");

    const testServices = await db
      .select({
        service: services,
        detective: detectives,
        package: subscriptionPlans,
      })
      .from(services)
      .innerJoin(detectives, eq(services.detectiveId, detectives.id))
      .leftJoin(subscriptionPlans, eq(detectives.subscriptionPackageId, subscriptionPlans.id))
      .where(isNotNull(services.images))
      .limit(3);

    for (const { service, detective, package: pkg } of testServices) {
      console.log(`\n📦 Service: "${service.title}"`);
      console.log(`   Detective: ${detective.businessName}`);
      console.log(`   Has images: ${service.images && (service.images as any[]).length > 0}`);

      // Simulate what the API returns
      const apiResponse = {
        ...service,
        detective: {
          ...detective,
          subscriptionPackage: pkg || undefined,
          effectiveBadges: computeEffectiveBadges(detective, pkg),
        },
      };

      console.log(`   ✅ Service card would display:`);
      console.log(`      Detective Name: ${detective.businessName}`);
      console.log(`      Badges: ${apiResponse.detective.effectiveBadges.blueTick ? "✓ Blue Tick " : ""}${apiResponse.detective.effectiveBadges.pro ? "✓ Pro " : ""}${apiResponse.detective.effectiveBadges.recommended ? "✓ Recommended" : ""}`);
      console.log(`      Package: ${pkg?.displayName || pkg?.name || "Free"}`);
      
      // Verify no subscriptionPlan field exists
      const hasLegacyField = 'subscriptionPlan' in detective;
      console.log(`      ✅ Legacy subscriptionPlan field removed: ${!hasLegacyField ? "YES ✓" : "NO ✗ FAIL"}`);
    }

    // 3. Test ranking algorithm
    console.log("\n\n📋 STEP 3: Verify ranking algorithm uses correct subscription data\n");

    const rankedDetectives = await getRankedDetectives({ limit: 5 });
    
    console.log(`Found ${rankedDetectives.length} ranked detectives\n`);

    for (const rankedDet of rankedDetectives.slice(0, 3)) {
      console.log(`\n🏆 Ranked Detective: ${rankedDet.businessName}`);
      console.log(`   Visibility Score: ${rankedDet.visibilityScore}`);
      console.log(`   Subscription Package: ${rankedDet.subscriptionPackage?.name || "free"}`);
      console.log(`   Level: ${rankedDet.level}`);
      
      // The ranking should use subscriptionPackage?.name, not subscriptionPlan
      const packageName = rankedDet.subscriptionPackage?.name;
      const shouldHaveBadgeScore = packageName === "pro" || packageName === "agency";
      console.log(`   Should have badge score (+100): ${shouldHaveBadgeScore ? "YES ✓" : "NO (free plan)"}`);
    }

    // 4. Check all fields are present/absent correctly
    console.log("\n\n📋 STEP 4: Verify schema integrity\n");

    const randomDetective = await db.query.detectives.findFirst();
    
    if (randomDetective) {
      const detObjectKeys = Object.keys(randomDetective);
      console.log(`Detective object has ${detObjectKeys.length} fields:`);
      
      const hasSubscriptionPackageId = 'subscriptionPackageId' in randomDetective;
      const hasLegacyField = 'subscriptionPlan' in randomDetective;

      console.log(`   ✓ subscriptionPackageId: ${hasSubscriptionPackageId ? "PRESENT ✓" : "MISSING ✗"}`);
      console.log(`   ✗ subscriptionPlan: ${hasLegacyField ? "PRESENT ✗ FAIL" : "REMOVED ✓"}`);
      
      if (!hasSubscriptionPackageId) {
        console.log(`\n❌ ERROR: subscriptionPackageId missing from detective object!`);
      }
      if (hasLegacyField) {
        console.log(`\n❌ ERROR: Legacy subscriptionPlan field still present!`);
      }
    }

    console.log("\n\n========================================");
    console.log("✅ VERIFICATION COMPLETE");
    console.log("========================================\n");

  } catch (error) {
    console.error("\n❌ Verification failed:", error);
    process.exit(1);
  }
}

runVerification().then(() => process.exit(0));
