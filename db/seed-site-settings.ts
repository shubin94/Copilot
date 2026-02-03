import "dotenv/config";
import { drizzle } from "drizzle-orm/node-postgres";
import pkg from "pg";
const { Pool } = pkg;
import * as schema from "../shared/schema.ts";
import { sql } from "drizzle-orm";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL is not set");
  process.exit(1);
}

const isLocalDb = url?.includes("localhost") || url?.includes("127.0.0.1");
const sslConfig = !isLocalDb ? { rejectUnauthorized: false } : undefined;

const pool = new Pool({
  connectionString: url,
  ssl: sslConfig
});

const db = drizzle(pool, { schema });

async function seedSiteSettings() {
  try {
    console.log("🔧 Seeding site_settings table...");

    // Check if site_settings already has data
    const existing = await db.select().from(schema.siteSettings).limit(1);

    if (existing.length > 0) {
      console.log("✅ Site settings already exist");
    } else {
      await db.insert(schema.siteSettings).values({
        logoUrl: null,
        footerLinks: [],
        updatedAt: new Date(),
      });
      console.log("✅ Created default site settings");
    }

    console.log("\n🎉 Site settings seeded successfully!");
  } catch (error) {
    console.error("❌ Error seeding site_settings:", error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

seedSiteSettings();
