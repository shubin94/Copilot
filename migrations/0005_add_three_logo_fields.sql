-- Add three separate logo fields to site_settings table
-- headerLogoUrl: Main header logo
-- stickyHeaderLogoUrl: Logo shown when header becomes sticky/fixed after scrolling
-- footerLogoUrl: Logo displayed in footer

ALTER TABLE site_settings ADD COLUMN IF NOT EXISTS header_logo_url TEXT;
ALTER TABLE site_settings ADD COLUMN IF NOT EXISTS sticky_header_logo_url TEXT;
ALTER TABLE site_settings ADD COLUMN IF NOT EXISTS footer_logo_url TEXT;

-- Migrate existing logoUrl to all three new fields for backward compatibility
UPDATE site_settings 
SET 
  header_logo_url = COALESCE(header_logo_url, logo_url),
  sticky_header_logo_url = COALESCE(sticky_header_logo_url, logo_url),
  footer_logo_url = COALESCE(footer_logo_url, logo_url)
WHERE logo_url IS NOT NULL;
