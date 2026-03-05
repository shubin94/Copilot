import "../server/lib/loadEnv.js";
import { db } from "../db";
import { sql } from "drizzle-orm";

async function createEmailTemplatesTable() {
  try {
    console.log("📊 Creating email_templates table...");

    // Create table
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS email_templates (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        key VARCHAR(255) NOT NULL UNIQUE,
        name TEXT NOT NULL,
        description TEXT,
        subject TEXT NOT NULL,
        body TEXT NOT NULL,
        sendpulse_template_id INTEGER,
        is_active BOOLEAN NOT NULL DEFAULT true,
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW()
      );
    `);

    console.log("✅ Table created successfully");

    // Create indexes
    console.log("📊 Creating indexes...");
    
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS email_templates_key_idx ON email_templates(key);
    `);
    
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS email_templates_is_active_idx ON email_templates(is_active);
    `);
    
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS email_templates_created_at_idx ON email_templates(created_at);
    `);

    console.log("✅ Indexes created successfully");
    console.log("🎉 Email templates table setup complete!");
    
    process.exit(0);
  } catch (error) {
    console.error("❌ Error creating table:", error);
    process.exit(1);
  }
}

createEmailTemplatesTable();
