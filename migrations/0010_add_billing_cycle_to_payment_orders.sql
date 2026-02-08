-- Add billing_cycle and package_id columns to payment_orders table
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'payment_orders') THEN
    ALTER TABLE payment_orders ADD COLUMN IF NOT EXISTS billing_cycle TEXT;
    ALTER TABLE payment_orders ADD COLUMN IF NOT EXISTS package_id TEXT;
  END IF;
END $$;
