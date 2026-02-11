-- Add PayPal support to payment_orders table
-- Allows storing PayPal order IDs alongside existing Razorpay fields

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public'
    AND table_name = 'payment_orders'
  ) THEN
    -- Make razorpay_order_id nullable (was NOT NULL, now both can be optional)
    ALTER TABLE payment_orders DROP CONSTRAINT IF EXISTS payment_orders_razorpay_order_id_key;
    ALTER TABLE payment_orders ALTER COLUMN razorpay_order_id DROP NOT NULL;

    -- Add PayPal fields
    ALTER TABLE payment_orders 
      ADD COLUMN IF NOT EXISTS paypal_order_id TEXT UNIQUE,
      ADD COLUMN IF NOT EXISTS paypal_payment_id TEXT,
      ADD COLUMN IF NOT EXISTS paypal_transaction_id TEXT;
  END IF;
END $$;

-- Create index for faster PayPal order lookups
CREATE INDEX IF NOT EXISTS idx_payment_orders_paypal_order_id 
  ON payment_orders(paypal_order_id) 
  WHERE paypal_order_id IS NOT NULL;

-- Add check to ensure at least one payment gateway is used
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public'
    AND table_name = 'payment_orders'
  ) THEN
    BEGIN
      ALTER TABLE payment_orders 
        ADD CONSTRAINT check_payment_gateway 
        CHECK ((razorpay_order_id IS NOT NULL) OR (paypal_order_id IS NOT NULL));
    EXCEPTION WHEN duplicate_object THEN
      NULL;
    END;
  END IF;
END $$;
