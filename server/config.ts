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
    useMemory: !isProd || (process.env.SESSION_USE_MEMORY === "true"),
    secret: isProd ? (process.env.SESSION_SECRET || "") : (process.env.SESSION_SECRET || "dev-session-secret"),
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
    url: isProd ? (process.env.SUPABASE_URL || "") : (process.env.SUPABASE_URL || ""),
    serviceRoleKey: isProd ? (process.env.SUPABASE_SERVICE_ROLE_KEY || "") : (process.env.SUPABASE_SERVICE_ROLE_KEY || ""),
  },
  csrf: {
    allowedOrigins: getStringList(
      "CSRF_ALLOWED_ORIGINS",
      isProd
        ? []
        : [
            "http://localhost:5000",
            "http://127.0.0.1:5000",
            "http://localhost:5173",
            "http://127.0.0.1:5173",
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
  deepseek: {
    apiKey: process.env.DEEPSEEK_API_KEY || "",
  },
  google: {
    clientId: process.env.GOOGLE_CLIENT_ID || "",
    clientSecret: process.env.GOOGLE_CLIENT_SECRET || "",
  },
  sentryDsn: "",
  // Base URL for OAuth redirect_uri (e.g. https://yoursite.com or http://localhost:5000)
  baseUrl: process.env.BASE_URL || (isProd ? "" : "http://localhost:5000"),
};

export function validateConfig(secretsLoaded: boolean = true) {
  const isProduction = process.env.NODE_ENV === "production";
  
  // In non-production mode with no database, apply safe defaults
  if (!isProduction && !secretsLoaded) {
    if (!config.server.host || String(config.server.host).trim() === "") {
      config.server.host = "127.0.0.1";
      console.log("[dev] Using fallback host because DB/app_secrets are unavailable");
    }
    return; // Skip strict validation in dev when DB unavailable
  }
  
  // Only run strict validation in production
  if (!isProduction) {
    return; // Skip validation unless NODE_ENV=production
  }
  
  // Production validations (strict)
  // Server host must be provided in production (env HOST or app_secrets host)
  if (!config.server.host || String(config.server.host).trim() === "") {
    throw new Error("Missing required: HOST (set in env or app_secrets)");
  }

  // Session secret required (env SESSION_SECRET or app_secrets session_secret)
  if (!config.session.secret || String(config.session.secret).trim() === "") {
    throw new Error("Missing required: SESSION_SECRET (set in env or app_secrets)");
  }

  // Email: require at least one provider configured fully
  const hasSendgrid = !!config.email.sendgridApiKey && !!config.email.sendgridFromEmail;
  const hasSmtp = !!config.email.smtpHost && !!config.email.smtpFromEmail;
  const hasSendpulse = !!config.sendpulse.apiId && !!config.sendpulse.apiSecret && !!config.sendpulse.senderEmail;
  if (!hasSendgrid && !hasSmtp && !hasSendpulse) {
    throw new Error("Email not configured: set SENDGRID_API_KEY + SENDGRID_FROM_EMAIL or SMTP_HOST + SMTP_FROM_EMAIL or SENDPULSE_API_ID + SENDPULSE_API_SECRET + SENDPULSE_SENDER_EMAIL (env or app_secrets)");
  }

  // Supabase required for asset storage (env or app_secrets)
  if (!config.supabase.url || !config.supabase.serviceRoleKey) {
    throw new Error("Supabase not configured: set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (env or app_secrets)");
  }

  // Payment gateways: validated separately in validatePaymentGateways() after DB is available.
  // Gateways can be disabled via payment_gateways table; no hard requirement here.
}
