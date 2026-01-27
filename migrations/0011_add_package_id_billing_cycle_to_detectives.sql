-- Add subscription_package_id and billing_cycle to detectives table
ALTER TABLE detectives 
ADD COLUMN subscription_package_id TEXT,
ADD COLUMN billing_cycle TEXT,
ADD COLUMN subscription_activated_at TIMESTAMP;
