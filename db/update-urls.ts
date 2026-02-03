import "dotenv/config";
import { drizzle } from "drizzle-orm/node-postgres";
import pkg from "pg";
const { Pool } = pkg;
import * as schema from "../shared/schema.ts";
import { eq } from "drizzle-orm";

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

async function updateUrls() {
  try {
    const frontendUrl = "https://askdetectives1.vercel.app";
    const backendUrl = "https://copilot-06s5.onrender.com";

    console.log("🔄 Updating production URLs...");

    // Update base_url
    await db.update(schema.appSecrets)
      .set({ value: backendUrl })
      .where(eq(schema.appSecrets.key, "base_url"));
    console.log(`✅ Updated base_url: ${backendUrl}`);

    // Update csrf_allowed_origins
    const csrfOrigins = `${frontendUrl},${backendUrl}`;
    await db.update(schema.appSecrets)
      .set({ value: csrfOrigins })
      .where(eq(schema.appSecrets.key, "csrf_allowed_origins"));
    console.log(`✅ Updated csrf_allowed_origins: ${csrfOrigins}`);

    console.log("\n🎉 URLs updated successfully!");
    console.log("\nNext steps:");
    console.log("1. Go to Vercel Dashboard");
    console.log("2. Settings → Environment Variables");
    console.log(`3. Set VITE_API_URL = ${backendUrl}`);
    console.log("4. Redeploy on Vercel");
    
  } catch (error) {
    console.error("❌ Error updating URLs:", error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

updateUrls();
