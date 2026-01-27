-- Add footer CMS fields to site_settings table
ALTER TABLE site_settings 
ADD COLUMN IF NOT EXISTS footer_sections jsonb DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS social_links jsonb DEFAULT '{}'::jsonb,
ADD COLUMN IF NOT EXISTS copyright_text text;

-- Migrate existing footer_links to footer_sections structure if data exists
DO $$
DECLARE
  existing_links jsonb;
  new_sections jsonb;
BEGIN
  -- Get existing footer_links
  SELECT footer_links INTO existing_links FROM site_settings LIMIT 1;
  
  -- If there are existing links, migrate them to the Categories section
  IF existing_links IS NOT NULL AND jsonb_array_length(existing_links) > 0 THEN
    new_sections := jsonb_build_array(
      jsonb_build_object(
        'id', 'categories',
        'title', 'Categories',
        'links', (
          SELECT jsonb_agg(
            jsonb_build_object(
              'label', link->>'label',
              'url', link->>'href',
              'openInNewTab', false,
              'enabled', true,
              'order', ordinality - 1
            )
          )
          FROM jsonb_array_elements(existing_links) WITH ORDINALITY AS link
        ),
        'enabled', true,
        'order', 0
      )
    );
    
    -- Update the site_settings with migrated data
    UPDATE site_settings SET footer_sections = new_sections;
  END IF;
END $$;

-- Add default copyright text if none exists
UPDATE site_settings 
SET copyright_text = '© FindDetectives International Ltd. 2025'
WHERE copyright_text IS NULL;
