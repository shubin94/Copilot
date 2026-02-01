-- Phase 1 Fix #2: payment_orders schema alignment
-- Scope: public.payment_orders only. No other tables. No application code changes.
-- Idempotent: ADD COLUMN IF NOT EXISTS; DROP NOT NULL is no-op if already nullable; CHECK added only if missing.
-- Existing rows: keep razorpay_order_id set, new columns NULL; constraint allows exactly one provider.

-- 1. Add missing columns (all nullable)
ALTER TABLE public.payment_orders
  ADD COLUMN IF NOT EXISTS provider text;

ALTER TABLE public.payment_orders
  ADD COLUMN IF NOT EXISTS paypal_order_id text;

ALTER TABLE public.payment_orders
  ADD COLUMN IF NOT EXISTS paypal_payment_id text;

ALTER TABLE public.payment_orders
  ADD COLUMN IF NOT EXISTS paypal_transaction_id text;

ALTER TABLE public.payment_orders
  ADD COLUMN IF NOT EXISTS package_id text;

ALTER TABLE public.payment_orders
  ADD COLUMN IF NOT EXISTS billing_cycle text;

-- 2. Ensure razorpay_order_id is nullable (no-op if already nullable)
ALTER TABLE public.payment_orders
  ALTER COLUMN razorpay_order_id DROP NOT NULL;

-- 3. CHECK: exactly one of Razorpay or PayPal must be set (not both)
-- Existing rows have only razorpay_order_id set → valid. New PayPal rows have only paypal_order_id set → valid.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.payment_orders'::regclass
      AND conname = 'check_payment_orders_one_provider'
  ) THEN
    ALTER TABLE public.payment_orders
      ADD CONSTRAINT check_payment_orders_one_provider
      CHECK (
        (razorpay_order_id IS NOT NULL) IS DISTINCT FROM (paypal_order_id IS NOT NULL)
      );
  END IF;
END $$;
