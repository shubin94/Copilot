import pkg from "pg";
const { Pool } = pkg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function checkDetectiveCountries() {
  try {
    console.log("🔍 Checking detective country values...\n");

    const result = await pool.query(`
      SELECT 
        country,
        LOWER(REGEXP_REPLACE(TRIM(country), '\\s+', '-', 'g')) AS country_slug,
        COUNT(*) as count
      FROM detectives
      WHERE status = 'active'
        AND country IS NOT NULL
        AND TRIM(country) <> ''
      GROUP BY country
      ORDER BY count DESC
    `);

    console.log(`Found ${result.rows.length} unique countries:\n`);
    result.rows.forEach((row: any) => {
      console.log(`  ${row.country.padEnd(20)} → slug: ${row.country_slug.padEnd(20)} | ${row.count} detectives`);
    });

    console.log("\n✅ This shows actual country values in database");

  } catch (error) {
    console.error("Error:", error);
  } finally {
    await pool.end();
  }
}

checkDetectiveCountries();
