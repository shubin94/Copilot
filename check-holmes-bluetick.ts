import { db } from "./db/index";
import { detectives } from "./shared/schema";
import { eq, ilike } from "drizzle-orm";

async function checkHolmesBlueTickIssue() {
  console.log("=== Checking Holmes Investigations Blue Tick Issue ===\n");
  
  try {
    // Find the detective
    const detective = await db.query.detectives.findFirst({
      where: ilike(detectives.businessName, '%Holmes Investigations%'),
      with: {
        subscriptionPackage: true,
      }
    });

    if (!detective) {
      console.log("❌ Detective 'Holmes Investigations' not found");
      return;
    }

    console.log("📊 Detective Details:");
    console.log("Business Name:", detective.businessName);
    console.log("ID:", detective.id);
    console.log("\n🎫 Blue Tick Status:");
    console.log("has_blue_tick:", detective.hasBlueTick);
    console.log("blue_tick_activated_at:", detective.blueTickActivatedAt);
    
    console.log("\n📦 Subscription Package:");
    console.log("subscription_package_id:", detective.subscriptionPackageId);
    console.log("subscription_expires_at:", detective.subscriptionExpiresAt);
    
    if (detective.subscriptionPackage) {
      console.log("\n📋 Package Details:");
      console.log("Package Name:", detective.subscriptionPackage.name);
      console.log("Display Name:", detective.subscriptionPackage.displayName);
      console.log("Package Badges:", JSON.stringify(detective.subscriptionPackage.badges, null, 2));
    } else {
      console.log("❌ No subscription package joined (package might not exist)");
    }

    console.log("\n🔍 Analysis:");
    
    if (detective.hasBlueTick) {
      console.log("✅ Detective HAS blue tick stored in database");
      
      if (!detective.subscriptionPackage) {
        console.log("⚠️  WARNING: No subscription package found!");
      } else {
        const packageBadges = detective.subscriptionPackage.badges as any;
        const hasBlueTickInPackage = packageBadges?.blueTick === true || 
                                      (Array.isArray(packageBadges) && packageBadges.includes('blueTick'));
        
        if (hasBlueTickInPackage) {
          console.log("✅ Package INCLUDES blue tick entitlement");
        } else {
          console.log("❌ ISSUE: Package does NOT include blue tick entitlement!");
          console.log("   This is the bug - detective has blue tick but package doesn't grant it");
        }
      }
      
      // Check if subscription expired
      if (detective.subscriptionExpiresAt) {
        const now = new Date();
        const expiresAt = new Date(detective.subscriptionExpiresAt);
        if (expiresAt < now) {
          console.log("⚠️  EXPIRED: Subscription expired on", expiresAt.toISOString());
          console.log("   Blue tick should have been removed on expiry");
        } else {
          console.log("✅ Subscription is still active until", expiresAt.toISOString());
        }
      }
    } else {
      console.log("❌ Detective does NOT have blue tick");
    }

    console.log("\n🔧 Root Cause:");
    console.log("According to BADGE_ENTITLEMENT_AUDIT_REPORT.md:");
    console.log("1. Blue tick is stored in detectives.has_blue_tick");
    console.log("2. When subscription expires, the system sets package to FREE");
    console.log("3. BUT it does NOT clear the has_blue_tick flag");
    console.log("4. So blue tick persists even after downgrade to free plan");

    // Check all detectives with blue tick on free plan
    console.log("\n\n=== All Detectives with Blue Tick on Free Plan ===\n");
    
    const allDetectivesWithBlueTick = await db.query.detectives.findMany({
      where: eq(detectives.hasBlueTick, true),
      with: {
        subscriptionPackage: true,
      }
    });

    const freeplanIssues = allDetectivesWithBlueTick.filter(d => {
      if (!d.subscriptionPackage) return false;
      const packageBadges = d.subscriptionPackage.badges as any;
      const hasBlueTickInPackage = packageBadges?.blueTick === true || 
                                    (Array.isArray(packageBadges) && packageBadges.includes('blueTick'));
      return !hasBlueTickInPackage;
    });

    console.log(`Total detectives with blue tick: ${allDetectivesWithBlueTick.length}`);
    console.log(`Detectives with blue tick BUT package doesn't grant it: ${freeplanIssues.length}`);
    
    if (freeplanIssues.length > 0) {
      console.log("\n❌ Affected Detectives:");
      freeplanIssues.forEach(d => {
        console.log(`  - ${d.businessName} (ID: ${d.id}) - Package: ${d.subscriptionPackage?.name}`);
      });
    }

  } catch (error) {
    console.error("Error:", error);
  }
  
  process.exit(0);
}

checkHolmesBlueTickIssue();
