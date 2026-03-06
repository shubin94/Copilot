const { Pool } = require('pg');

const pool = new Pool({
  host: process.env.DATABASE_HOST,
  user: process.env.DATABASE_USER,
  password: process.env.DATABASE_PASSWORD,
  database: process.env.DATABASE_NAME,
  port: 5432,
});

async function debug() {
  try {
    // Check if countries table exists and get row count
    const countResult = await pool.query('SELECT COUNT(*) as cnt FROM countries');
    const countryCount = parseInt(countResult.rows[0].cnt);
    console.log(`Countries table row count: ${countryCount}`);

    if (countryCount === 0) {
      console.log('❌ Countries table is EMPTY - this explains why sitemap queries return 0 detectives');
    } else {
      console.log(`✅ Countries table has ${countryCount} countries`);
    }

    // Check detectives count
    const detectiveCount = await pool.query('SELECT COUNT(*) as cnt FROM detectives WHERE status = \'active\'');
    console.log(`Active detectives: ${detectiveCount.rows[0].cnt}`);

    // Check what country values exist in detectives
    const countryValues = await pool.query(`
      SELECT DISTINCT country, COUNT(*) as cnt 
      FROM detectives 
      WHERE status = 'active'
      GROUP BY country
    `);
    console.log(`\nDisct active detective countries: ${countryValues.rows.length}`);
    countryValues.rows.forEach(r => {
      console.log(`  - ${r.country}: ${r.cnt} detectives`);
    });

  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    await pool.end();
  }
}

debug();
