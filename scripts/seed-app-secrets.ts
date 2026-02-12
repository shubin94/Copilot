/**
 * One-time seed: copy auth/API secrets from env into app_secrets table.
 * Run after deploying: npx tsx scripts/seed-app-secrets.ts
 * Only copies non-empty env values. Does not overwrite existing DB values.
 * 
 * NOTE: Supabase credentials are NOT seeded into the database.
 * They must be set via environment variables only (SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY).
 */
import "../server/lib/loadEnv";
import { db } from "../db/index.ts";
import { appSecrets } from "../shared/schema.ts";

const ENV_TO_KEY: Record<string, string> = {
  HOST: "host",
  GOOGLE_CLIENT_ID: "google_client_id",
  GOOGLE_CLIENT_SECRET: "google_client_secret",
  SESSION_SECRET: "session_secret",
  BASE_URL: "base_url",
  // Supabase credentials removed - must be set via environment variables only
  SMTP_HOST: "smtp_host",
  SMTP_PORT: "smtp_port",
  SMTP_SECURE: "smtp_secure",
  SMTP_USER: "smtp_user",
  SMTP_PASS: "smtp_pass",
  SMTP_FROM_EMAIL: "smtp_from_email",
  RAZORPAY_KEY_ID: "razorpay_key_id",
  RAZORPAY_KEY_SECRET: "razorpay_key_secret",
  PAYPAL_CLIENT_ID: "paypal_client_id",
  PAYPAL_CLIENT_SECRET: "paypal_client_secret",
  PAYPAL_MODE: "paypal_mode",
  GEMINI_API_KEY: "gemini_api_key",
};

async function main() {
  const existing = await db.select().from(appSecrets);
  const byKey = new Set(existing.map((r) => r.key));

  let added = 0;
  for (const [envName, key] of Object.entries(ENV_TO_KEY)) {
    const val = process.env[envName]?.trim();
    if (!val || byKey.has(key)) continue;

    await db.insert(appSecrets).values({
      key,
      value: val,
      updatedAt: new Date(),
    }).onConflictDoNothing({ target: appSecrets.key });
    byKey.add(key);
    added++;
    console.log(`  Added: ${key}`);
  }

  console.log(`\nDone. Added ${added} secret(s). Existing values were not overwritten.`);
  console.log("Restart the server to load secrets from DB.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
