/**
 * Central secrets loader. All application credentials are read from the database (app_secrets).
 * Values are stored encrypted at rest; decrypted in memory only. Never log decrypted values.
 */

import { db } from "../../db/index.ts";
import { appSecrets } from "../../shared/schema.ts";
import { decryptSecret } from "./secretsCrypto.ts";

/** Stable keys for every credential in scope. Single source of truth for admin/app-secrets. */
export const SECRET_KEYS = [
  "SERVER_HOST",
  "GOOGLE_OAUTH_CLIENT_ID",
  "GOOGLE_OAUTH_CLIENT_SECRET",
  "SESSION_SECRET",
  "BASE_URL",
  "SUPABASE_URL",
  "SUPABASE_SERVICE_ROLE_KEY",
  "SENDGRID_API_KEY",
  "SENDGRID_FROM_EMAIL",
  "SMTP_HOST",
  "SMTP_PORT",
  "SMTP_SECURE",
  "SMTP_USER",
  "SMTP_PASS",
  "SMTP_FROM_EMAIL",
  "SENDPULSE_API_ID",
  "SENDPULSE_API_SECRET",
  "SENDPULSE_SENDER_EMAIL",
  "SENDPULSE_SENDER_NAME",
  "SENDPULSE_ENABLED",
  "RAZORPAY_KEY_ID",
  "RAZORPAY_KEY_SECRET",
  "PAYPAL_CLIENT_ID",
  "PAYPAL_CLIENT_SECRET",
  "PAYPAL_MODE",
  "GEMINI_API_KEY",
] as const;

export type SecretKey = (typeof SECRET_KEYS)[number];

let cache: Record<string, string> | null = null;

/**
 * Load all secrets from DB into cache. Must be called before any module that uses getSecret (e.g. config, app).
 */
export async function loadAllSecrets(): Promise<void> {
  try {
    const rows = await db.select().from(appSecrets);
    cache = {};
    for (const r of rows) {
      if (r.key != null && r.value != null) {
        try {
          cache[r.key] = decryptSecret(String(r.value));
        } catch (decErr) {
          const msg = decErr instanceof Error ? decErr.message : String(decErr);
          if (/APP_SECRETS_ENCRYPTION_KEY|SESSION_SECRET/i.test(msg)) {
            console.warn("[secretsLoader] Encryption key not set. Set APP_SECRETS_ENCRYPTION_KEY or SESSION_SECRET to use stored secrets.");
            cache = {};
            return;
          }
          cache[r.key] = String(r.value);
        }
      }
    }
  } catch (e) {
    console.warn("[secretsLoader] Failed to load app_secrets (using env fallback):", (e as Error).message);
    cache = {};
  }
}

/**
 * Get a secret by key. DB value takes priority; if missing, process.env is used.
 * Sync; requires loadAllSecrets() to have been called first.
 */
export function getSecret(key: string): string {
  const fromDb = cache != null ? cache[key] : undefined;
  if (fromDb != null && fromDb.trim() !== "") return fromDb;
  const fromEnv = process.env[key];
  return fromEnv != null ? String(fromEnv) : "";
}

export function getSecretNumber(key: string, fallback: number | undefined): number | undefined {
  const v = getSecret(key);
  if (v === "") return fallback;
  const n = Number(v);
  return Number.isNaN(n) ? fallback : n;
}

export function getSecretBool(key: string): boolean {
  return getSecret(key).toLowerCase() === "true";
}

/** Clear cache so next getSecret re-reads from DB (e.g. after admin updates). */
export function clearAppSecretsCache(): void {
  cache = null;
}
