-- Migration: add password_reset_tokens table
-- Run: apply this migration in your DB migration tool before deploying

CREATE TABLE IF NOT EXISTS public.password_reset_tokens (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id varchar NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  token_hash text NOT NULL,
  expires_at timestamp NOT NULL,
  used_at timestamp NULL,
  created_at timestamp NOT NULL DEFAULT now(),
  updated_at timestamp NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS password_reset_tokens_user_id_idx ON public.password_reset_tokens (user_id);
CREATE INDEX IF NOT EXISTS password_reset_tokens_expires_at_idx ON public.password_reset_tokens (expires_at);
CREATE INDEX IF NOT EXISTS password_reset_tokens_used_at_idx ON public.password_reset_tokens (used_at);
