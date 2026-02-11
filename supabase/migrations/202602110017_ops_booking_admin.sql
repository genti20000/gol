-- Ops-grade booking admin enhancements

ALTER TABLE bookings
  ADD COLUMN IF NOT EXISTS payment_state TEXT NOT NULL DEFAULT 'NONE';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'bookings_payment_state_check'
  ) THEN
    ALTER TABLE bookings
      ADD CONSTRAINT bookings_payment_state_check
      CHECK (payment_state IN ('NONE', 'DEPOSIT_HELD', 'PAID', 'REFUNDED'));
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'bookings_contact_required_for_active_states_check'
  ) THEN
    ALTER TABLE bookings
      ADD CONSTRAINT bookings_contact_required_for_active_states_check
      CHECK (
        status NOT IN ('PENDING', 'CONFIRMED')
        OR (
          length(trim(coalesce(customer_name, ''))) > 0
          AND length(trim(coalesce(customer_email, ''))) > 0
        )
      )
      NOT VALID;
  END IF;
END
$$;

CREATE EXTENSION IF NOT EXISTS btree_gist;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'bookings_no_overlap_per_room'
  ) THEN
    IF EXISTS (
      SELECT 1
      FROM bookings b1
      JOIN bookings b2
        ON b1.id <> b2.id
       AND b1.room_id = b2.room_id
       AND b1.status <> 'CANCELLED'
       AND b2.status <> 'CANCELLED'
       AND tstzrange(b1.start_at, b1.end_at, '[)') && tstzrange(b2.start_at, b2.end_at, '[)')
      LIMIT 1
    ) THEN
      RAISE NOTICE 'Skipping bookings_no_overlap_per_room: existing overlapping bookings detected.';
    ELSE
      ALTER TABLE bookings
        ADD CONSTRAINT bookings_no_overlap_per_room
        EXCLUDE USING gist (
          room_id WITH =,
          tstzrange(start_at, end_at, '[)') WITH &&
        )
        WHERE (status <> 'CANCELLED');
    END IF;
  END IF;
END
$$;

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
