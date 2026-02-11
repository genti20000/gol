ALTER TABLE venue_settings
  ADD COLUMN IF NOT EXISTS midweek_discount_percent NUMERIC DEFAULT 25,
  ADD COLUMN IF NOT EXISTS offers JSONB DEFAULT '[]'::jsonb;

UPDATE venue_settings
SET midweek_discount_percent = 25
WHERE midweek_discount_percent IS NULL;

UPDATE venue_settings
SET offers = '[]'::jsonb
WHERE offers IS NULL;
