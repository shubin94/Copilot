import "dotenv/config";
import { getSecret, getSecretNumber, getSecretBool } from "./lib/secretsLoader.ts";

type NodeEnv = "production" | "development" | "test" | undefined;

const env: NodeEnv = process.env.NODE_ENV as NodeEnv;
const isProd = env === "production";
const isDev = env === "development";
const isTest = env === "test";

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v || v.trim() === "") {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return v;
}

function getNumber(name: string, fallback?: number): number | undefined {
  const v = process.env[name];
  if (v === undefined || v === null || v === "") return fallback;
  const n = Number(v);
  if (Number.isNaN(n)) throw new Error(`Invalid number for ${name}`);
  return n;
}

function getStringList(name: string, fallback: string[]): string[] {
  const v = process.env[name];
  if (!v) return fallback;
  return v
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

/** All credentials from DB (app_secrets) via central loader; DB overrides env. Bootstrap: only DATABASE_URL and PORT from env. */
export const config = {
  env: { isProd, isDev, isTest },
  server: {
    port: getNumber("PORT", isProd ? undefined : 5000)!,
    host: getSecret("SERVER_HOST") || (isProd ? (undefined as any) : "127.0.0.1"),
  },
  db: {
    url: isProd ? requireEnv("DATABASE_URL") : (process.env.DATABASE_URL || ""),
  },
  rateLimit: {
    windowMs: getNumber("RATE_LIMIT_WINDOW_MS", 15 * 60 * 1000)!,
    max: getNumber("RATE_LIMIT_MAX", isProd ? 100 : 1000)!,
  },
  session: {
    useMemory: isDev || (process.env.SESSION_USE_MEMORY === "true" && !isProd),
    secret: getSecret("SESSION_SECRET") || (isProd ? "" : "dev-session-secret"),
    ttlMs: getNumber("SESSION_TTL_MS", 1000 * 60 * 60 * 24 * 7)!,
    secureCookies: isProd,
  },
  baseUrl: getSecret("BASE_URL"),
  googleOAuth: {
    clientId: getSecret("GOOGLE_OAUTH_CLIENT_ID"),
    clientSecret: getSecret("GOOGLE_OAUTH_CLIENT_SECRET"),
  },
  email: {
    sendgridApiKey: getSecret("SENDGRID_API_KEY"),
    sendgridFromEmail: getSecret("SENDGRID_FROM_EMAIL"),
    smtpHost: getSecret("SMTP_HOST"),
    smtpPort: getSecretNumber("SMTP_PORT", undefined) ?? getNumber("SMTP_PORT", undefined),
    smtpSecure: getSecretBool("SMTP_SECURE") || process.env.SMTP_SECURE === "true",
    smtpUser: getSecret("SMTP_USER"),
    smtpPass: getSecret("SMTP_PASS"),
    smtpFromEmail: getSecret("SMTP_FROM_EMAIL"),
  },
  sendpulse: {
    apiId: getSecret("SENDPULSE_API_ID"),
    apiSecret: getSecret("SENDPULSE_API_SECRET"),
    senderEmail: getSecret("SENDPULSE_SENDER_EMAIL"),
    senderName: getSecret("SENDPULSE_SENDER_NAME"),
    enabled: getSecretBool("SENDPULSE_ENABLED") || process.env.SENDPULSE_ENABLED === "true",
  },
  supabase: {
    url: getSecret("SUPABASE_URL"),
    serviceRoleKey: getSecret("SUPABASE_SERVICE_ROLE_KEY"),
  },
  csrf: {
    allowedOrigins: getStringList(
      "CSRF_ALLOWED_ORIGINS",
      isProd
        ? []
        : [
            "http://localhost:5000",
            "http://127.0.0.1:5000",
          ],
    ),
  },
  razorpay: {
    keyId: getSecret("RAZORPAY_KEY_ID"),
    keySecret: getSecret("RAZORPAY_KEY_SECRET"),
  },
  paypal: {
    clientId: getSecret("PAYPAL_CLIENT_ID"),
    clientSecret: getSecret("PAYPAL_CLIENT_SECRET"),
    mode: (getSecret("PAYPAL_MODE") || "sandbox") as "sandbox" | "live",
  },
  gemini: {
    apiKey: getSecret("GEMINI_API_KEY"),
  },
};

export function validateConfig() {
  if (isProd) {
    if (!config.session.secret) throw new Error("SESSION_SECRET not set (Admin → App Secrets)");
    if (!config.server.host) throw new Error("Missing required: SERVER_HOST (Admin → App Secrets)");
    const hasSendgrid = !!config.email.sendgridApiKey && !!config.email.sendgridFromEmail;
    const hasSmtp = !!config.email.smtpHost && !!config.email.smtpFromEmail;
    const hasSendpulse = !!config.sendpulse.apiId && !!config.sendpulse.apiSecret && !!config.sendpulse.senderEmail;
    if (!hasSendgrid && !hasSmtp && !hasSendpulse) {
      throw new Error("Email not configured: set in Admin → App Secrets (SendGrid, SMTP, or SendPulse)");
    }
    if (!config.supabase.url || !config.supabase.serviceRoleKey) {
      throw new Error("Supabase not configured: set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in Admin → App Secrets");
    }
    if (!config.razorpay.keyId || !config.razorpay.keySecret) {
      throw new Error("Razorpay not configured: set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET in Admin → App Secrets");
    }
  }
}
