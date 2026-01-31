import "dotenv/config";

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

export const config = {
  env: { isProd, isDev, isTest },
  server: {
    port: getNumber("PORT", isProd ? undefined : 5000)!,
    host: process.env.HOST || (isProd ? undefined as any : "127.0.0.1"),
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
    secret: isProd ? requireEnv("SESSION_SECRET") : (process.env.SESSION_SECRET || "dev-session-secret"),
    ttlMs: getNumber("SESSION_TTL_MS", 1000 * 60 * 60 * 24 * 7)!,
    secureCookies: isProd,
  },
  email: {
    sendgridApiKey: process.env.SENDGRID_API_KEY || "",
    sendgridFromEmail: process.env.SENDGRID_FROM_EMAIL || "",
    smtpHost: process.env.SMTP_HOST || "",
    smtpPort: getNumber("SMTP_PORT", undefined),
    smtpSecure: process.env.SMTP_SECURE === "true",
    smtpUser: process.env.SMTP_USER || "",
    smtpPass: process.env.SMTP_PASS || "",
    smtpFromEmail: process.env.SMTP_FROM_EMAIL || "",
  },
  sendpulse: {
    apiId: process.env.SENDPULSE_API_ID || "",
    apiSecret: process.env.SENDPULSE_API_SECRET || "",
    senderEmail: process.env.SENDPULSE_SENDER_EMAIL || "",
    senderName: process.env.SENDPULSE_SENDER_NAME || "",
    enabled: process.env.SENDPULSE_ENABLED === "true",
  },
  supabase: {
    url: isProd ? requireEnv("SUPABASE_URL") : (process.env.SUPABASE_URL || ""),
    serviceRoleKey: isProd ? requireEnv("SUPABASE_SERVICE_ROLE_KEY") : (process.env.SUPABASE_SERVICE_ROLE_KEY || ""),
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
    keyId: process.env.RAZORPAY_KEY_ID || "",
    keySecret: process.env.RAZORPAY_KEY_SECRET || "",
  },
  paypal: {
    clientId: process.env.PAYPAL_CLIENT_ID || "",
    clientSecret: process.env.PAYPAL_CLIENT_SECRET || "",
    mode: (process.env.PAYPAL_MODE || "sandbox") as "sandbox" | "live",
  },
  gemini: {
    apiKey: process.env.GEMINI_API_KEY || "",
  },
};

export function validateConfig() {
  if (isProd) {
    // Server host must be provided in production
    if (!config.server.host) throw new Error("Missing required environment variable: HOST");

    // Email: require at least one provider configured fully
    const hasSendgrid = !!config.email.sendgridApiKey && !!config.email.sendgridFromEmail;
    const hasSmtp = !!config.email.smtpHost && !!config.email.smtpFromEmail;
    const hasSendpulse = !!config.sendpulse.apiId && !!config.sendpulse.apiSecret && !!config.sendpulse.senderEmail;
    if (!hasSendgrid && !hasSmtp && !hasSendpulse) {
      throw new Error("Email not configured: set SENDGRID_API_KEY + SENDGRID_FROM_EMAIL or SMTP_HOST + SMTP_FROM_EMAIL or SENDPULSE_API_ID + SENDPULSE_API_SECRET + SENDPULSE_SENDER_EMAIL");
    }

    // Supabase required for asset storage
    if (!config.supabase.url || !config.supabase.serviceRoleKey) {
      throw new Error("Supabase not configured: set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY");
    }

    if (!config.razorpay.keyId || !config.razorpay.keySecret) {
      throw new Error("Razorpay not configured: set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET");
    }
  }
}
