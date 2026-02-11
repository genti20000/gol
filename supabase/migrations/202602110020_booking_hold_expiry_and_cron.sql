-- 10-minute DRAFT hold lifecycle:
-- 1) keep overlap constraint only for active booking states
-- 2) expire stale DRAFT rows every minute
-- 3) hard-delete old EXPIRED rows daily (7 days retention)

CREATE EXTENSION IF NOT EXISTS pg_cron;

ALTER TABLE bookings
  ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ;

ALTER TABLE bookings
  DROP CONSTRAINT IF EXISTS bookings_no_overlap_per_room;

ALTER TABLE bookings
  ADD CONSTRAINT bookings_no_overlap_per_room
  EXCLUDE USING gist (
    room_id WITH =,
    tstzrange(start_at, end_at, '[)') WITH &&
  )
  WHERE (status IN ('CONFIRMED', 'PENDING', 'DRAFT'));

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'expire-drafts') THEN
    PERFORM cron.unschedule('expire-drafts');
  END IF;
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'delete-expired-drafts') THEN
    PERFORM cron.unschedule('delete-expired-drafts');
  END IF;
END
$$;

SELECT cron.schedule(
  'expire-drafts',
  '* * * * *',
  $$
    UPDATE bookings
    SET status = 'EXPIRED'
    WHERE status = 'DRAFT'
      AND (
        (expires_at IS NOT NULL AND expires_at < now())
        OR (expires_at IS NULL AND created_at < now() - interval '10 minutes')
      );
  $$
);

SELECT cron.schedule(
  'delete-expired-drafts',
  '0 3 * * *',
  $$
    DELETE FROM bookings
    WHERE status = 'EXPIRED'
      AND created_at < now() - interval '7 days';
  $$
);
