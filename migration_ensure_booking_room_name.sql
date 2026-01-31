-- Defensive trigger to ensure bookings.room_name is always populated from rooms.name.

CREATE OR REPLACE FUNCTION fill_booking_room_name()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.room_name IS NULL OR btrim(NEW.room_name) = '' THEN
    IF NEW.room_id IS NULL OR btrim(NEW.room_id) = '' THEN
      RAISE EXCEPTION 'room_name is required and room_id is missing for booking';
    END IF;

    SELECT name
      INTO NEW.room_name
      FROM rooms
     WHERE id = NEW.room_id;
  END IF;

  IF NEW.room_name IS NULL OR btrim(NEW.room_name) = '' THEN
    RAISE EXCEPTION 'Unable to resolve room_name for booking with room_id %', NEW.room_id;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS bookings_room_name_guard ON bookings;

CREATE TRIGGER bookings_room_name_guard
BEFORE INSERT OR UPDATE OF room_id, room_name
ON bookings
FOR EACH ROW
EXECUTE FUNCTION fill_booking_room_name();
