ALTER TABLE services
  ADD COLUMN IF NOT EXISTS min_people INTEGER,
  ADD COLUMN IF NOT EXISTS max_people INTEGER,
  ADD COLUMN IF NOT EXISTS price_per_person_pence INTEGER,
  ADD COLUMN IF NOT EXISTS deposit_per_person_pence INTEGER,
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS sort_order INTEGER DEFAULT 1;

UPDATE services
SET min_people = COALESCE(min_people, NULLIF(substring(name from '(\\d+)')::int, 0), 8),
    max_people = COALESCE(max_people, NULLIF(substring(name from '(\\d+)')::int, 0), 8),
    price_per_person_pence = COALESCE(price_per_person_pence, 0),
    is_active = COALESCE(is_active, COALESCE(enabled, true)),
    sort_order = COALESCE(sort_order, 1)
WHERE min_people IS NULL OR max_people IS NULL OR price_per_person_pence IS NULL OR is_active IS NULL OR sort_order IS NULL;

ALTER TABLE services
  ALTER COLUMN min_people SET NOT NULL,
  ALTER COLUMN max_people SET NOT NULL,
  ALTER COLUMN price_per_person_pence SET NOT NULL,
  ALTER COLUMN is_active SET NOT NULL,
  ALTER COLUMN sort_order SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'services_min_people_check') THEN
    ALTER TABLE services ADD CONSTRAINT services_min_people_check CHECK (min_people >= 1);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'services_max_people_check') THEN
    ALTER TABLE services ADD CONSTRAINT services_max_people_check CHECK (max_people >= min_people);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'services_price_per_person_pence_check') THEN
    ALTER TABLE services ADD CONSTRAINT services_price_per_person_pence_check CHECK (price_per_person_pence >= 0);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'services_duration_minutes_check') THEN
    ALTER TABLE services ADD CONSTRAINT services_duration_minutes_check CHECK (duration_minutes BETWEEN 30 AND 600);
  END IF;
END $$;
