import { db } from "./db/index";
import { sql } from "drizzle-orm";

async function checkBlueTickAddon() {
  console.log("=== Checking blue_tick_addon Field ===\n");
  
  try {
    // Check all detectives with any blue tick field set
    const result = await db.execute(sql`
      SELECT 
        d.id,
        d.business_name,
        d.has_blue_tick,
        d.blue_tick_addon,
        d.subscription_package_id,
        sp.name as package_name,
        sp.badges as package_badges
      FROM detectives d
      LEFT JOIN subscription_plans sp ON d.subscription_package_id = sp.id
      WHERE d.has_blue_tick = true OR d.blue_tick_addon = true
      ORDER BY d.business_name
    `);

    console.log(`Found ${result.rows.length} detectives with blue tick flags\n`);
    
    result.rows.forEach((d: any) => {
      console.log("─".repeat(60));
      console.log(`Detective: ${d.business_name}`);
      console.log(`  has_blue_tick: ${d.has_blue_tick}`);
      console.log(`  blue_tick_addon: ${d.blue_tick_addon}`);
      console.log(`  package_name: ${d.package_name}`);
      console.log(`  package_badges: ${JSON.stringify(d.package_badges)}`);
      
      const packageIncludesBlueTick = d.package_badges?.blueTick === true;
      const shouldShow = d.blue_tick_addon || packageIncludesBlueTick;
      
      console.log(`  → Should show blue tick? ${shouldShow ? "✅ YES" : "❌ NO"}`);
      if (!shouldShow && d.has_blue_tick) {
        console.log(`  ⚠️  WARNING: has_blue_tick is true but shouldn't show badge!`);
      }
      console.log();
    });

    console.log("\n🔍 Summary:");
    console.log("─".repeat(60));
    console.log("effectiveBadges.blueTick = blueTickAddon OR (activeSubscription AND packageIncludesBlueTick)");
    console.log("If blue tick is showing but shouldn't:");
    console.log("1. Check if blue_tick_addon is incorrectly true");
    console.log("2. Check if package badges incorrectly includes blueTick");
    console.log("3. Check if frontend is using hasBlueTick instead of effectiveBadges");

  } catch (error) {
    console.error("Error:", error);
  }
  
  process.exit(0);
}

checkBlueTickAddon();
