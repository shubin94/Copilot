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

async function updateCsrf() {
  try {
    console.log("🔄 Updating CSRF allowed origins...");

    // Update csrf_allowed_origins to include custom domain
    const csrfOrigins = "https://www.askdetectives.com,https://askdetectives1.vercel.app,https://copilot-06s5.onrender.com";
    
    await db.update(schema.appSecrets)
      .set({ value: csrfOrigins })
      .where(eq(schema.appSecrets.key, "csrf_allowed_origins"));
    
    console.log(`✅ Updated csrf_allowed_origins to:`);
    console.log(`   ${csrfOrigins}`);

    // Also update base_url to custom domain
    await db.update(schema.appSecrets)
      .set({ value: "https://www.askdetectives.com" })
      .where(eq(schema.appSecrets.key, "base_url"));
    
    console.log(`✅ Updated base_url to: https://www.askdetectives.com`);

    console.log("\n🎉 All origins updated successfully!");
    console.log("\nNow redeploy the backend on Render for changes to take effect.");
    
  } catch (error) {
    console.error("❌ Error updating CSRF origins:", error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

updateCsrf();
