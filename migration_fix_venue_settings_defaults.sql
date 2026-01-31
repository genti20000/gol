BEGIN;

ALTER TABLE venue_settings
  ADD COLUMN IF NOT EXISTS require_deposit BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS min_days_lead_time INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS min_hours_lead_time INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS midweek_discount INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS show_midweek_offer BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS offers JSONB DEFAULT '[]'::jsonb;

UPDATE venue_settings
SET require_deposit = COALESCE(require_deposit, false),
    min_days_lead_time = COALESCE(min_days_lead_time, 0),
    min_hours_lead_time = COALESCE(min_hours_lead_time, 0),
    midweek_discount = COALESCE(midweek_discount, 0),
    show_midweek_offer = COALESCE(show_midweek_offer, false),
    offers = COALESCE(offers, '[]'::jsonb);

INSERT INTO venue_settings (id)
SELECT 1
WHERE NOT EXISTS (SELECT 1 FROM venue_settings);

NOTIFY pgrst, 'reload schema';

COMMIT;
