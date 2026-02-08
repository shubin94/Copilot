-- Create access_pages table for employee access control
CREATE TABLE IF NOT EXISTS "access_pages" (
  "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "key" text NOT NULL UNIQUE,
  "name" text NOT NULL,
  "is_active" boolean NOT NULL DEFAULT true,
  "created_at" timestamp NOT NULL DEFAULT now(),
  "updated_at" timestamp NOT NULL DEFAULT now()
);

-- Create indexes
CREATE UNIQUE INDEX IF NOT EXISTS "access_pages_key_idx" ON "access_pages"("key");
CREATE INDEX IF NOT EXISTS "access_pages_is_active_idx" ON "access_pages"("is_active");

-- Create user_pages table for many-to-many relationship
CREATE TABLE IF NOT EXISTS "user_pages" (
  "user_id" varchar NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "page_id" varchar NOT NULL REFERENCES "access_pages"("id") ON DELETE CASCADE,
  "granted_by" varchar REFERENCES "users"("id") ON DELETE SET NULL,
  "granted_at" timestamp NOT NULL DEFAULT now(),
  CONSTRAINT "user_pages_pk" PRIMARY KEY ("user_id", "page_id")
);

-- Create indexes
CREATE INDEX IF NOT EXISTS "user_pages_user_id_idx" ON "user_pages"("user_id");
CREATE INDEX IF NOT EXISTS "user_pages_page_id_idx" ON "user_pages"("page_id");
CREATE INDEX IF NOT EXISTS "user_pages_granted_by_idx" ON "user_pages"("granted_by");

-- Seed access pages for employee management
INSERT INTO "access_pages" ("key", "name", "is_active") 
VALUES 
  ('dashboard', 'Dashboard', true),
  ('employees', 'Employees Management', true),
  ('detectives', 'Detectives Management', true),
  ('services', 'Services Management', true),
  ('users', 'Users Management', true),
  ('settings', 'Settings', true),
  ('reports', 'Reports', true),
  ('payments', 'Payments & Finance', true),
  ('cms', 'Content Management System', true)
ON CONFLICT ("key") DO UPDATE SET
  "name" = EXCLUDED."name",
  "is_active" = EXCLUDED."is_active";

