ALTER TABLE bookings
ADD COLUMN IF NOT EXISTS booking_access_token TEXT;

UPDATE bookings
SET booking_access_token = uuid_generate_v4()::text
WHERE booking_access_token IS NULL;

ALTER TABLE bookings
ALTER COLUMN booking_access_token SET NOT NULL,
ALTER COLUMN booking_access_token SET DEFAULT uuid_generate_v4()::text;

CREATE UNIQUE INDEX IF NOT EXISTS idx_bookings_booking_access_token
ON bookings (booking_access_token);
