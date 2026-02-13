CREATE OR REPLACE FUNCTION public.finalize_public_booking_atomic(
  p_service_id text,
  p_staff_id text,
  p_booking_date date,
  p_start_time time,
  p_duration_hours integer,
  p_start_at timestamptz,
  p_end_at timestamptz,
  p_guests integer,
  p_customer_name text,
  p_customer_surname text,
  p_customer_email text,
  p_customer_phone text,
  p_notes text,
  p_special_requests text,
  p_base_total numeric,
  p_extras_hours integer,
  p_extras_price numeric,
  p_discount_amount numeric,
  p_promo_code text,
  p_promo_discount_amount numeric,
  p_total_price numeric,
  p_deposit_amount numeric,
  p_deposit_paid boolean,
  p_extras_total numeric,
  p_extras_snapshot jsonb,
  p_session_id text
)
RETURNS TABLE (
  booking_id text,
  booking_token text,
  room_id text,
  room_name text,
  conflict boolean
)
LANGUAGE plpgsql
AS $$
DECLARE
  v_room_id text;
  v_room_name text;
  v_booking_id text;
  v_booking_token text;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext(
    concat_ws(':', 'slot', coalesce(p_service_id, ''), p_booking_date::text, p_start_time::text)
  ));

  DELETE FROM public.slot_holds
  WHERE expires_at <= now();

  IF NOT EXISTS (
    SELECT 1
    FROM public.slot_holds h
    WHERE h.service_id = p_service_id
      AND h.date = p_booking_date
      AND h.start_time = p_start_time
      AND h.session_id = p_session_id
      AND h.expires_at > now()
  ) THEN
    RETURN QUERY SELECT NULL::text, NULL::text, NULL::text, NULL::text, true;
    RETURN;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.bookings b
    WHERE b.service_id = p_service_id
      AND b.booking_date = p_booking_date
      AND b.start_time = p_start_time
      AND b.status IN ('CONFIRMED', 'PENDING')
  ) THEN
    RETURN QUERY SELECT NULL::text, NULL::text, NULL::text, NULL::text, true;
    RETURN;
  END IF;

  SELECT r.id, r.name
  INTO v_room_id, v_room_name
  FROM public.rooms r
  WHERE r.is_active = true
    AND NOT EXISTS (
      SELECT 1
      FROM public.bookings b
      WHERE b.room_id = r.id
        AND b.start_at < p_end_at
        AND b.end_at > p_start_at
        AND (
          b.status IN ('CONFIRMED', 'PENDING')
          OR (
            b.status = 'DRAFT'
            AND (b.expires_at IS NULL OR b.expires_at > now())
          )
        )
    )
    AND NOT EXISTS (
      SELECT 1
      FROM public.room_blocks rb
      WHERE rb.room_id = r.id
        AND rb.start_at < p_end_at
        AND rb.end_at > p_start_at
    )
  ORDER BY r.name
  LIMIT 1;

  IF v_room_id IS NULL THEN
    RETURN QUERY SELECT NULL::text, NULL::text, NULL::text, NULL::text, true;
    RETURN;
  END IF;

  INSERT INTO public.bookings (
    room_id,
    room_name,
    service_id,
    staff_id,
    booking_date,
    start_time,
    duration_hours,
    start_at,
    end_at,
    status,
    confirmed_at,
    expires_at,
    guests,
    customer_name,
    customer_surname,
    customer_email,
    customer_phone,
    notes,
    special_requests,
    base_total,
    extras_hours,
    extras_price,
    discount_amount,
    promo_code,
    promo_discount_amount,
    total_price,
    source,
    payment_state,
    deposit_amount,
    deposit_paid,
    extras_total,
    extras_snapshot
  )
  VALUES (
    v_room_id,
    v_room_name,
    p_service_id,
    p_staff_id,
    p_booking_date,
    p_start_time,
    p_duration_hours,
    p_start_at,
    p_end_at,
    'CONFIRMED',
    now(),
    NULL,
    p_guests,
    p_customer_name,
    p_customer_surname,
    p_customer_email,
    p_customer_phone,
    p_notes,
    p_special_requests,
    p_base_total,
    p_extras_hours,
    p_extras_price,
    p_discount_amount,
    p_promo_code,
    p_promo_discount_amount,
    p_total_price,
    'public',
    'NONE',
    p_deposit_amount,
    p_deposit_paid,
    p_extras_total,
    coalesce(p_extras_snapshot, '[]'::jsonb)
  )
  RETURNING id, booking_access_token INTO v_booking_id, v_booking_token;

  DELETE FROM public.slot_holds
  WHERE service_id = p_service_id
    AND date = p_booking_date
    AND start_time = p_start_time;

  RETURN QUERY SELECT v_booking_id, v_booking_token, v_room_id, v_room_name, false;
EXCEPTION
  WHEN exclusion_violation OR unique_violation THEN
    RETURN QUERY SELECT NULL::text, NULL::text, NULL::text, NULL::text, true;
END;
$$;
