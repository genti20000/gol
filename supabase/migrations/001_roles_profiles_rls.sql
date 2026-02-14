-- Shared Supabase auth/role/RLS model for customer web, admin web, and mobile apps.
-- This migration is idempotent and safe to run multiple times.

BEGIN;

-- 1) Role enum and profiles table
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'app_role') THEN
    CREATE TYPE public.app_role AS ENUM ('customer', 'staff', 'admin');
  END IF;
END
$$;

CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text UNIQUE,
  role public.app_role NOT NULL DEFAULT 'customer',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS profiles_role_idx ON public.profiles(role);

-- Keep updated_at fresh
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS profiles_set_updated_at ON public.profiles;
CREATE TRIGGER profiles_set_updated_at
BEFORE UPDATE ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user_profile()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, role)
  VALUES (NEW.id, lower(NEW.email), 'customer')
  ON CONFLICT (id) DO UPDATE
  SET email = excluded.email;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created_profile ON auth.users;
CREATE TRIGGER on_auth_user_created_profile
AFTER INSERT ON auth.users
FOR EACH ROW
EXECUTE FUNCTION public.handle_new_user_profile();

-- Backfill profiles for existing users
INSERT INTO public.profiles (id, email, role)
SELECT u.id, lower(u.email), 'customer'::public.app_role
FROM auth.users u
ON CONFLICT (id) DO UPDATE
SET email = excluded.email;

-- Optional role bootstrap from existing admin_users table (email allowlist)
UPDATE public.profiles p
SET role = 'admin'
FROM public.admin_users a
WHERE a.enabled = true
  AND lower(a.email) = lower(p.email)
  AND p.role <> 'admin';

-- 2) Add auth link columns for ownership
ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS auth_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE public.customers
  ADD COLUMN IF NOT EXISTS auth_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS bookings_auth_user_id_idx ON public.bookings(auth_user_id);
CREATE INDEX IF NOT EXISTS customers_auth_user_id_idx ON public.customers(auth_user_id);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'customers_auth_user_id_unique'
  ) THEN
    ALTER TABLE public.customers
      ADD CONSTRAINT customers_auth_user_id_unique UNIQUE (auth_user_id);
  END IF;
END
$$;

-- Best-effort backfill by email
UPDATE public.bookings b
SET auth_user_id = u.id
FROM auth.users u
WHERE b.auth_user_id IS NULL
  AND length(trim(coalesce(b.customer_email, ''))) > 0
  AND lower(b.customer_email) = lower(u.email);

UPDATE public.customers c
SET auth_user_id = u.id
FROM auth.users u
WHERE c.auth_user_id IS NULL
  AND length(trim(coalesce(c.email, ''))) > 0
  AND lower(c.email) = lower(u.email);

-- 3) Helper role functions for RLS
CREATE OR REPLACE FUNCTION public.current_role()
RETURNS public.app_role
LANGUAGE sql
STABLE
AS $$
  SELECT coalesce((SELECT p.role FROM public.profiles p WHERE p.id = auth.uid()), 'customer'::public.app_role);
$$;

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT public.current_role() = 'admin'::public.app_role;
$$;

CREATE OR REPLACE FUNCTION public.is_staff_or_admin()
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT public.current_role() IN ('staff'::public.app_role, 'admin'::public.app_role);
$$;

-- 4) Enable RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.room_blocks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recurring_blocks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.slot_holds ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.operating_hours ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.special_hours ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.services ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.extras ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.promo_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.staff_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.venue_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.waitlist ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.booking_audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_users ENABLE ROW LEVEL SECURITY;

-- 5) Clean old permissive policies
DROP POLICY IF EXISTS "Public Access" ON public.bookings;
DROP POLICY IF EXISTS "Enable insert for all users" ON public.bookings;
DROP POLICY IF EXISTS "Enable select for all users" ON public.bookings;

-- Profiles policies
DROP POLICY IF EXISTS profiles_select_self ON public.profiles;
CREATE POLICY profiles_select_self
ON public.profiles
FOR SELECT
TO authenticated
USING (id = auth.uid() OR public.is_admin());

DROP POLICY IF EXISTS profiles_insert_self ON public.profiles;
CREATE POLICY profiles_insert_self
ON public.profiles
FOR INSERT
TO authenticated
WITH CHECK (id = auth.uid() AND role = 'customer');

DROP POLICY IF EXISTS profiles_update_self ON public.profiles;
CREATE POLICY profiles_update_self
ON public.profiles
FOR UPDATE
TO authenticated
USING (id = auth.uid() OR public.is_admin())
WITH CHECK (
  (
    id = auth.uid()
    AND role = (SELECT role FROM public.profiles p WHERE p.id = auth.uid())
  )
  OR public.is_admin()
);

DROP POLICY IF EXISTS profiles_delete_admin ON public.profiles;
CREATE POLICY profiles_delete_admin
ON public.profiles
FOR DELETE
TO authenticated
USING (public.is_admin());

-- bookings: customers own rows, staff/admin all
DROP POLICY IF EXISTS bookings_select_own_or_staff ON public.bookings;
CREATE POLICY bookings_select_own_or_staff
ON public.bookings
FOR SELECT
TO authenticated
USING (auth_user_id = auth.uid() OR public.is_staff_or_admin());

DROP POLICY IF EXISTS bookings_insert_own_or_staff ON public.bookings;
CREATE POLICY bookings_insert_own_or_staff
ON public.bookings
FOR INSERT
TO authenticated
WITH CHECK (
  (auth_user_id = auth.uid() AND public.current_role() = 'customer')
  OR public.is_staff_or_admin()
);

DROP POLICY IF EXISTS bookings_update_own_or_staff ON public.bookings;
CREATE POLICY bookings_update_own_or_staff
ON public.bookings
FOR UPDATE
TO authenticated
USING (auth_user_id = auth.uid() OR public.is_staff_or_admin())
WITH CHECK (auth_user_id = auth.uid() OR public.is_staff_or_admin());

DROP POLICY IF EXISTS bookings_delete_staff ON public.bookings;
CREATE POLICY bookings_delete_staff
ON public.bookings
FOR DELETE
TO authenticated
USING (public.is_staff_or_admin());

-- customers: customers own profile row, staff/admin all
DROP POLICY IF EXISTS customers_select_own_or_staff ON public.customers;
CREATE POLICY customers_select_own_or_staff
ON public.customers
FOR SELECT
TO authenticated
USING (auth_user_id = auth.uid() OR public.is_staff_or_admin());

DROP POLICY IF EXISTS customers_insert_own_or_staff ON public.customers;
CREATE POLICY customers_insert_own_or_staff
ON public.customers
FOR INSERT
TO authenticated
WITH CHECK (
  (auth_user_id = auth.uid() AND public.current_role() = 'customer')
  OR public.is_staff_or_admin()
);

DROP POLICY IF EXISTS customers_update_own_or_staff ON public.customers;
CREATE POLICY customers_update_own_or_staff
ON public.customers
FOR UPDATE
TO authenticated
USING (auth_user_id = auth.uid() OR public.is_staff_or_admin())
WITH CHECK (auth_user_id = auth.uid() OR public.is_staff_or_admin());

DROP POLICY IF EXISTS customers_delete_staff ON public.customers;
CREATE POLICY customers_delete_staff
ON public.customers
FOR DELETE
TO authenticated
USING (public.is_staff_or_admin());

-- Operational/config tables: staff/admin write, authenticated read where useful
DROP POLICY IF EXISTS rooms_read_authenticated ON public.rooms;
CREATE POLICY rooms_read_authenticated
ON public.rooms
FOR SELECT
TO authenticated
USING (true);

DROP POLICY IF EXISTS rooms_write_staff ON public.rooms;
CREATE POLICY rooms_write_staff
ON public.rooms
FOR ALL
TO authenticated
USING (public.is_staff_or_admin())
WITH CHECK (public.is_staff_or_admin());

DROP POLICY IF EXISTS room_blocks_staff_all ON public.room_blocks;
CREATE POLICY room_blocks_staff_all
ON public.room_blocks
FOR ALL
TO authenticated
USING (public.is_staff_or_admin())
WITH CHECK (public.is_staff_or_admin());

DROP POLICY IF EXISTS recurring_blocks_staff_all ON public.recurring_blocks;
CREATE POLICY recurring_blocks_staff_all
ON public.recurring_blocks
FOR ALL
TO authenticated
USING (public.is_staff_or_admin())
WITH CHECK (public.is_staff_or_admin());

DROP POLICY IF EXISTS slot_holds_staff_all ON public.slot_holds;
CREATE POLICY slot_holds_staff_all
ON public.slot_holds
FOR ALL
TO authenticated
USING (public.is_staff_or_admin())
WITH CHECK (public.is_staff_or_admin());

DROP POLICY IF EXISTS operating_hours_read_authenticated ON public.operating_hours;
CREATE POLICY operating_hours_read_authenticated
ON public.operating_hours
FOR SELECT
TO authenticated
USING (true);

DROP POLICY IF EXISTS operating_hours_staff_all ON public.operating_hours;
CREATE POLICY operating_hours_staff_all
ON public.operating_hours
FOR ALL
TO authenticated
USING (public.is_staff_or_admin())
WITH CHECK (public.is_staff_or_admin());

DROP POLICY IF EXISTS special_hours_read_authenticated ON public.special_hours;
CREATE POLICY special_hours_read_authenticated
ON public.special_hours
FOR SELECT
TO authenticated
USING (true);

DROP POLICY IF EXISTS special_hours_staff_all ON public.special_hours;
CREATE POLICY special_hours_staff_all
ON public.special_hours
FOR ALL
TO authenticated
USING (public.is_staff_or_admin())
WITH CHECK (public.is_staff_or_admin());

DROP POLICY IF EXISTS services_read_authenticated ON public.services;
CREATE POLICY services_read_authenticated
ON public.services
FOR SELECT
TO authenticated
USING (true);

DROP POLICY IF EXISTS services_staff_all ON public.services;
CREATE POLICY services_staff_all
ON public.services
FOR ALL
TO authenticated
USING (public.is_staff_or_admin())
WITH CHECK (public.is_staff_or_admin());

DROP POLICY IF EXISTS extras_read_authenticated ON public.extras;
CREATE POLICY extras_read_authenticated
ON public.extras
FOR SELECT
TO authenticated
USING (true);

DROP POLICY IF EXISTS extras_staff_all ON public.extras;
CREATE POLICY extras_staff_all
ON public.extras
FOR ALL
TO authenticated
USING (public.is_staff_or_admin())
WITH CHECK (public.is_staff_or_admin());

DROP POLICY IF EXISTS promo_codes_staff_all ON public.promo_codes;
CREATE POLICY promo_codes_staff_all
ON public.promo_codes
FOR ALL
TO authenticated
USING (public.is_staff_or_admin())
WITH CHECK (public.is_staff_or_admin());

DROP POLICY IF EXISTS staff_members_staff_all ON public.staff_members;
CREATE POLICY staff_members_staff_all
ON public.staff_members
FOR ALL
TO authenticated
USING (public.is_staff_or_admin())
WITH CHECK (public.is_staff_or_admin());

DROP POLICY IF EXISTS venue_settings_read_staff ON public.venue_settings;
CREATE POLICY venue_settings_read_staff
ON public.venue_settings
FOR SELECT
TO authenticated
USING (public.is_staff_or_admin());

DROP POLICY IF EXISTS venue_settings_write_admin ON public.venue_settings;
CREATE POLICY venue_settings_write_admin
ON public.venue_settings
FOR ALL
TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS waitlist_staff_all ON public.waitlist;
CREATE POLICY waitlist_staff_all
ON public.waitlist
FOR ALL
TO authenticated
USING (public.is_staff_or_admin())
WITH CHECK (public.is_staff_or_admin());

-- admin_users role controls only by admin
DROP POLICY IF EXISTS admin_users_admin_all ON public.admin_users;
CREATE POLICY admin_users_admin_all
ON public.admin_users
FOR ALL
TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());

-- booking_audit_log append-only; writable by staff/admin, readable by admin only
DROP POLICY IF EXISTS booking_audit_log_select_admin ON public.booking_audit_log;
CREATE POLICY booking_audit_log_select_admin
ON public.booking_audit_log
FOR SELECT
TO authenticated
USING (public.is_admin());

DROP POLICY IF EXISTS booking_audit_log_insert_staff ON public.booking_audit_log;
CREATE POLICY booking_audit_log_insert_staff
ON public.booking_audit_log
FOR INSERT
TO authenticated
WITH CHECK (public.is_staff_or_admin());

-- admin_audit_log append-only; writable by staff/admin, readable by admin only
DROP POLICY IF EXISTS admin_audit_log_select_admin ON public.admin_audit_log;
CREATE POLICY admin_audit_log_select_admin
ON public.admin_audit_log
FOR SELECT
TO authenticated
USING (public.is_admin());

DROP POLICY IF EXISTS admin_audit_log_insert_staff ON public.admin_audit_log;
CREATE POLICY admin_audit_log_insert_staff
ON public.admin_audit_log
FOR INSERT
TO authenticated
WITH CHECK (public.is_staff_or_admin());

-- 6) Grants (RLS still governs row access)
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT USAGE ON SCHEMA public TO service_role;

GRANT SELECT ON public.rooms, public.operating_hours, public.special_hours, public.services, public.extras TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.bookings TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.customers TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.room_blocks TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.recurring_blocks TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.slot_holds TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.staff_members TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.venue_settings TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.waitlist TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.promo_codes TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT SELECT, INSERT ON public.booking_audit_log TO authenticated;
GRANT SELECT, INSERT ON public.admin_audit_log TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.admin_users TO authenticated;

-- Sequence grants for append-only audit tables
GRANT USAGE, SELECT ON SEQUENCE public.booking_audit_log_id_seq TO authenticated;
GRANT USAGE, SELECT ON SEQUENCE public.admin_audit_log_id_seq TO authenticated;

COMMIT;

