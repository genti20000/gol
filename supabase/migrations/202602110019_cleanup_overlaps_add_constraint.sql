-- Clean overlapping non-cancelled bookings, then enforce no-overlap per room.
-- Strategy:
-- 1) For each overlapping pair in the same room, keep the higher-priority booking.
-- 2) Cancel the lower-priority booking and append an audit note.
-- 3) Add the exclusion constraint once no overlaps remain.

CREATE EXTENSION IF NOT EXISTS btree_gist;

WITH ranked_overlaps AS (
  SELECT
    b1.id AS booking_a_id,
    b2.id AS booking_b_id,
    (
      CASE b1.status
        WHEN 'CONFIRMED' THEN 4
        WHEN 'PENDING' THEN 3
        WHEN 'DRAFT' THEN 2
        WHEN 'FAILED' THEN 1
        WHEN 'NO_SHOW' THEN 0
        ELSE 0
      END
      + CASE coalesce(b1.payment_state, 'NONE')
        WHEN 'PAID' THEN 4
        WHEN 'DEPOSIT_HELD' THEN 2
        ELSE 0
      END
    ) AS score_a,
    (
      CASE b2.status
        WHEN 'CONFIRMED' THEN 4
        WHEN 'PENDING' THEN 3
        WHEN 'DRAFT' THEN 2
        WHEN 'FAILED' THEN 1
        WHEN 'NO_SHOW' THEN 0
        ELSE 0
      END
      + CASE coalesce(b2.payment_state, 'NONE')
        WHEN 'PAID' THEN 4
        WHEN 'DEPOSIT_HELD' THEN 2
        ELSE 0
      END
    ) AS score_b,
    coalesce(b1.confirmed_at, b1.created_at, b1.start_at) AS tie_a,
    coalesce(b2.confirmed_at, b2.created_at, b2.start_at) AS tie_b
  FROM bookings b1
  JOIN bookings b2
    ON b1.id < b2.id
   AND b1.room_id = b2.room_id
   AND b1.status <> 'CANCELLED'
   AND b2.status <> 'CANCELLED'
   AND tstzrange(b1.start_at, b1.end_at, '[)') && tstzrange(b2.start_at, b2.end_at, '[)')
),
to_cancel AS (
  SELECT DISTINCT
    CASE
      WHEN score_a > score_b THEN booking_b_id
      WHEN score_b > score_a THEN booking_a_id
      WHEN tie_a < tie_b THEN booking_b_id
      WHEN tie_b < tie_a THEN booking_a_id
      WHEN booking_a_id < booking_b_id THEN booking_b_id
      ELSE booking_a_id
    END AS id
  FROM ranked_overlaps
),
updated AS (
  UPDATE bookings b
  SET
    status = 'CANCELLED',
    notes = concat_ws(
      E'\n',
      nullif(b.notes, ''),
      '[AUTO-CANCELLED] Removed to resolve overlapping booking conflict before enforcing no-overlap constraint.'
    )
  WHERE b.id IN (SELECT id FROM to_cancel)
    AND b.status <> 'CANCELLED'
  RETURNING b.id
)
INSERT INTO booking_audit_log (booking_id, actor_email, action, old_values, new_values, metadata)
SELECT
  u.id,
  'system:migration-202602110019',
  'auto_cancel_overlap_cleanup',
  jsonb_build_object('status', 'NON_CANCELLED'),
  jsonb_build_object('status', 'CANCELLED'),
  jsonb_build_object('reason', 'overlap_cleanup_before_constraint')
FROM updated u;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM bookings b1
    JOIN bookings b2
      ON b1.id < b2.id
     AND b1.room_id = b2.room_id
     AND b1.status <> 'CANCELLED'
     AND b2.status <> 'CANCELLED'
     AND tstzrange(b1.start_at, b1.end_at, '[)') && tstzrange(b2.start_at, b2.end_at, '[)')
  ) THEN
    RAISE EXCEPTION 'Overlaps remain after cleanup; manual review required before adding constraint.';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'bookings_no_overlap_per_room'
  ) THEN
    ALTER TABLE bookings
      ADD CONSTRAINT bookings_no_overlap_per_room
      EXCLUDE USING gist (
        room_id WITH =,
        tstzrange(start_at, end_at, '[)') WITH &&
      )
      WHERE (status <> 'CANCELLED');
  END IF;
END
$$;
