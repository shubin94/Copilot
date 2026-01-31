-- Add google_id for Google OAuth (general users: email/password or Google only)
ALTER TABLE users ADD COLUMN IF NOT EXISTS google_id text;
CREATE UNIQUE INDEX IF NOT EXISTS users_google_id_unique ON users (google_id);
