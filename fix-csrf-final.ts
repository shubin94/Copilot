import "dotenv/config";
import { drizzle } from "drizzle-orm/node-postgres";
import pkg from "pg";
const { Pool } = pkg;
import * as schema from "./shared/schema.ts";
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

async function fixCsrf() {
  try {
    console.log("🔧 FIXING CSRF_ALLOWED_ORIGINS...\n");

    const csrfOrigins = "https://www.askdetectives.com,https://askdetectives1.vercel.app,https://copilot-06s5.onrender.com";
    
    console.log("Before: change-this-in-production-to-random-string");
    console.log("After:  " + csrfOrigins);

    await db.update(schema.appSecrets)
      .set({ value: csrfOrigins })
      .where(eq(schema.appSecrets.key, "csrf_allowed_origins"));
    
    console.log("\n✅ CSRF_ALLOWED_ORIGINS fixed!");
    console.log("\n🔄 NOW:");
    console.log("1. Go to Render Dashboard");
    console.log("2. Select copilot-06s5");
    console.log("3. Click 'Deployments' and Redeploy");
    console.log("4. Wait 2 minutes for redeploy");
    console.log("5. Try login again at https://www.askdetectives.com/login");
    
  } catch (error) {
    console.error("❌ Error:", error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

fixCsrf();
