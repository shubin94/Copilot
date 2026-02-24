import { pool } from "./server/db";

async function createLocationSeoTable() {
  try {
    console.log("Creating location_seo_overrides table...");

    // Enable pgcrypto extension
    await pool.query(`CREATE EXTENSION IF NOT EXISTS pgcrypto`);
    console.log("✓ pgcrypto extension enabled");

    // Create table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS location_seo_overrides (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        entity_type TEXT NOT NULL CHECK (entity_type IN ('country', 'state', 'city')),
        entity_id TEXT NOT NULL,
        meta_title TEXT,
        meta_description TEXT,
        h1 TEXT,
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `);
    console.log("✓ location_seo_overrides table created");

    // Add unique constraint
    await pool.query(`
      ALTER TABLE location_seo_overrides 
      ADD CONSTRAINT IF NOT EXISTS unique_entity_override 
      UNIQUE (entity_type, entity_id)
    `).catch(err => {
      if (err.code !== '42710') throw err; // Ignore "already exists" error
      console.log("✓ unique constraint already exists");
    });
    console.log("✓ unique constraint added");

    // Add indexes
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_location_seo_entity 
      ON location_seo_overrides(entity_type, entity_id)
    `);
    console.log("✓ entity index created");

    // Create trigger function
    await pool.query(`
      CREATE OR REPLACE FUNCTION update_location_seo_updated_at()
      RETURNS TRIGGER AS $$
      BEGIN
        NEW.updated_at = NOW();
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql
    `);
    console.log("✓ trigger function created");

    // Create trigger
    await pool.query(`
      DROP TRIGGER IF EXISTS trigger_location_seo_updated_at ON location_seo_overrides
    `);
    await pool.query(`
      CREATE TRIGGER trigger_location_seo_updated_at
      BEFORE UPDATE ON location_seo_overrides
      FOR EACH ROW
      EXECUTE FUNCTION update_location_seo_updated_at()
    `);
    console.log("✓ trigger created");

    console.log("\n✅ location_seo_overrides table setup complete!");
    process.exit(0);
  } catch (error) {
    console.error("\n❌ Error creating table:", error);
    process.exit(1);
  }
}

createLocationSeoTable();
