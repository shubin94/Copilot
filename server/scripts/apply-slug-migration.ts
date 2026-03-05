#!/usr/bin/env node
/**
 * Apply slug migration and populate existing services with slugs
 * Run: tsx server/scripts/apply-slug-migration.ts
 */

import { db } from "../../db/index.js";
import { sql } from "drizzle-orm";
import { populateSlugs } from "./populate-service-slugs.js";

async function applyMigration() {
  try {
    console.log("🔄 Applying slug migration...");

    // Add slug column if it doesn't exist
    await db.execute(
      sql`ALTER TABLE services ADD COLUMN IF NOT EXISTS slug text`
    );
    console.log("✅ Slug column added/verified");

    // Create unique index if it doesn't exist
    await db.execute(
      sql`CREATE UNIQUE INDEX IF NOT EXISTS services_slug_unique ON services(slug) WHERE slug IS NOT NULL`
    );
    console.log("✅ Unique index created/verified");

    // Populate existing services with slugs
    await populateSlugs();

    console.log("✅ Migration complete!");
    process.exit(0);
  } catch (error) {
    console.error("❌ Migration failed:", error);
    process.exit(1);
  }
}

applyMigration();
