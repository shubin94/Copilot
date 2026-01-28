-- Add billing_cycle and package_id columns to payment_orders table
ALTER TABLE payment_orders 
ADD COLUMN billing_cycle TEXT,
ADD COLUMN package_id TEXT;
