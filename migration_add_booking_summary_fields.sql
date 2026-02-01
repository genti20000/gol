ALTER TABLE bookings
  ADD COLUMN IF NOT EXISTS booking_date DATE,
  ADD COLUMN IF NOT EXISTS start_time TIME,
  ADD COLUMN IF NOT EXISTS duration_hours INTEGER;

SELECT pg_notify('pgrst', 'reload schema');
