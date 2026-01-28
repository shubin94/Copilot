ALTER TABLE detectives ADD COLUMN IF NOT EXISTS subscription_expires_at TIMESTAMP;
ALTER TABLE detectives ADD COLUMN IF NOT EXISTS pending_package_id VARCHAR;
ALTER TABLE detectives ADD COLUMN IF NOT EXISTS pending_billing_cycle TEXT;
