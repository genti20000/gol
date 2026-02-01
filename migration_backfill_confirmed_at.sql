UPDATE bookings
SET confirmed_at = created_at
WHERE status = 'CONFIRMED' AND confirmed_at IS NULL;
