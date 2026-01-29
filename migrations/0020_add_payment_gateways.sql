-- Migration: Add payment_gateways table for managing multiple payment providers
-- This allows admin to configure payment gateways through the UI

CREATE TABLE IF NOT EXISTS payment_gateways (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL UNIQUE, -- e.g., 'razorpay', 'stripe', 'paypal'
  display_name TEXT NOT NULL, -- e.g., 'Razorpay', 'Stripe', 'PayPal'
  is_enabled BOOLEAN DEFAULT false,
  is_test_mode BOOLEAN DEFAULT true,
  
  -- Configuration stored as encrypted JSON
  config JSONB NOT NULL DEFAULT '{}'::jsonb,
  
  -- Metadata
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  -- Optional: Track who modified (users.id is VARCHAR not INTEGER)
  updated_by VARCHAR REFERENCES users(id)
);

-- Create index for quick lookups
CREATE INDEX IF NOT EXISTS payment_gateways_enabled_idx ON payment_gateways(is_enabled);
CREATE INDEX IF NOT EXISTS payment_gateways_name_idx ON payment_gateways(name);

-- Insert default Razorpay configuration (disabled by default, admin needs to configure)
-- Note: Run this SQL to migrate existing .env keys to database:
-- UPDATE payment_gateways SET 
--   config = '{"keyId": "YOUR_KEY_ID", "keySecret": "YOUR_KEY_SECRET", "webhookSecret": ""}'::jsonb,
--   is_enabled = true 
-- WHERE name = 'razorpay';

INSERT INTO payment_gateways (name, display_name, is_enabled, is_test_mode, config)
VALUES 
  ('razorpay', 'Razorpay', false, true, '{
    "keyId": "",
    "keySecret": "",
    "webhookSecret": ""
  }'::jsonb)
ON CONFLICT (name) DO NOTHING;

-- Add updated_at trigger
CREATE OR REPLACE FUNCTION update_payment_gateways_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER payment_gateways_updated_at
  BEFORE UPDATE ON payment_gateways
  FOR EACH ROW
  EXECUTE FUNCTION update_payment_gateways_updated_at();
