import { db } from "../db";
import { sql } from "drizzle-orm";

async function fixMissingColumn() {
  try {
    console.log("📊 Adding missing claim_completed_at column...");

    // Add column
    await db.execute(sql`
      ALTER TABLE detectives 
      ADD COLUMN IF NOT EXISTS claim_completed_at TIMESTAMP;
    `);

    console.log("✅ Column added successfully");

    // Create index
    console.log("📊 Creating index...");
    
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS detectives_claim_completed_at_idx ON detectives(claim_completed_at);
    `);

    console.log("✅ Index created successfully");
    console.log("🎉 Migration complete!");
    
    process.exit(0);
  } catch (error) {
    console.error("❌ Error:", error);
    process.exit(1);
  }
}

fixMissingColumn();
