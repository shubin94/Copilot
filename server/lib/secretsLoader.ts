/**
 * Load auth and API secrets from app_secrets table.
 * Env vars are used as fallback when DB has no value.
 * 
 * NOTE: Supabase credentials (SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY) are NEVER
 * loaded from database - they must come exclusively from environment variables.
 * This ensures single source of truth and prevents production credential leaks.
 * 
 * Only DATABASE_URL and Supabase credentials are required in env;
 * all other secrets can live in DB.
 */
import { db } from "../../db/index.ts";
import { appSecrets } from "../../shared/schema.ts";
import { config } from "../config.ts";

// Track if secrets were loaded successfully (used for dev fallbacks)
export let secretsLoadedSuccessfully = false;

const KEY_MAP: Record<string, (v: string) => void> = {
  host: (v) => { (config as any).server.host = v; },
  google_client_id: (v) => { (config as any).google.clientId = v; },
  google_client_secret: (v) => { (config as any).google.clientSecret = v; },
  session_secret: (v) => { (config as any).session.secret = v; },
  base_url: (v) => { (config as any).baseUrl = v; },
  csrf_allowed_origins: (v) => {
    const list = v.split(",").map((item) => item.trim()).filter(Boolean);
    (config as any).csrf.allowedOrigins = list;
  },
  // Supabase credentials removed - must come from environment variables only
  smtp_host: (v) => { (config as any).email.smtpHost = v; },
  smtp_port: (v) => { (config as any).email.smtpPort = v ? Number(v) : undefined; },
  smtp_secure: (v) => { (config as any).email.smtpSecure = v === "true"; },
  smtp_user: (v) => { (config as any).email.smtpUser = v; },
  smtp_pass: (v) => { (config as any).email.smtpPass = v; },
  smtp_from_email: (v) => { (config as any).email.smtpFromEmail = v; },
  razorpay_key_id: (v) => { (config as any).razorpay.keyId = v; },
  razorpay_key_secret: (v) => { (config as any).razorpay.keySecret = v; },
  paypal_client_id: (v) => { (config as any).paypal.clientId = v; },
  paypal_client_secret: (v) => { (config as any).paypal.clientSecret = v; },
  paypal_mode: (v) => { (config as any).paypal.mode = (v || "sandbox") as "sandbox" | "live"; },
  deepseek_api_key: (v) => { (config as any).deepseek.apiKey = v; },
  sentry_dsn: (v) => { (config as any).sentryDsn = v; },
};

export async function loadSecretsFromDatabase(): Promise<void> {
  try {
    const rows = await db.select().from(appSecrets);
    const loadedKeys: string[] = [];
    for (const row of rows) {
      const setter = KEY_MAP[row.key];
      if (setter && row.value) {
        setter(row.value);
        loadedKeys.push(row.key);
      }
    }
    if (loadedKeys.length > 0) {
      console.log(`✅ Loaded ${loadedKeys.length} secrets from database:`, loadedKeys.join(", "));
    }
    secretsLoadedSuccessfully = true;
  } catch (e) {
    const errorMsg = e instanceof Error ? e.message : String(e);
    
    // In dev mode (not production), allow startup without database
    const isProduction = process.env.NODE_ENV === "production";
    
    if (!isProduction) {
      console.warn("[dev] Database unavailable - using fallback configuration");
      secretsLoadedSuccessfully = false;
      return; // Continue startup in dev mode
    }
    
    // In production, database is required
    console.error("[secrets] Failed to load app_secrets:", errorMsg);
    throw e;
  }
}
