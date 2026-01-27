CREATE TABLE IF NOT EXISTS "subscription_plans" (
  "id" varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  "name" text NOT NULL UNIQUE,
  "display_name" text NOT NULL,
  "monthly_price" numeric(10,2) NOT NULL DEFAULT 0,
  "yearly_price" numeric(10,2) NOT NULL DEFAULT 0,
  "description" text,
  "features" text[] DEFAULT ARRAY[]::text[],
  "badges" jsonb DEFAULT '{}'::jsonb,
  "service_limit" integer NOT NULL DEFAULT 0,
  "is_active" boolean NOT NULL DEFAULT true,
  "created_at" timestamp NOT NULL DEFAULT now(),
  "updated_at" timestamp NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "subscription_plans_name_idx" ON "subscription_plans" ("name");
CREATE INDEX IF NOT EXISTS "subscription_plans_active_idx" ON "subscription_plans" ("is_active");
--> statement-breakpoint
