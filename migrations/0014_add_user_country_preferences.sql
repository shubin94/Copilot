-- Add country and currency preferences to users table
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'users') THEN
    ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "preferred_country" text;
    ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "preferred_currency" text;
  END IF;
END $$;

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS "users_preferred_country_idx" ON "users" ("preferred_country");
