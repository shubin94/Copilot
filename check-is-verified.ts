import { db } from "./db/index";
import { sql } from "drizzle-orm";

async function checkIsVerified() {
  console.log("=== Checking is_verified Field for All Detectives ===\n");
  
  try {
    const result = await db.execute(sql`
      SELECT 
        d.id,
        d.business_name,
        d.is_verified,
        d.has_blue_tick,
        d.blue_tick_addon,
        sp.name as package_name,
        sp.badges as package_badges
      FROM detectives d
      LEFT JOIN subscription_plans sp ON d.subscription_package_id = sp.id
      ORDER BY d.business_name
    `);

    console.log(`Total detectives: ${result.rows.length}\n`);
    
    result.rows.forEach((d: any) => {
      console.log(`${d.business_name}:`);
      console.log(`  is_verified: ${d.is_verified}`);
      console.log(`  has_blue_tick: ${d.has_blue_tick}`);
      console.log(`  blue_tick_addon: ${d.blue_tick_addon}`);
      console.log(`  package: ${d.package_name}`);
      console.log(`  package blueTick: ${d.package_badges?.blueTick || false}`);
      
      // Check if blue tick will show
      const effectiveBlueTick = d.blue_tick_addon || (d.package_badges?.blueTick === true);
      const willShowBlueTick = d.is_verified || effectiveBlueTick;
      
      if (willShowBlueTick) {
        console.log(`  🔵 BLUE TICK WILL SHOW (isVerified=${d.is_verified}, effectiveBlueTick=${effectiveBlueTick})`);
      }
      console.log();
    });

    process.exit(0);
  } catch (error) {
    console.error("Error:", error);
    process.exit(1);
  }
}

checkIsVerified();
