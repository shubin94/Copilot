import { pool } from "./db/index.ts";

async function checkSchema() {
  try {
    const result = await pool.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'location_seo_overrides'
      ORDER BY ordinal_position;
    `);
    
    console.log("location_seo_overrides table schema:");
    console.table(result.rows);
    
    // Also check if table has any data
    const countResult = await pool.query(`SELECT COUNT(*) FROM location_seo_overrides;`);
    console.log(`\nTotal rows: ${countResult.rows[0].count}`);
    
    // Show sample row if exists
    const sampleResult = await pool.query(`SELECT * FROM location_seo_overrides LIMIT 1;`);
    if (sampleResult.rows.length > 0) {
      console.log("\nSample row:");
      console.log(sampleResult.rows[0]);
    }
  } catch (error) {
    console.error("Error checking schema:", error);
  } finally {
    await pool.end();
  }
}

checkSchema();
