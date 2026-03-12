-- Add phone country code and phone number fields to detectives table
-- This migration adds separate fields for country code and phone number
-- to support better international phone number handling

BEGIN;

-- Add new columns
ALTER TABLE detectives 
ADD COLUMN IF NOT EXISTS phone_country_code TEXT,
ADD COLUMN IF NOT EXISTS phone_number TEXT;

-- Create index for phone number lookups
CREATE INDEX IF NOT EXISTS detectives_phone_number_idx ON detectives(phone_number);

-- Optionally migrate existing phone data to new format
-- This attempts to parse existing phone numbers and split them
-- Note: This is a best-effort migration and may need manual cleanup
UPDATE detectives
SET 
  phone_country_code = CASE
    WHEN phone LIKE '+1%' THEN '+1'
    WHEN phone LIKE '+44%' THEN '+44'
    WHEN phone LIKE '+91%' THEN '+91'
    WHEN phone LIKE '+61%' THEN '+61'
    WHEN phone LIKE '+27%' THEN '+27'
    -- Add more common country codes as needed
    ELSE NULL
  END,
  phone_number = CASE
    WHEN phone LIKE '+1%' THEN SUBSTRING(phone FROM 3)
    WHEN phone LIKE '+44%' THEN SUBSTRING(phone FROM 4)
    WHEN phone LIKE '+91%' THEN SUBSTRING(phone FROM 4)
    WHEN phone LIKE '+61%' THEN SUBSTRING(phone FROM 4)
    WHEN phone LIKE '+27%' THEN SUBSTRING(phone FROM 4)
    -- For other formats, keep the whole number
    ELSE phone
  END
WHERE phone IS NOT NULL 
  AND phone <> ''
  AND phone_country_code IS NULL;

COMMIT;

-- Verification query (run separately)
-- SELECT id, business_name, phone, phone_country_code, phone_number 
-- FROM detectives 
-- WHERE phone IS NOT NULL 
-- LIMIT 10;
