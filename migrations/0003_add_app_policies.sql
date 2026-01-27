CREATE TABLE IF NOT EXISTS "app_policies" (
  "key" text PRIMARY KEY,
  "value" jsonb NOT NULL,
  "updated_at" timestamp NOT NULL DEFAULT now()
);
--> statement-breakpoint
INSERT INTO "app_policies" ("key","value")
VALUES
  ('pagination_default_limit', '{"value":20}'::jsonb),
  ('pagination_default_offset', '{"value":0}'::jsonb),
  ('search_default_sort', '{"value":"recent"}'::jsonb),
  ('visibility_requirements', '{"requireImages":true,"requireActiveDetective":true}'::jsonb),
  ('post_approval_status', '{"value":"active"}'::jsonb),
  ('pricing_constraints', '{"offerLessThanBase":true}'::jsonb)
ON CONFLICT ("key") DO NOTHING;
