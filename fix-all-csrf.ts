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

async function fixAll() {
  try {
    console.log("🔧 FIXING ALL CSRF AND CONFIG ISSUES\n");

    const updates = [
      {
        key: "csrf_allowed_origins",
        value: "https://www.askdetectives.com,https://askdetectives1.vercel.app,https://copilot-06s5.onrender.com",
        label: "CSRF Allowed Origins"
      },
      {
        key: "base_url",
        value: "https://www.askdetectives.com",
        label: "Base URL"
      }
    ];

    for (const update of updates) {
      console.log(`Updating ${update.label}...`);
      console.log(`  Old: change-this-in-production-to-random-string`);
      console.log(`  New: ${update.value}`);
      
      await db.update(schema.appSecrets)
        .set({ value: update.value })
        .where(eq(schema.appSecrets.key, update.key));
      
      console.log(`  ✅ Updated\n`);
    }

    // Verify the updates worked
    console.log("📋 VERIFYING UPDATES...\n");
    const rows = await db.select().from(schema.appSecrets)
      .where((t) => t.key === "csrf_allowed_origins" || t.key === "base_url");
    
    rows.forEach(row => {
      console.log(`${row.key}: ${row.value}`);
    });

    console.log("\n✅ ALL FIXED!");
    console.log("\n🚀 NEXT STEPS:");
    console.log("1. Go to Render Dashboard");
    console.log("2. Select copilot-06s5");
    console.log("3. Click Deployments → Redeploy");
    console.log("4. Wait 2-3 minutes");
    console.log("5. Try signup/login at https://www.askdetectives.com");
    
  } catch (error) {
    console.error("❌ Error:", error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

fixAll();
