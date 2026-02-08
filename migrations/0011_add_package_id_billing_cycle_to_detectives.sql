-- Add subscription_package_id and billing_cycle to detectives table
DO $$ BEGIN
	IF EXISTS (
		SELECT 1 FROM information_schema.tables
		WHERE table_schema = 'public'
		AND table_name = 'detectives'
	) THEN
		ALTER TABLE detectives ADD COLUMN IF NOT EXISTS subscription_package_id TEXT;
		ALTER TABLE detectives ADD COLUMN IF NOT EXISTS billing_cycle TEXT;
		ALTER TABLE detectives ADD COLUMN IF NOT EXISTS subscription_activated_at TIMESTAMP;
	END IF;
END $$;
