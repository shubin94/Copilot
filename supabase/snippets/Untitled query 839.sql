BEGIN;

ALTER TABLE public.pages
ADD COLUMN IF NOT EXISTS h1 TEXT;

-- Optional: backfill existing rows so current pages have an H1 immediately
UPDATE public.pages
SET h1 = title
WHERE h1 IS NULL OR btrim(h1) = '';

COMMIT;