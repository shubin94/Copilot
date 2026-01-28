-- Add missing plan timestamp columns
ALTER TABLE detectives ADD COLUMN IF NOT EXISTS plan_activated_at TIMESTAMP;
ALTER TABLE detectives ADD COLUMN IF NOT EXISTS plan_expires_at TIMESTAMP;
