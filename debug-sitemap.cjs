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
    // Check table schema
    const tableCheck = await pool.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'countries'
      ORDER BY ordinal_position
    `);
    
    console.log('=== COUNTRIES TABLE SCHEMA ===');
    if (tableCheck.rows.length === 0) {
      console.log('❌ Countries table DOES NOT EXIST');
    } else {
      console.log('✅ Columns found:', tableCheck.rows.map(r => r.column_name).join(', '));
    }

    // Check countries data  
    console.log('\n=== SAMPLE COUNTRIES DATA ===');
    const countriesData = await pool.query(`
      SELECT column_name FROM information_schema.columns WHERE table_name = 'countries' AND column_name IN ('iso_code', 'code')
    `);
    const hasIsoCode = countriesData.rows.some(r => r.column_name === 'iso_code');
    const hasCode = countriesData.rows.some(r => r.column_name === 'code');
    console.log(`Has iso_code: ${hasIsoCode}, Has code: ${hasCode}`);
    
    if (hasIsoCode) {
      const data = await pool.query('SELECT iso_code, name FROM countries LIMIT 3');
      console.log(`Found ${data.rows.length} countries with iso_code:`, data.rows);
    }
    
    if (hasCode) {
      const data = await pool.query('SELECT code, name FROM countries LIMIT 3');
      console.log(`Found ${data.rows.length} countries with code:`, data.rows);
    }

    // Check detectives
    console.log('\n=== DETECTIVES COUNTRY VALUES ===');
    const detectivesData = await pool.query(`
      SELECT DISTINCT country FROM detectives WHERE status = 'active' LIMIT 5
    `);
    console.log(`Active detective country values:`, detectivesData.rows.map(r => r.country));

    // Test the JOIN
    console.log('\n=== TEST JOINS ===');
    let testResult = null;
    
    if (hasIsoCode) {
      try {
        testResult = await pool.query(`
          SELECT c.name, c.iso_code, COUNT(d.id) as detective_count
          FROM countries c
          LEFT JOIN detectives d ON d.country = c.iso_code AND d.status = 'active'
          GROUP BY c.name, c.iso_code
          HAVING COUNT(d.id) > 0
          LIMIT 5
        `);
        console.log(`iso_code JOIN result: ${testResult.rows.length} countries have detectives`);
        testResult.rows.forEach(r => console.log(`  ${r.iso_code}: ${r.name} (${r.detective_count})`));
      } catch (e) {
        console.log(`iso_code JOIN failed:`, e.message);
      }
    }
    
    if (hasCode) {
      try {
        testResult = await pool.query(`
          SELECT c.name, c.code, COUNT(d.id) as detective_count
          FROM countries c
          LEFT JOIN detectives d ON d.country = c.code AND d.status = 'active'
          GROUP BY c.name, c.code
          HAVING COUNT(d.id) > 0
          LIMIT 5
        `);
        console.log(`code JOIN result: ${testResult.rows.length} countries have detectives`);
        testResult.rows.forEach(r => console.log(`  ${r.code}: ${r.name} (${r.detective_count})`));
      } catch (e) {
        console.log(`code JOIN failed:`, e.message);
      }
    }

  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    await pool.end();
  }
}

debug();
