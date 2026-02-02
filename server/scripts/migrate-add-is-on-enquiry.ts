import { pool } from "../../db/index.ts";

async function runMigration() {
  try {
    console.log("Running migration: Add isOnEnquiry to services...");
    
    // Check if column already exists
    const checkResult = await pool.query(
      `SELECT column_name FROM information_schema.columns 
       WHERE table_name = 'services' AND column_name = 'is_on_enquiry'`
    );
    
    if (checkResult.rows.length > 0) {
      console.log("Column 'is_on_enquiry' already exists, skipping...");
      return;
    }

    // Add isOnEnquiry column
    await pool.query(
      `ALTER TABLE services ADD COLUMN is_on_enquiry BOOLEAN NOT NULL DEFAULT FALSE`
    );
    console.log("✓ Added is_on_enquiry column");

    // Check if basePrice needs to be made nullable
    const basePriceResult = await pool.query(
      `SELECT is_nullable FROM information_schema.columns 
       WHERE table_name = 'services' AND column_name = 'base_price'`
    );
    
    if (basePriceResult.rows.length > 0 && basePriceResult.rows[0].is_nullable === 'NO') {
      await pool.query(
        `ALTER TABLE services ALTER COLUMN base_price DROP NOT NULL`
      );
      console.log("✓ Made base_price nullable");
    }

    console.log("Migration completed successfully!");
  } catch (error) {
    console.error("Migration failed:", error);
    throw error;
  }
}

runMigration().then(() => process.exit(0)).catch(err => {
  console.error(err);
  process.exit(1);
});
