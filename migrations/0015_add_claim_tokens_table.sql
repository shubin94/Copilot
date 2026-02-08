-- Create claim_tokens table for admin-created claimable detective accounts
CREATE TABLE IF NOT EXISTS "claim_tokens" (
  "id" varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  "detective_id" varchar NOT NULL REFERENCES "detectives"("id") ON DELETE CASCADE,
  "token_hash" text NOT NULL,
  "expires_at" timestamp NOT NULL,
  "used_at" timestamp,
  "created_at" timestamp NOT NULL DEFAULT now(),
  "updated_at" timestamp NOT NULL DEFAULT now()
);

-- Create indexes for efficient lookups
CREATE INDEX IF NOT EXISTS "claim_tokens_detective_id_idx" ON "claim_tokens" ("detective_id");
CREATE INDEX IF NOT EXISTS "claim_tokens_expires_at_idx" ON "claim_tokens" ("expires_at");
CREATE INDEX IF NOT EXISTS "claim_tokens_used_at_idx" ON "claim_tokens" ("used_at");
