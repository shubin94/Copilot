-- Add banner_image column to pages table
ALTER TABLE pages ADD COLUMN IF NOT EXISTS banner_image VARCHAR(500);
