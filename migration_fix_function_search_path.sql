-- Fix mutable search_path in functions for security
ALTER FUNCTION public.enforce_booking_requirements() SET search_path = public;
ALTER FUNCTION public.fill_booking_room_name() SET search_path = public;
