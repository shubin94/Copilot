-- Email Template Management System
-- Centralized storage for all email templates
-- Allows Super Admin to manage email content without code changes

CREATE TABLE IF NOT EXISTS email_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key VARCHAR(255) NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT,
  subject TEXT NOT NULL,
  body TEXT NOT NULL,
  sendpulse_template_id INTEGER,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS email_templates_key_idx ON email_templates(key);
CREATE INDEX IF NOT EXISTS email_templates_is_active_idx ON email_templates(is_active);
CREATE INDEX IF NOT EXISTS email_templates_created_at_idx ON email_templates(created_at);
