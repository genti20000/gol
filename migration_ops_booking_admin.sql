-- Ops-grade booking admin enhancements

ALTER TABLE bookings
  ADD COLUMN IF NOT EXISTS payment_state TEXT NOT NULL DEFAULT 'NONE';

ALTER TABLE bookings
  ADD CONSTRAINT bookings_payment_state_check
  CHECK (payment_state IN ('NONE', 'DEPOSIT_HELD', 'PAID', 'REFUNDED'));

ALTER TABLE bookings
  ADD CONSTRAINT bookings_contact_required_for_active_states_check
  CHECK (
    status NOT IN ('PENDING', 'CONFIRMED')
    OR (
      length(trim(coalesce(customer_name, ''))) > 0
      AND length(trim(coalesce(customer_email, ''))) > 0
    )
  );

CREATE EXTENSION IF NOT EXISTS btree_gist;

ALTER TABLE bookings
  ADD CONSTRAINT bookings_no_overlap_per_room
  EXCLUDE USING gist (
    room_id WITH =,
    tstzrange(start_at, end_at, '[)') WITH &&
  )
  WHERE (status <> 'CANCELLED');

CREATE TABLE IF NOT EXISTS booking_audit_log (
  id BIGSERIAL PRIMARY KEY,
  booking_id TEXT NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  actor_email TEXT,
  action TEXT NOT NULL,
  old_values JSONB,
  new_values JSONB,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS booking_audit_log_booking_id_created_at_idx
  ON booking_audit_log (booking_id, created_at DESC);
