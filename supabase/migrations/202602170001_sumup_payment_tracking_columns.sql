ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS payment_provider TEXT,
  ADD COLUMN IF NOT EXISTS payment_checkout_id TEXT,
  ADD COLUMN IF NOT EXISTS payment_event_id TEXT;

CREATE INDEX IF NOT EXISTS bookings_payment_checkout_id_idx
  ON public.bookings (payment_checkout_id);

CREATE INDEX IF NOT EXISTS bookings_payment_event_id_idx
  ON public.bookings (payment_event_id);
