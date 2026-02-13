-- Admin bookings list performance indexes for server-side filtering and pagination.

CREATE INDEX IF NOT EXISTS bookings_status_start_at_idx
  ON public.bookings (status, start_at);

CREATE INDEX IF NOT EXISTS bookings_room_status_start_at_idx
  ON public.bookings (room_id, status, start_at);

CREATE INDEX IF NOT EXISTS bookings_payment_state_start_at_idx
  ON public.bookings (payment_state, start_at);

CREATE INDEX IF NOT EXISTS bookings_created_at_idx
  ON public.bookings (created_at DESC);

CREATE INDEX IF NOT EXISTS bookings_customer_email_idx
  ON public.bookings (customer_email);

CREATE INDEX IF NOT EXISTS slot_holds_expires_at_idx
  ON public.slot_holds (expires_at);
