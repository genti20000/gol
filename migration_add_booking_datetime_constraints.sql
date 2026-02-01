-- Ensure booking_date and start_time are valid and non-null.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'bookings' AND column_name = 'booking_date'
  ) THEN
    IF EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_name = 'bookings' AND column_name = 'booking_date' AND data_type = 'text'
    ) THEN
      UPDATE bookings
      SET booking_date = NULLIF(TRIM(booking_date), '')
      WHERE booking_date IS NOT NULL;

      ALTER TABLE bookings
      ALTER COLUMN booking_date TYPE date
      USING booking_date::date;
    END IF;

    UPDATE bookings
    SET booking_date = COALESCE(booking_date, (start_at AT TIME ZONE 'UTC')::date)
    WHERE booking_date IS NULL;

    ALTER TABLE bookings
    ALTER COLUMN booking_date SET NOT NULL;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'bookings' AND column_name = 'start_time'
  ) THEN
    IF EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_name = 'bookings' AND column_name = 'start_time' AND data_type = 'text'
    ) THEN
      UPDATE bookings
      SET start_time = NULLIF(TRIM(start_time), '')
      WHERE start_time IS NOT NULL;

      ALTER TABLE bookings
      ALTER COLUMN start_time TYPE time
      USING start_time::time;
    END IF;

    UPDATE bookings
    SET start_time = COALESCE(start_time, (start_at AT TIME ZONE 'UTC')::time)
    WHERE start_time IS NULL;

    ALTER TABLE bookings
    ALTER COLUMN start_time SET NOT NULL;

    IF NOT EXISTS (
      SELECT 1
      FROM pg_constraint
      WHERE conname = 'bookings_start_time_not_empty'
    ) THEN
      ALTER TABLE bookings
      ADD CONSTRAINT bookings_start_time_not_empty
      CHECK (length(trim(start_time::text)) > 0);
    END IF;
  END IF;
END $$;
