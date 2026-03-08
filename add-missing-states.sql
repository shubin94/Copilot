-- Add missing states for detectives
INSERT INTO states (country_id, name, slug, is_active) 
VALUES 
  (1, 'Assam', 'assam', true),
  (2, 'Arizona', 'arizona', true),
  (1, 'Kerala', 'kerala', true),
  (1, 'Arunachal Pradesh', 'arunachal-pradesh', true),
  (1, 'Karnataka', 'karnataka', true)
ON CONFLICT (country_id, slug) DO NOTHING;

-- Get the state IDs for cities
SELECT id, country_id, name FROM states WHERE slug IN ('assam', 'arizona', 'kerala', 'arunachal-pradesh', 'karnataka');
