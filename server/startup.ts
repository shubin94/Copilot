import { db, pool } from "../db/index.ts";
import { appPolicies, siteSettings, appSecrets } from "../shared/schema.ts";
import { inArray, sql } from "drizzle-orm";
import { config } from "./config.ts";
import { getPaymentGateway } from "./services/paymentGateway.ts";

const REQUIRED_TABLES = ["app_secrets", "app_policies", "site_settings"] as const;

/** Check that required tables exist. In production, fail with actionable error. */
async function checkTablesExist(): Promise<void> {
  const result = await pool.query<{ table_name: string }>(
    `SELECT table_name FROM information_schema.tables 
     WHERE table_schema = 'public' AND table_name = ANY($1::text[])`,
    [REQUIRED_TABLES]
  );
  const found = new Set(result.rows.map((r) => r.table_name));
  const missing = REQUIRED_TABLES.filter((t) => !found.has(t));

  if (missing.length > 0) {
    const msg = `Missing required table(s): ${missing.join(", ")}. Run migrations: supabase/migrations/20260201000000_add_app_secrets.sql (app_secrets), migrations/0003_add_app_policies.sql (app_policies), migrations/0004_seed_site_settings.sql (site_settings). Do NOT auto-create in production.`;
    throw new Error(msg);
  }
}

export async function validateDatabase(): Promise<void> {
  const isProduction = process.env.NODE_ENV === "production";
  
  try {
    // 1. Explicit table existence check
    await checkTablesExist();
  } catch (e) {
    // In dev mode, allow startup without database
    if (!isProduction) {
      console.warn("[dev] Database validation skipped - database unavailable");
      return;
    }
    throw e;
  }

  const requiredPolicies = [
    "pagination_default_limit",
    "pagination_default_offset",
    "visibility_requirements",
    "post_approval_status",
    "pricing_constraints",
  ];

  const policyRows = await db.select().from(appPolicies).where(inArray(appPolicies.key, requiredPolicies));
  const present = new Set(policyRows.map((r: any) => r.key));
  const missingPolicies = requiredPolicies.filter((k) => !present.has(k));

  const [{ count: settingsCount }] = await db.select({ count: sql<number>`count(*)` }).from(siteSettings);
  const siteSettingsCount = Number(settingsCount);

  if (isProduction) {
    await validateRequiredSecretsProd();

    if (missingPolicies.length > 0) {
      throw new Error(`Missing required app_policies rows: ${missingPolicies.join(", ")}. Seed app_policies table (see migrations/0003_add_app_policies.sql). Do NOT auto-create in production.`);
    }
    if (siteSettingsCount === 0) {
      throw new Error("site_settings is empty. Run: npx tsx scripts/seed-site-settings.ts. Do NOT auto-create in production.");
    }
    if (siteSettingsCount !== 1) {
      throw new Error("site_settings must contain exactly one row. Fix data integrity before production deployment.");
    }
  } else {
    if (missingPolicies.length > 0) {
      console.warn(`[startup] Missing policies (dev/test): ${missingPolicies.join(", ")}`);
    }
    if (siteSettingsCount === 0) {
      console.warn("[startup] Missing site settings row (dev/test)");
    }
  }

  // 3. Payment gateways: in production, if enabled, must use live keys/mode (no silent sandbox fallback)
  if (config.env.isProd) {
    await validatePaymentGateways();
  }

  // 4. Google OAuth: in production, if enabled, must have valid BASE_URL (no localhost)
  if (config.env.isProd) {
    validateGoogleOAuth();
  }
}

async function validateRequiredSecretsProd(): Promise<void> {
  const requiredSecretKeys = [
    "session_secret",
    "base_url",
    "csrf_allowed_origins",
    "host",
    // Note: supabase_service_role_key removed - Supabase credentials must come from environment variables only
  ] as const;

  const emailKeys = [
    "smtp_host",
    "smtp_from_email",
  ] as const;

  const rows = await db
    .select({ key: appSecrets.key, value: appSecrets.value })
    .from(appSecrets)
    .where(inArray(appSecrets.key, [...requiredSecretKeys, ...emailKeys]));

  const values = new Map(rows.map((r) => [r.key, (r.value ?? "").trim()]));

  for (const key of requiredSecretKeys) {
    if (!values.get(key)) {
      throw new Error(`Set ${key} in app_secrets (env secrets are disabled in production)`);
    }
  }

  const hasSmtp = !!values.get("smtp_host") && !!values.get("smtp_from_email");

  if (!hasSmtp) {
    throw new Error("SMTP must be configured in app_secrets (smtp_host + smtp_from_email).");
  }
}

/**
 * In production: verify enabled payment gateways use live keys/mode.
 * - Razorpay: keys must exist and keyId must NOT start with rzp_test_
 * - PayPal: when enabled, mode must be explicitly 'live'
 * Gateways can be disabled via payment_gateways.is_enabled = false without breaking startup.
 */
async function validatePaymentGateways(): Promise<void> {
  const razorpay = await getPaymentGateway("razorpay");
  const paypal = await getPaymentGateway("paypal");

  if (razorpay) {
    const keyId = razorpay.config?.keyId || config.razorpay.keyId || "";
    const keySecret = razorpay.config?.keySecret || config.razorpay.keySecret || "";
    if (!keyId?.trim() || !keySecret?.trim()) {
      throw new Error(
        "Razorpay is enabled but keys are missing. Set razorpay_key_id and razorpay_key_secret in app_secrets (or env) or disable Razorpay in Admin > Payment Gateways."
      );
    }
    if (keyId.startsWith("rzp_test_")) {
      throw new Error(
        "Razorpay is enabled with TEST/sandbox keys (rzp_test_*) in production. Use LIVE keys (rzp_live_*) or disable Razorpay in Admin > Payment Gateways. Do NOT use test keys in production."
      );
    }
  }

  if (paypal) {
    const clientId = paypal.config?.clientId || config.paypal.clientId || "";
    const clientSecret = paypal.config?.clientSecret || config.paypal.clientSecret || "";
    const mode = (paypal.config?.mode || config.paypal.mode || "").toLowerCase();

    if (!clientId?.trim() || !clientSecret?.trim()) {
      throw new Error(
        "PayPal is enabled but credentials are missing. Set paypal_client_id and paypal_client_secret in app_secrets (or env) or disable PayPal in Admin > Payment Gateways."
      );
    }
    if (mode !== "live") {
      throw new Error(
        "PayPal is enabled in production but mode is not 'live' (current: " +
          (mode || "(defaults to sandbox)") +
          "). Set paypal_mode=live in app_secrets or Admin > Payment Gateways, or disable PayPal. Do NOT use sandbox in production."
      );
    }
  }
}

/**
 * Google OAuth: in production, if enabled (clientId set), require credentials and valid BASE_URL.
 * - BASE_URL must be set and used for redirect URIs (no hardcoded localhost)
 * - No localhost/127.0.0.1 redirects in production
 * OAuth can be fully disabled (clientId empty) without breaking email/password auth.
 */
function validateGoogleOAuth(): void {
  const { clientId, clientSecret } = config.google;
  const baseUrl = (config.baseUrl || "").trim();

  if (!clientId?.trim()) {
    return; // OAuth disabled, no validation needed
  }

  if (!clientSecret?.trim()) {
    throw new Error(
      "Google OAuth is enabled but GOOGLE_CLIENT_SECRET is missing. Set google_client_secret in app_secrets (or env) or clear google_client_id to disable Google OAuth."
    );
  }

  if (!baseUrl) {
    throw new Error(
      "Google OAuth is enabled but BASE_URL is missing. Set base_url in app_secrets (or env) for OAuth redirect URIs, or clear google_client_id to disable Google OAuth."
    );
  }

  let parsed: URL;
  try {
    parsed = new URL(baseUrl);
  } catch {
    throw new Error(
      "Google OAuth BASE_URL is invalid: " + baseUrl + ". Must be a valid URL (e.g. https://yourdomain.com)."
    );
  }

  const hostname = parsed.hostname?.toLowerCase() || "";
  if (
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    hostname.startsWith("localhost.") ||
    hostname.endsWith(".localhost")
  ) {
    throw new Error(
      "Google OAuth is enabled but BASE_URL uses localhost (" +
        baseUrl +
        "). Production must use a public HTTPS URL. Set base_url to your production domain or disable Google OAuth."
    );
  }

  if (parsed.protocol !== "https:") {
    throw new Error(
      "Google OAuth BASE_URL must use HTTPS in production: " +
        baseUrl +
        ". Set base_url to https://yourdomain.com or disable Google OAuth."
    );
  }
}
