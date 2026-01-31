-- Add provider field to payment_orders table
-- Tracks which payment gateway was used (razorpay, paypal, etc.)

BEGIN;

-- Add provider column
ALTER TABLE payment_orders 
  ADD COLUMN IF NOT EXISTS provider TEXT;

-- Create index for faster provider lookups
CREATE INDEX IF NOT EXISTS idx_payment_orders_provider 
  ON payment_orders(provider) 
  WHERE provider IS NOT NULL;

-- Backfill existing records with 'razorpay' if they have razorpay_order_id
UPDATE payment_orders 
SET provider = 'razorpay' 
WHERE razorpay_order_id IS NOT NULL AND provider IS NULL;

-- Backfill existing records with 'paypal' if they have paypal_order_id
UPDATE payment_orders 
SET provider = 'paypal' 
WHERE paypal_order_id IS NOT NULL AND provider IS NULL;

COMMIT;
