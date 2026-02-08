DO $$ BEGIN
	IF EXISTS (
		SELECT 1 FROM information_schema.tables
		WHERE table_schema = 'public'
		AND table_name = 'detectives'
	) THEN
		ALTER TABLE "detectives" ADD COLUMN IF NOT EXISTS "default_service_banner" text;
	END IF;
END $$;
--> statement-breakpoint
