INSERT INTO "site_settings" ("id","logo_url","footer_links","updated_at")
SELECT gen_random_uuid(), NULL, '[]'::jsonb, now()
WHERE NOT EXISTS (SELECT 1 FROM "site_settings");
--> statement-breakpoint
