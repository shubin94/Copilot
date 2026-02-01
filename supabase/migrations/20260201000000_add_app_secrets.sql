-- App Secrets: store auth and API credentials in DB so they're never in git
-- Only DATABASE_URL is required in env; all other secrets loaded from this table
CREATE TABLE IF NOT EXISTS public.app_secrets (
  key text PRIMARY KEY,
  value text NOT NULL DEFAULT '',
  updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);

-- RLS: service_role can do everything; restrict anon/authenticated
ALTER TABLE public.app_secrets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access to app_secrets"
  ON public.app_secrets FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- No access for anon or authenticated (secrets are server-only)
CREATE POLICY "No anon access to app_secrets"
  ON public.app_secrets FOR SELECT
  TO anon
  USING (false);

CREATE POLICY "No authenticated access to app_secrets"
  ON public.app_secrets FOR SELECT
  TO authenticated
  USING (false);

-- Grant to service_role (server uses this via connection string)
GRANT ALL ON public.app_secrets TO service_role;

COMMENT ON TABLE public.app_secrets IS 'Server-side auth and API credentials. Loaded at startup. Never expose to client.';
