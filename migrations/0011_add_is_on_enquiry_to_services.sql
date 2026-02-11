-- Add isOnEnquiry column and make basePrice nullable for Price on Enquiry feature
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public'
    AND table_name = 'services'
  ) THEN
    ALTER TABLE services ALTER COLUMN base_price DROP NOT NULL;
    ALTER TABLE services ADD COLUMN IF NOT EXISTS is_on_enquiry BOOLEAN NOT NULL DEFAULT FALSE;
  END IF;
END $$;
