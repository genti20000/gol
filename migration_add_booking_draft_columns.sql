ALTER TABLE bookings
  ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ;

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
