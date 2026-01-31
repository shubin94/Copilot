-- Complete CMS Schema Setup
-- This migration is applied AFTER the base CMS tables (20260130_add_cms_tables.sql)
-- It adds all additional columns and fields to the pages table

-- Add banner_image column to pages table (initially VARCHAR)
ALTER TABLE pages ADD COLUMN IF NOT EXISTS banner_image VARCHAR(500);

-- Expand banner_image to TEXT to support large data URLs
ALTER TABLE pages ALTER COLUMN banner_image TYPE TEXT;

-- Add SEO fields to pages table
ALTER TABLE pages ADD COLUMN IF NOT EXISTS meta_title VARCHAR(255);
ALTER TABLE pages ADD COLUMN IF NOT EXISTS meta_description TEXT;

-- Create indexes for new columns if needed
CREATE INDEX IF NOT EXISTS idx_pages_meta_title ON pages(meta_title);
