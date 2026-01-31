-- Supabase SQL editor script to add missing schema pieces safely.
BEGIN;

-- Core booking/backfill fields.
ALTER TABLE bookings
  ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS customer_surname TEXT,
  ADD COLUMN IF NOT EXISTS booking_ref TEXT UNIQUE DEFAULT substring(md5(random()::text) from 1 for 8);

ALTER TABLE customers
  ADD COLUMN IF NOT EXISTS surname TEXT;

ALTER TABLE waitlist
  ADD COLUMN IF NOT EXISTS surname TEXT;

ALTER TABLE extras
  ADD COLUMN IF NOT EXISTS info_text TEXT;

ALTER TABLE venue_settings
  ADD COLUMN IF NOT EXISTS midweek_discount_percent NUMERIC DEFAULT 25,
  ADD COLUMN IF NOT EXISTS offers JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS require_deposit BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS min_days_lead_time INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS min_hours_lead_time INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS midweek_discount INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS show_midweek_offer BOOLEAN DEFAULT false;

UPDATE bookings
  SET status = 'PENDING'
  WHERE status IS NULL;

ALTER TABLE bookings
  ALTER COLUMN status SET NOT NULL;

UPDATE bookings
  SET source = 'public'
  WHERE source IS NULL;

ALTER TABLE bookings
  ALTER COLUMN source SET DEFAULT 'public';

ALTER TABLE bookings
  ALTER COLUMN source SET NOT NULL;

ALTER TABLE bookings
  ALTER COLUMN deposit_amount SET DEFAULT 0;

UPDATE bookings
  SET deposit_amount = 0
  WHERE deposit_amount IS NULL;

ALTER TABLE bookings
  ALTER COLUMN deposit_paid SET DEFAULT false;

UPDATE bookings
  SET deposit_paid = false
  WHERE deposit_paid IS NULL;

UPDATE bookings
  SET booking_ref = substring(md5(random()::text || id) from 1 for 8)
  WHERE booking_ref IS NULL;

UPDATE venue_settings
SET midweek_discount_percent = COALESCE(midweek_discount_percent, 25),
    offers = COALESCE(offers, '[]'::jsonb),
    require_deposit = COALESCE(require_deposit, false),
    min_days_lead_time = COALESCE(min_days_lead_time, 0),
    min_hours_lead_time = COALESCE(min_hours_lead_time, 0),
    midweek_discount = COALESCE(midweek_discount, 0),
    show_midweek_offer = COALESCE(show_midweek_offer, false);

INSERT INTO venue_settings (id)
SELECT 1
WHERE NOT EXISTS (SELECT 1 FROM venue_settings);

-- Ensure room_name is always populated based on rooms.name.
CREATE OR REPLACE FUNCTION fill_booking_room_name()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.room_name IS NULL OR btrim(NEW.room_name) = '' THEN
    IF NEW.room_id IS NULL OR btrim(NEW.room_id) = '' THEN
      RAISE EXCEPTION 'room_name is required and room_id is missing for booking';
    END IF;

    SELECT name
      INTO NEW.room_name
      FROM rooms
     WHERE id = NEW.room_id;
  END IF;

  IF NEW.room_name IS NULL OR btrim(NEW.room_name) = '' THEN
    RAISE EXCEPTION 'Unable to resolve room_name for booking with room_id %', NEW.room_id;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS bookings_room_name_guard ON bookings;

CREATE TRIGGER bookings_room_name_guard
BEFORE INSERT OR UPDATE OF room_id, room_name
ON bookings
FOR EACH ROW
EXECUTE FUNCTION fill_booking_room_name();

NOTIFY pgrst, 'reload schema';

COMMIT;
