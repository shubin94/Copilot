ALTER TABLE detective_snippets
ADD COLUMN IF NOT EXISTS snippet_type text NOT NULL DEFAULT 'service_card_snippet';
