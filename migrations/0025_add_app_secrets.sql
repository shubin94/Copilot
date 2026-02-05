-- App secrets table for super-admin managed API keys (e.g. SendGrid, Stripe, PayPal)
-- Values are stored in DB; env vars can override at runtime if needed.

CREATE TABLE IF NOT EXISTS app_secrets (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL DEFAULT '',
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE app_secrets IS 'Admin-managed API keys and secrets; super admin only.';
