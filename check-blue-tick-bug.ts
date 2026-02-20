import "dotenv/config";
import pkg from "pg";
const { Pool } = pkg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === "production" ? { rejectUnauthorized: false } : false,
});

async function checkBlueTick() {
  const client = await pool.connect();
  
  try {
    console.log("Checking Blue Tick inconsistency...\n");

    // Get all detectives with their subscription and blue tick info
    const result = await client.query(`
      SELECT 
        d.id,
        d.business_name,
        u.name as user_name,
        d.has_blue_tick,
        d.blue_tick_addon,
        d.subscription_package_id,
        sp.name as package_name,
        sp.price as package_price,
        sp.badges as package_badges,
        d.level,
        d.subscription_expires_at
      FROM detectives d
      INNER JOIN users u ON d.user_id = u.id
      LEFT JOIN subscription_plans sp ON d.subscription_package_id = sp.id
      WHERE d.business_name IN ('Lynx Detective Agency', 'Jaipur Intelligence Agency')
      ORDER BY d.business_name;
    `);

    console.log(`Found ${result.rows.length} detectives\n`);

    for (const det of result.rows) {
      console.log(`${"=".repeat(80)}`);
      console.log(`Detective: ${det.business_name || det.user_name}`);
      console.log(`${"=".repeat(80)}`);
      console.log(`ID: ${det.id}`);
      console.log(`Level: ${det.level}`);
      console.log(`\nBlue Tick Status:`);
      console.log(`  has_blue_tick (from package): ${det.has_blue_tick}`);
      console.log(`  blue_tick_addon (purchased): ${det.blue_tick_addon}`);
      console.log(`  EFFECTIVE Blue Tick: ${det.has_blue_tick || det.blue_tick_addon}`);
      
      console.log(`\nSubscription:`);
      console.log(`  Package ID: ${det.subscription_package_id}`);
      console.log(`  Package Name: ${det.package_name}`);
      console.log(`  Package Price: ${det.package_price}`);
      console.log(`  Expires: ${det.subscription_expires_at || 'Never (FREE plan)'}`);
      
      console.log(`\nPackage Badges:`);
      if (det.package_badges) {
        const badges = typeof det.package_badges === 'string' 
          ? JSON.parse(det.package_badges) 
          : det.package_badges;
        console.log(`  ${JSON.stringify(badges, null, 2)}`);
        console.log(`  Blue Tick in Package: ${badges?.blueTick || false}`);
      } else {
        console.log(`  No badges configured`);
      }
      
      console.log(`\n`);
    }

    // Now check all FREE plan detectives
    console.log(`\n${"=".repeat(80)}`);
    console.log(`CHECKING ALL FREE PLAN DETECTIVES`);
    console.log(`${"=".repeat(80)}\n`);

    const freeResult = await client.query(`
      SELECT 
        COUNT(*) as total_free,
        SUM(CASE WHEN d.has_blue_tick = true THEN 1 ELSE 0 END) as with_blue_tick,
        SUM(CASE WHEN d.blue_tick_addon = true THEN 1 ELSE 0 END) as with_addon
      FROM detectives d
      LEFT JOIN subscription_plans sp ON d.subscription_package_id = sp.id
      WHERE (sp.price = 0 OR sp.price IS NULL);
    `);

    const stats = freeResult.rows[0];
    console.log(`Total FREE plan detectives: ${stats.total_free}`);
    console.log(`With has_blue_tick=true: ${stats.with_blue_tick}`);
    console.log(`With blue_tick_addon=true: ${stats.with_addon}`);
    console.log(`\n⚠️  Issue: has_blue_tick should be FALSE for all FREE plans unless they have an addon!\n`);

    // Get package configuration
    console.log(`${"=".repeat(80)}`);
    console.log(`SUBSCRIPTION PACKAGE CONFIGURATION`);
    console.log(`${"=".repeat(80)}\n`);

    const packages = await client.query(`
      SELECT 
        id,
        name,
        price,
        billing_cycle,
        badges,
        features
      FROM subscription_plans
      ORDER BY price;
    `);

    for (const pkg of packages.rows) {
      const badges = typeof pkg.badges === 'string' ? JSON.parse(pkg.badges) : pkg.badges;
      console.log(`Package: ${pkg.name}`);
      console.log(`  Price: ${pkg.price} (${pkg.billing_cycle})`);
      console.log(`  Badges: ${JSON.stringify(badges)}`);
      console.log(`  Blue Tick Included: ${badges?.blueTick || false}`);
      console.log(``);
    }

  } finally {
    client.release();
    await pool.end();
  }
}

checkBlueTick().catch(console.error);
