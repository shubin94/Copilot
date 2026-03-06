import "../server/lib/loadEnv.ts";
import { drizzle } from "drizzle-orm/node-postgres";
import pkg from "pg";
const { Pool } = pkg;
import { eq } from "drizzle-orm";
import * as schema from "../shared/schema.js";
import { randomBytes } from "crypto";

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error("❌ DATABASE_URL environment variable is required");
  process.exit(1);
}

const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: process.env.NODE_ENV === "production" ? { rejectUnauthorized: true } : false,
});

const db = drizzle(pool, { schema });

async function updateSecrets() {
  try {
    console.log("🔧 Updating production secrets...\n");
    
    const CSRF_ORIGINS = "https://www.askdetectives.com,https://askdetectives1.vercel.app,https://copilot-06s5.onrender.com";
    const BASE_URL = "https://www.askdetectives.com";

    // Check if session_secret already exists - only generate if new
    const secrets = await db.select().from(schema.appSecrets);
    const existingSession = secrets.find(s => s.key === "session_secret");
    const SESSION_SECRET = existingSession ? existingSession.value : randomBytes(32).toString('hex');
    
    console.log(`Found ${secrets.length} existing secrets in database\n`);
    
    // Update csrf_allowed_origins
    const existingCsrf = secrets.find(s => s.key === "csrf_allowed_origins");
    if (existingCsrf) {
      await db.update(schema.appSecrets)
        .set({ value: CSRF_ORIGINS, updatedAt: new Date() })
        .where(eq(schema.appSecrets.key, "csrf_allowed_origins"));
      console.log("✅ Updated csrf_allowed_origins");
    } else {
      await db.insert(schema.appSecrets).values({
        key: "csrf_allowed_origins",
        value: CSRF_ORIGINS,
        label: "CSRF Allowed Origins",
        description: "Comma-separated list of allowed CSRF origins"
      });
      console.log("✅ Created csrf_allowed_origins");
    }

    // Update base_url
    const existingBase = secrets.find(s => s.key === "base_url");
    if (existingBase) {
      await db.update(schema.appSecrets)
        .set({ value: BASE_URL, updatedAt: new Date() })
        .where(eq(schema.appSecrets.key, "base_url"));
      console.log("✅ Updated base_url");
    } else {
      await db.insert(schema.appSecrets).values({
        key: "base_url",
        value: BASE_URL,
        label: "Base URL",
        description: "Public base URL (for OAuth callbacks, emails, etc.)"
      });
      console.log("✅ Created base_url");
    }

    // Create session_secret only if it doesn't exist - never regenerate!
    if (!existingSession) {
      await db.insert(schema.appSecrets).values({
        key: "session_secret",
        value: SESSION_SECRET,
        label: "Session Secret",
        description: "Secret key for encrypting session cookies"
      });
      console.log("✅ Created session_secret");
    } else {
      console.log("⏭️  Skipping session_secret (already exists - never regenerate!)");
    }

    console.log("\n✅ DATABASE UPDATED!");
    console.log("\n📋 NOW ADD TO RENDER.COM:");
    console.log("─────────────────────────────────────────────────");
    console.log("SESSION_SECRET=[Check database or use OpenSSL: openssl rand -base64 32]");
    console.log(`CSRF_ALLOWED_ORIGINS=${CSRF_ORIGINS}`);
    console.log("─────────────────────────────────────────────────");
    console.log("\n🔗 Go to: https://dashboard.render.com");
    console.log("   → Your Service → Environment → Add Environment Variable");

  } catch (error: any) {
    console.error("❌ Error:", error.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

updateSecrets();
