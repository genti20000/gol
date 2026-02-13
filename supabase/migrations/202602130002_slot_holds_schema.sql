-- Add 5-minute slot holds schema and booking uniqueness guard per room+service+slot.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS public.slot_holds (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  service_id text NOT NULL,
  date date NOT NULL,
  start_time time NOT NULL,
  session_id text NOT NULL,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS slot_holds_service_date_time_idx
  ON public.slot_holds (service_id, date, start_time);

CREATE UNIQUE INDEX IF NOT EXISTS bookings_room_service_date_start_unique
  ON public.bookings (room_id, service_id, booking_date, start_time)
  WHERE status IN ('CONFIRMED', 'PENDING')
    AND room_id IS NOT NULL
    AND booking_date IS NOT NULL
    AND start_time IS NOT NULL;
