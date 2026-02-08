import "./server/lib/loadEnv.ts";
import { db } from "./db/index";
import { sql } from "drizzle-orm";

async function fixBlueTickIssue() {
  console.log("=== Fixing Blue Tick Display Issue ===\n");
  
  try {
    // Set is_verified to FALSE for all detectives who:
    // 1. Don't have blue_tick_addon = true
    // 2. Don't have a package with blueTick in badges
    const result = await db.execute(sql`
      UPDATE detectives d
      SET is_verified = false
      WHERE d.is_verified = true
        AND d.blue_tick_addon = false
        AND (
          d.subscription_package_id IS NULL
          OR NOT EXISTS (
            SELECT 1 FROM subscription_plans sp
            WHERE sp.id = d.subscription_package_id
              AND (sp.badges->>'blueTick')::boolean = true
          )
        )
      RETURNING d.id, d.business_name
    `);

    console.log(`✅ Updated ${result.rowCount} detectives`);
    if (result.rows.length > 0) {
      console.log("\nDetectives updated:");
      result.rows.forEach((d: any) => {
        console.log(`  - ${d.business_name} (ID: ${d.id})`);
      });
    }

    console.log("\n🔍 Verification:");
    const check = await db.execute(sql`
      SELECT 
        d.business_name,
        d.is_verified,
        d.blue_tick_addon,
        sp.name as package_name,
        sp.badges->>'blueTick' as package_has_blue_tick
      FROM detectives d
      LEFT JOIN subscription_plans sp ON d.subscription_package_id = sp.id
      ORDER BY d.business_name
    `);

    console.log("\nCurrent state:");
    check.rows.forEach((d: any) => {
      const shouldShowBlueTick = d.blue_tick_addon || (d.package_has_blue_tick === 'true');
      console.log(`${d.business_name}:`);
      console.log(`  blue_tick_addon: ${d.blue_tick_addon}`);
      console.log(`  package: ${d.package_name}`);
      console.log(`  package blueTick: ${d.package_has_blue_tick === 'true'}`);
      console.log(`  → Blue tick shows: ${shouldShowBlueTick ? "YES ✅" : "NO ❌"}`);
      console.log();
    });

    process.exit(0);
  } catch (error) {
    console.error("Error:", error);
    process.exit(1);
  }
}

fixBlueTickIssue();
