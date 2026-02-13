CREATE OR REPLACE FUNCTION public.create_slot_hold_atomic(
  p_service_id text,
  p_date date,
  p_start_time time,
  p_session_id text
)
RETURNS TABLE (
  conflict boolean,
  reason text,
  expires_at timestamptz
)
LANGUAGE plpgsql
AS $$
DECLARE
  v_expires_at timestamptz := now() + interval '5 minutes';
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext(
    concat_ws(':', 'hold', coalesce(p_service_id, ''), p_date::text, p_start_time::text)
  ));

  DELETE FROM public.slot_holds
  WHERE expires_at <= now();

  IF EXISTS (
    SELECT 1
    FROM public.bookings b
    WHERE b.service_id = p_service_id
      AND b.booking_date = p_date
      AND b.start_time = p_start_time
      AND b.status IN ('CONFIRMED', 'PENDING')
  ) THEN
    RETURN QUERY SELECT true, 'BOOKED'::text, NULL::timestamptz;
    RETURN;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.slot_holds h
    WHERE h.service_id = p_service_id
      AND h.date = p_date
      AND h.start_time = p_start_time
      AND h.expires_at > now()
      AND h.session_id <> p_session_id
  ) THEN
    RETURN QUERY SELECT true, 'HELD'::text, NULL::timestamptz;
    RETURN;
  END IF;

  DELETE FROM public.slot_holds WHERE session_id = p_session_id;

  INSERT INTO public.slot_holds (service_id, date, start_time, session_id, expires_at)
  VALUES (p_service_id, p_date, p_start_time, p_session_id, v_expires_at);

  RETURN QUERY SELECT false, NULL::text, v_expires_at;
END;
$$;
