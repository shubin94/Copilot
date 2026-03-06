import pkg from "pg";
const { Pool } = pkg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function quickCheck() {
  try {
    console.log("🔍 Checking location tables...\n");

    // Check countries
    const countriesCount = await pool.query("SELECT COUNT(*) as count FROM countries");
    console.log(`📍 Countries in database: ${countriesCount.rows[0].count}`);

    if (countriesCount.rows[0].count === 0) {
      console.log("\n❌ PROBLEM: Countries table is EMPTY!");
      console.log("\n✅ SOLUTION: Run this command:");
      console.log("   npx tsx seed-locations.ts");
      console.log("\n   This will populate ~250 countries, 5000+ states, 150k+ cities");
      await pool.end();
      return;
    }

    // Check specific countries
    const usCheck = await pool.query("SELECT * FROM countries WHERE code = 'US'");
    const inCheck = await pool.query("SELECT * FROM countries WHERE code = 'IN'");

    console.log(`   - United States: ${usCheck.rows.length > 0 ? '✓ EXISTS' : '✗ MISSING'}`);
    console.log(`   - India: ${inCheck.rows.length > 0 ? '✓ EXISTS' : '✗ MISSING'}`);

    // Check states
    const statesCount = await pool.query("SELECT COUNT(*) as count FROM states");
    console.log(`\n📍 States in database: ${statesCount.rows[0].count}`);

    if (usCheck.rows.length > 0) {
      const usStates = await pool.query(`
        SELECT COUNT(*) as count FROM states s 
        INNER JOIN countries c ON c.id = s.country_id 
        WHERE c.code = 'US'
      `);
      console.log(`   - US states: ${usStates.rows[0].count}`);
      
      const caState = await pool.query(`
        SELECT s.* FROM states s
        INNER JOIN countries c ON c.id = s.country_id
        WHERE c.code = 'US' AND s.slug = 'california'
      `);
      console.log(`   - California: ${caState.rows.length > 0 ? '✓ EXISTS' : '✗ MISSING'}`);
    }

    // Check cities
    const citiesCount = await pool.query("SELECT COUNT(*) as count FROM cities");
    console.log(`\n📍 Cities in database: ${citiesCount.rows[0].count}`);

    // Check what detective countries exist
    console.log("\n📍 Detective location data:");
    const detectiveCountries = await pool.query(`
      SELECT country, COUNT(*) as count 
      FROM detectives 
      WHERE status = 'active' 
      GROUP BY country 
      ORDER BY count DESC
    `);
    detectiveCountries.rows.forEach((row: any) => {
      console.log(`   - ${row.country}: ${row.count} detectives`);
    });

    console.log("\n✅ Status:");
    if (countriesCount.rows[0].count > 50 && statesCount.rows[0].count > 100) {
      console.log("   Location tables are populated properly!");
      console.log("   The admin Location SEO pages should show all countries/states/cities.");
    } else {
      console.log("   ⚠️  Location tables seem incomplete.");
      console.log("\n   Run: npx tsx seed-locations.ts");
      console.log("   This will populate ALL countries, states, and cities.");
    }

  } catch (error) {
    console.error("Error:", error);
  } finally {
    await pool.end();
  }
}

quickCheck();
