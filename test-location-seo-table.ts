import pkg from 'pg';
const { Pool } = pkg;
import dotenv from 'dotenv';

dotenv.config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function testLocationSeoTable() {
  try {
    console.log("1. Checking if location_seo_overrides table exists...");
    const tableCheck = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'location_seo_overrides'
      );
    `);
    console.log("Table exists:", tableCheck.rows[0].exists);

    if (tableCheck.rows[0].exists) {
      console.log("\n2. Checking table schema...");
      const schemaCheck = await pool.query(`
        SELECT column_name, data_type, is_nullable
        FROM information_schema.columns
        WHERE table_name = 'location_seo_overrides'
        ORDER BY ordinal_position;
      `);
      console.log("Columns:", schemaCheck.rows);

      console.log("\n3. Checking unique constraint...");
      const constraintCheck = await pool.query(`
        SELECT constraint_name, constraint_type
        FROM information_schema.table_constraints
        WHERE table_name = 'location_seo_overrides';
      `);
      console.log("Constraints:", constraintCheck.rows);

      console.log("\n4. Checking row count...");
      const countCheck = await pool.query(`SELECT COUNT(*) FROM location_seo_overrides`);
      console.log("Row count:", countCheck.rows[0].count);

      console.log("\n5. Sample rows...");
      const sampleRows = await pool.query(`SELECT * FROM location_seo_overrides LIMIT 3`);
      console.log("Sample data:", sampleRows.rows);
    } else {
      console.log("\n❌ Table does not exist! Creating it...");
      
      await pool.query(`
        CREATE TABLE IF NOT EXISTS location_seo_overrides (
          id SERIAL PRIMARY KEY,
          entity_type VARCHAR(20) NOT NULL CHECK (entity_type IN ('country', 'state', 'city')),
          entity_id VARCHAR(50) NOT NULL,
          meta_title TEXT,
          meta_description TEXT,
          h1 TEXT,
          created_at TIMESTAMP DEFAULT NOW(),
          updated_at TIMESTAMP DEFAULT NOW(),
          UNIQUE (entity_type, entity_id)
        );
      `);
      console.log("✅ Table created successfully!");

      // Create index
      await pool.query(`
        CREATE INDEX IF NOT EXISTS idx_location_seo_entity 
        ON location_seo_overrides(entity_type, entity_id);
      `);
      console.log("✅ Index created successfully!");
    }

    await pool.end();
    console.log("\n✅ Test complete!");
  } catch (error: any) {
    console.error("❌ Error:", error.message);
    console.error("Stack:", error.stack);
    await pool.end();
    process.exit(1);
  }
}

testLocationSeoTable();
