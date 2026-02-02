-- Add CASCADE DELETE constraints to detective-related tables
-- This ensures when a detective is deleted, all related records are automatically removed

-- Drop existing foreign key constraints
ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_detective_id_detectives_id_fk;
ALTER TABLE profile_claims DROP CONSTRAINT IF EXISTS profile_claims_detective_id_detectives_id_fk;
ALTER TABLE payment_orders DROP CONSTRAINT IF EXISTS payment_orders_detective_id_detectives_id_fk;

-- Recreate with CASCADE DELETE
ALTER TABLE orders 
  ADD CONSTRAINT orders_detective_id_detectives_id_fk 
  FOREIGN KEY (detective_id) REFERENCES detectives(id) ON DELETE CASCADE;

ALTER TABLE profile_claims 
  ADD CONSTRAINT profile_claims_detective_id_detectives_id_fk 
  FOREIGN KEY (detective_id) REFERENCES detectives(id) ON DELETE CASCADE;

ALTER TABLE payment_orders 
  ADD CONSTRAINT payment_orders_detective_id_detectives_id_fk 
  FOREIGN KEY (detective_id) REFERENCES detectives(id) ON DELETE CASCADE;
