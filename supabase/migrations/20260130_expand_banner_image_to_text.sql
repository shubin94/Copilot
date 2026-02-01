-- Allow large banner images (data URLs) by using TEXT
ALTER TABLE pages ALTER COLUMN banner_image TYPE TEXT;
