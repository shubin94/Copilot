import { db } from "../index.js";
import { sql } from "drizzle-orm";

export async function migrate() {
  try {
    // Add slug column to services table if it doesn't exist
    await db.execute(
      sql`ALTER TABLE services ADD COLUMN IF NOT EXISTS slug text NOT NULL UNIQUE DEFAULT gen_random_uuid()::text`
    );
    
    // Create unique index on slug
    await db.execute(
      sql`CREATE UNIQUE INDEX IF NOT EXISTS services_slug_unique ON services(slug)`
    );
    
    console.log("✅ Migration: Added slug column to services table");
  } catch (error) {
    console.error("Migration error:", error);
    throw error;
  }
}
