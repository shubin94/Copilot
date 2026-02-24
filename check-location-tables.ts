import pkg from "pg";
const { Pool } = pkg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function checkLocationTables() {
  try {
    console.log("=== Checking Countries Table ===");
    const countriesResult = await pool.query("SELECT code, name, slug FROM countries ORDER BY name");
    console.log(`Found ${countriesResult.rows.length} countries:`);
    countriesResult.rows.forEach((row: any) => {
      console.log(`  ${row.code} | ${row.name} | ${row.slug}`);
    });

    console.log("\n=== Checking States Table ===");
    const statesResult = await pool.query(`
      SELECT c.code as country_code, s.name as state_name, s.slug as state_slug
      FROM states s
      INNER JOIN countries c ON c.id = s.country_id
      ORDER BY c.code, s.name
    `);
    console.log(`Found ${statesResult.rows.length} states:`);
    statesResult.rows.forEach((row: any) => {
      console.log(`  ${row.country_code} | ${row.state_name} | ${row.state_slug}`);
    });

    console.log("\n=== Checking Cities Table ===");
    const citiesResult = await pool.query(`
      SELECT c.code as country_code, s.slug as state_slug, ci.name as city_name, ci.slug as city_slug
      FROM cities ci
      INNER JOIN states s ON s.id = ci.state_id
      INNER JOIN countries c ON c.id = s.country_id
      ORDER BY c.code, s.slug, ci.name
    `);
    console.log(`Found ${citiesResult.rows.length} cities:`);
    citiesResult.rows.forEach((row: any) => {
      console.log(`  ${row.country_code} | ${row.state_slug} | ${row.city_name} | ${row.city_slug}`);
    });

    console.log("\n=== Checking Detectives Locations (for comparison) ===");
    const detectivesResult = await pool.query(`
      SELECT DISTINCT country, state, city
      FROM detectives
      WHERE status = 'active'
      ORDER BY country, state, city
      LIMIT 20
    `);
    console.log(`Found ${detectivesResult.rows.length} unique detective locations (showing first 20):`);
    detectivesResult.rows.forEach((row: any) => {
      console.log(`  ${row.country} | ${row.state} | ${row.city}`);
    });

  } catch (error) {
    console.error("Error:", error);
  } finally {
    await pool.end();
  }
}

checkLocationTables();
