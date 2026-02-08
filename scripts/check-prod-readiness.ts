import { db } from "../db/index.ts";
import { appSecrets } from "../shared/schema.ts";

const REQUIRED_SECRET_KEYS = [
  "session_secret",
  "csrf_allowed_origins",
  "base_url",
  "host",
];

const OPTIONAL_PROVIDER_KEYS = [
  // Note: supabase_url and supabase_service_role_key removed - Supabase credentials must come from environment variables only
  "sendgrid_api_key",
  "sendgrid_from_email",
  "smtp_host",
  "smtp_from_email",
  "sendpulse_api_id",
  "sendpulse_api_secret",
  "sendpulse_sender_email",
  "paypal_client_id",
  "paypal_client_secret",
  "razorpay_key_id",
  "razorpay_key_secret",
  "google_client_id",
  "google_client_secret",
  "deepseek_api_key",
];

async function main() {
  try {
    console.log("\n=== Production Env Check ===");
    const nodeEnv = process.env.NODE_ENV;
    const hasNodeEnv = nodeEnv === "production";
    const hasDatabaseUrl = !!process.env.DATABASE_URL;
    const hasPort = !!process.env.PORT;

    console.log(`NODE_ENV=production: ${hasNodeEnv ? "OK" : "MISSING/NOT PRODUCTION"}`);
    console.log(`DATABASE_URL: ${hasDatabaseUrl ? "OK" : "MISSING"}`);
    console.log(`PORT: ${hasPort ? "SET" : "not set (optional)"}`);

    // Check Supabase environment variables (must come from env, not database)
    const hasSupabaseUrl = !!process.env.SUPABASE_URL;
    const hasSupabaseKey = !!process.env.SUPABASE_SERVICE_ROLE_KEY;
    console.log(`SUPABASE_URL: ${hasSupabaseUrl ? "OK" : "MISSING"}`);
    console.log(`SUPABASE_SERVICE_ROLE_KEY: ${hasSupabaseKey ? "OK" : "MISSING"}`);

    console.log("\n=== app_secrets Check ===");
    const rows = await db.select({ key: appSecrets.key }).from(appSecrets);
    const keys = new Set(rows.map((r) => r.key));

    const missingRequired = REQUIRED_SECRET_KEYS.filter((k) => !keys.has(k));
    console.log(`Required secrets missing: ${missingRequired.length}`);
    if (missingRequired.length > 0) {
      console.log(missingRequired.map((k) => `- ${k}`).join("\n"));
    }

    const presentOptional = OPTIONAL_PROVIDER_KEYS.filter((k) => keys.has(k));
    const missingOptional = OPTIONAL_PROVIDER_KEYS.filter((k) => !keys.has(k));

    console.log(`\nProvider secrets present: ${presentOptional.length}`);
    if (presentOptional.length > 0) {
      console.log(presentOptional.map((k) => `- ${k}`).join("\n"));
    }

    console.log(`\nProvider secrets missing: ${missingOptional.length}`);
    if (missingOptional.length > 0) {
      console.log(missingOptional.map((k) => `- ${k}`).join("\n"));
    }

    process.exit(0);
  } catch (error) {
    console.error("❌ Failed to check production readiness:", error);
    process.exit(1);
  }
}

main();
