-- Add isOnEnquiry column and make basePrice nullable for Price on Enquiry feature
ALTER TABLE services 
  MODIFY COLUMN base_price NUMERIC(10, 2) NULL,
  ADD COLUMN is_on_enquiry BOOLEAN NOT NULL DEFAULT FALSE;
