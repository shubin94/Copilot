import "dotenv/config";
import { drizzle } from "drizzle-orm/node-postgres";
import pkg from "pg";
const { Pool } = pkg;
import * as schema from "../shared/schema.ts";
import crypto from "crypto";

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

async function initSecrets() {
  try {
    console.log("🔐 Initializing production secrets...");

    // Generate a secure random session secret
    const sessionSecret = crypto.randomBytes(32).toString("hex");

    // Get values from environment or use defaults
    const secrets = [
      {
        key: "session_secret",
        value: process.env.SESSION_SECRET || sessionSecret,
        description: "Session encryption secret"
      },
      {
        key: "base_url",
        value: process.env.BASE_URL || "https://askdetectives-backend.onrender.com",
        description: "Backend base URL"
      },
      {
        key: "csrf_allowed_origins",
        value: process.env.CSRF_ALLOWED_ORIGINS || "https://askdetectives.vercel.app,https://askdetectives-backend.onrender.com",
        description: "Comma-separated list of allowed CSRF origins"
      },
      {
        key: "supabase_url",
        value: process.env.SUPABASE_URL || "",
        description: "Supabase project URL"
      },
      {
        key: "supabase_service_role_key",
        value: process.env.SUPABASE_SERVICE_ROLE_KEY || "",
        description: "Supabase service role key for storage"
      },
      {
        key: "sendpulse_api_id",
        value: process.env.SENDPULSE_API_ID || "",
        description: "SendPulse API ID"
      },
      {
        key: "sendpulse_api_secret",
        value: process.env.SENDPULSE_API_SECRET || "",
        description: "SendPulse API Secret"
      },
      {
        key: "sendpulse_sender_email",
        value: process.env.SENDPULSE_SENDER_EMAIL || "noreply@askdetectives.com",
        description: "SendPulse sender email"
      },
      {
        key: "sendpulse_sender_name",
        value: process.env.SENDPULSE_SENDER_NAME || "AskDetectives",
        description: "SendPulse sender name"
      }
    ];

    // Insert secrets into database
    for (const secret of secrets) {
      await db.insert(schema.appSecrets)
        .values({
          key: secret.key,
          value: secret.value,
          description: secret.description,
          createdAt: new Date(),
        })
        .onConflictDoUpdate({
          target: schema.appSecrets.key,
          set: {
            value: secret.value,
            description: secret.description,
          }
        });
      
      console.log(`✅ Set ${secret.key}`);
    }

    console.log("\n🎉 All secrets initialized successfully!");
    console.log("\n⚠️  IMPORTANT: Save this session secret (if generated):");
    console.log(`SESSION_SECRET=${sessionSecret}`);
    
  } catch (error) {
    console.error("❌ Error initializing secrets:", error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

initSecrets();
