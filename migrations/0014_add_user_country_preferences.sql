-- Add country and currency preferences to users table
ALTER TABLE "users" ADD COLUMN "preferred_country" text;
ALTER TABLE "users" ADD COLUMN "preferred_currency" text;

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS "users_preferred_country_idx" ON "users" ("preferred_country");
