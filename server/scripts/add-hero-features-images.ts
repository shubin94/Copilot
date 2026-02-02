import { db } from "../../db/index.ts";
import { sql } from "drizzle-orm";

async function addHeroFeaturesImages() {
  console.log("Adding hero_background_image and features_image columns to site_settings...");

  try {
    // Add hero_background_image column
    await db.execute(sql`
      ALTER TABLE site_settings 
      ADD COLUMN IF NOT EXISTS hero_background_image TEXT
    `);
    console.log("✓ Added hero_background_image column");

    // Add features_image column
    await db.execute(sql`
      ALTER TABLE site_settings 
      ADD COLUMN IF NOT EXISTS features_image TEXT
    `);
    console.log("✓ Added features_image column");

    console.log("Migration completed successfully!");
    process.exit(0);
  } catch (error) {
    console.error("Migration failed:", error);
    process.exit(1);
  }
}

addHeroFeaturesImages();
