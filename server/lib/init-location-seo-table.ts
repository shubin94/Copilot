import { pool } from "../../db/index.js";

/**
 * Ensures location_seo_overrides table exists with correct schema
 * Called at server startup to auto-create table if missing
 */
export async function ensureLocationSeoTable(): Promise<void> {
  try {
    console.log("[DB Init] Checking location_seo_overrides table...");

    // Check if table exists
    const tableCheck = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'location_seo_overrides'
      );
    `);

    if (!tableCheck.rows[0].exists) {
      console.log("[DB Init] Creating location_seo_overrides table...");

      // Enable pgcrypto extension if not exists
      await pool.query(`CREATE EXTENSION IF NOT EXISTS pgcrypto`);

      // Create table
      await pool.query(`
        CREATE TABLE location_seo_overrides (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          entity_type TEXT NOT NULL CHECK (entity_type IN ('country', 'state', 'city')),
          entity_id TEXT NOT NULL,
          meta_title TEXT,
          meta_description TEXT,
          h1 TEXT,
          created_at TIMESTAMP NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
          CONSTRAINT unique_entity_override UNIQUE (entity_type, entity_id)
        );
      `);

      // Create index
      await pool.query(`
        CREATE INDEX idx_location_seo_entity 
        ON location_seo_overrides(entity_type, entity_id);
      `);

      // Create trigger function
      await pool.query(`
        CREATE OR REPLACE FUNCTION update_location_seo_updated_at()
        RETURNS TRIGGER AS $$
        BEGIN
          NEW.updated_at = NOW();
          RETURN NEW;
        END;
        $$ LANGUAGE plpgsql;
      `);

      // Create trigger
      await pool.query(`
        CREATE TRIGGER trigger_location_seo_updated_at
        BEFORE UPDATE ON location_seo_overrides
        FOR EACH ROW
        EXECUTE FUNCTION update_location_seo_updated_at();
      `);

      console.log("✅ [DB Init] location_seo_overrides table created successfully");
    } else {
      console.log("✅ [DB Init] location_seo_overrides table already exists");
    }
  } catch (error: any) {
    console.error("❌ [DB Init] Error ensuring location_seo_overrides table:", error.message);
    // Don't throw - allow server to start even if table creation fails
    // Admin can manually create table using create-location-seo-table.ts
  }
}
