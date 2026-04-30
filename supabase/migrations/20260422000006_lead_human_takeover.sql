ALTER TABLE leads ADD COLUMN IF NOT EXISTS human_takeover boolean NOT NULL DEFAULT false;
