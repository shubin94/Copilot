import { pool } from "./db/index.ts";

async function checkCountries() {
  try {
    console.log("========================================");
    console.log("COUNTRIES TABLE");
    console.log("========================================");
    
    const countriesResult = await pool.query(`
      SELECT id, name, slug 
      FROM countries 
      ORDER BY id
    `);
    
    console.table(countriesResult.rows);
    
    console.log("\n========================================");
    console.log("DETECTIVE COUNTS BY COUNTRY");
    console.log("========================================");
    
    const detectiveCountsResult = await pool.query(`
      SELECT 
        c.id,
        c.name,
        c.slug,
        COUNT(d.id) as detective_count
      FROM countries c
      LEFT JOIN detectives d ON d.country_id = c.id
      GROUP BY c.id, c.name, c.slug
      ORDER BY c.id
    `);
    
    console.table(detectiveCountsResult.rows);
    
    console.log("\n========================================");
    console.log("DETECTIVES WITH country_id = 2");
    console.log("========================================");
    
    const detectivesInId2 = await pool.query(`
      SELECT COUNT(*) as count
      FROM detectives 
      WHERE country_id = 2
    `);
    
    console.log(`Count: ${detectivesInId2.rows[0].count}`);
    
    if (parseInt(detectivesInId2.rows[0].count) > 0) {
      console.log("\nSample detectives:");
      const sampleDetectives = await pool.query(`
        SELECT id, business_name, country, country_id
        FROM detectives
        WHERE country_id = 2
        LIMIT 5
      `);
      console.table(sampleDetectives.rows);
    }
    
  } catch (error) {
    console.error("Error:", error);
  } finally {
    await pool.end();
  }
}

checkCountries();
