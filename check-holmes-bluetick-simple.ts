import { db } from "./db/index";
import { detectives, subscriptionPlans } from "./shared/schema";
import { eq, ilike, sql } from "drizzle-orm";

async function checkHolmesBlueTickIssue() {
  console.log("=== Checking Holmes Investigations Blue Tick Issue ===\n");
  
  try {
    // Find the detective with raw SQL
    const result = await db.execute(sql`
      SELECT 
        d.id,
        d.business_name,
        d.has_blue_tick,
        d.blue_tick_activated_at,
        d.subscription_package_id,
        d.subscription_expires_at,
        sp.name as package_name,
        sp.display_name as package_display_name,
        sp.badges as package_badges
      FROM detectives d
      LEFT JOIN subscription_plans sp ON d.subscription_package_id = sp.id
      WHERE d.business_name ILIKE '%Holmes Investigations%'
    `);

    if (result.rows.length === 0) {
      console.log("❌ Detective 'Holmes Investigations' not found");
      console.log("\n🔍 Searching for all detectives with 'Holmes'...");
      
      const holmesSearch = await db.execute(sql`
        SELECT business_name FROM detectives WHERE business_name ILIKE '%Holmes%'
      `);
      
      if (holmesSearch.rows.length > 0) {
        console.log("Found:");
        holmesSearch.rows.forEach((r: any) => console.log("  -", r.business_name));
      } else {
        console.log("No detectives with 'Holmes' found");
      }
      return;
    }

    const detective = result.rows[0] as any;

    console.log("📊 Detective Details:");
    console.log("Business Name:", detective.business_name);
    console.log("ID:", detective.id);
    console.log("\n🎫 Blue Tick Status:");
    console.log("has_blue_tick:", detective.has_blue_tick);
    console.log("blue_tick_activated_at:", detective.blue_tick_activated_at);
    
    console.log("\n📦 Subscription Package:");
    console.log("subscription_package_id:", detective.subscription_package_id);
    console.log("subscription_expires_at:", detective.subscription_expires_at);
    console.log("package_name:", detective.package_name);
    console.log("package_display_name:", detective.package_display_name);
    console.log("package_badges:", JSON.stringify(detective.package_badges, null, 2));

    console.log("\n🔍 Analysis:");
    
    if (detective.has_blue_tick) {
      console.log("✅ Detective HAS blue tick stored in database");
      
      if (!detective.package_name) {
        console.log("⚠️  WARNING: No subscription package found in database!");
      } else {
        const packageBadges = detective.package_badges;
        const hasBlueTickInPackage = packageBadges?.blueTick === true || 
                                      (Array.isArray(packageBadges) && packageBadges.includes('blueTick'));
        
        if (hasBlueTickInPackage) {
          console.log("✅ Package INCLUDES blue tick entitlement");
        } else {
          console.log("❌ 🚨 ISSUE FOUND: Package does NOT include blue tick entitlement!");
          console.log("   Detective has blue tick but their current package doesn't grant it");
          console.log("   This is why free plan users show blue tick");
        }
      }
      
      // Check if subscription expired
      if (detective.subscription_expires_at) {
        const now = new Date();
        const expiresAt = new Date(detective.subscription_expires_at);
        if (expiresAt < now) {
          console.log("⚠️  EXPIRED: Subscription expired on", expiresAt.toISOString());
          console.log("   Blue tick should have been removed on expiry but wasn't");
        } else {
          console.log("✅ Subscription is still active until", expiresAt.toISOString());
        }
      }
    } else {
      console.log("❌ Detective does NOT have blue tick");
    }

    // Check all detectives with blue tick on free plan or mismatched badges
    console.log("\n\n=== All Detectives with Blue Tick Issues ===\n");
    
    const allIssues = await db.execute(sql`
      SELECT 
        d.id,
        d.business_name,
        d.has_blue_tick,
        sp.name as package_name,
        sp.display_name as package_display_name,
        sp.badges as package_badges
      FROM detectives d
      LEFT JOIN subscription_plans sp ON d.subscription_package_id = sp.id
      WHERE d.has_blue_tick = true
    `);

    console.log(`Total detectives with blue tick: ${allIssues.rows.length}`);
    
    const problematic = allIssues.rows.filter((d: any) => {
      if (!d.package_badges) return true;
      const hasBlueTickInPackage = d.package_badges?.blueTick === true || 
                                    (Array.isArray(d.package_badges) && d.package_badges.includes('blueTick'));
      return !hasBlueTickInPackage;
    });

    console.log(`Detectives with blue tick BUT package doesn't grant it: ${problematic.length}`);
    
    if (problematic.length > 0) {
      console.log("\n❌ Affected Detectives:");
      problematic.forEach((d: any) => {
        console.log(`  - ${d.business_name} (ID: ${d.id})`);
        console.log(`    Package: ${d.package_name || 'NULL'} (${d.package_display_name || 'NULL'})`);
        console.log(`    Badges: ${JSON.stringify(d.package_badges)}`);
      });
    }

    console.log("\n\n🔧 ROOT CAUSE:");
    console.log("━".repeat(60));
    console.log("When a subscription expires:");
    console.log("1. ✅ System DOES set package to FREE plan");
    console.log("2. ❌ System DOES NOT clear has_blue_tick flag");
    console.log("3. ❌ UI shows blue tick if has_blue_tick=true (regardless of package)");
    console.log("4. Result: Users on FREE plan show blue tick they shouldn't have");
    console.log("\nFIX: When downgrading to FREE plan, also clear has_blue_tick flag");

  } catch (error) {
    console.error("Error:", error);
  }
  
  process.exit(0);
}

checkHolmesBlueTickIssue();
