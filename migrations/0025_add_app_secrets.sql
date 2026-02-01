-- App Secrets: store auth and API credentials in DB so they're never in git
CREATE TABLE IF NOT EXISTS app_secrets (
  key text PRIMARY KEY,
  value text NOT NULL DEFAULT '',
  updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);
