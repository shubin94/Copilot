import { pool } from "./db/index.ts";

async function runMigration() {
  try {
    console.log("Adding banner_image column to pages table...");
    
    const result = await pool.query(
      "ALTER TABLE pages ADD COLUMN IF NOT EXISTS banner_image TEXT"
    );

    await pool.query(
      "ALTER TABLE pages ALTER COLUMN banner_image TYPE TEXT"
    );
    
    console.log("✅ Migration successful: banner_image column added");
    
    // Verify column was added
    const checkResult = await pool.query(
      "SELECT column_name FROM information_schema.columns WHERE table_name = 'pages' AND column_name = 'banner_image'"
    );
    
    if (checkResult.rows.length > 0) {
      console.log("✅ Column verified in pages table");
    }
    
    process.exit(0);
  } catch (error) {
    console.error("❌ Migration failed:", error);
    process.exit(1);
  }
}

runMigration();
