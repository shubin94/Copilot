/**
 * Load auth and API secrets from app_secrets table.
 * Env vars are used as fallback when DB has no value.
 * Only DATABASE_URL is required in env; all other secrets can live in DB.
 */
import { db } from "../../db/index.ts";
import { appSecrets } from "../../shared/schema.ts";
import { config } from "../config.ts";

const KEY_MAP: Record<string, (v: string) => void> = {
  host: (v) => { (config as any).server.host = v; },
  google_client_id: (v) => { (config as any).google.clientId = v; },
  google_client_secret: (v) => { (config as any).google.clientSecret = v; },
  session_secret: (v) => { (config as any).session.secret = v; },
  base_url: (v) => { (config as any).baseUrl = v; },
  supabase_url: (v) => { (config as any).supabase.url = v; },
  supabase_service_role_key: (v) => { (config as any).supabase.serviceRoleKey = v; },
  sendgrid_api_key: (v) => { (config as any).email.sendgridApiKey = v; },
  sendgrid_from_email: (v) => { (config as any).email.sendgridFromEmail = v; },
  smtp_host: (v) => { (config as any).email.smtpHost = v; },
  smtp_port: (v) => { (config as any).email.smtpPort = v ? Number(v) : undefined; },
  smtp_secure: (v) => { (config as any).email.smtpSecure = v === "true"; },
  smtp_user: (v) => { (config as any).email.smtpUser = v; },
  smtp_pass: (v) => { (config as any).email.smtpPass = v; },
  smtp_from_email: (v) => { (config as any).email.smtpFromEmail = v; },
  sendpulse_api_id: (v) => { (config as any).sendpulse.apiId = v; },
  sendpulse_api_secret: (v) => { (config as any).sendpulse.apiSecret = v; },
  sendpulse_sender_email: (v) => { (config as any).sendpulse.senderEmail = v; },
  sendpulse_sender_name: (v) => { (config as any).sendpulse.senderName = v; },
  sendpulse_enabled: (v) => { (config as any).sendpulse.enabled = v === "true"; },
  razorpay_key_id: (v) => { (config as any).razorpay.keyId = v; },
  razorpay_key_secret: (v) => { (config as any).razorpay.keySecret = v; },
  paypal_client_id: (v) => { (config as any).paypal.clientId = v; },
  paypal_client_secret: (v) => { (config as any).paypal.clientSecret = v; },
  paypal_mode: (v) => { (config as any).paypal.mode = (v || "sandbox") as "sandbox" | "live"; },
  gemini_api_key: (v) => { (config as any).gemini.apiKey = v; },
};

export async function loadSecretsFromDatabase(): Promise<void> {
  try {
    const rows = await db.select().from(appSecrets);
    for (const row of rows) {
      const setter = KEY_MAP[row.key];
      if (setter && row.value) {
        setter(row.value);
      }
    }
  } catch (e) {
    console.warn("[secrets] Could not load app_secrets (table may not exist yet):", (e as Error).message);
  }
}
