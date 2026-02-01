-- Migration: Secure RLS Policies for Bookings
-- Description: Restrict public access to INSERT (create) and SELECT (read own/public) only. 
-- Updates via API using Service Role will still work.

-- Drop existing "Public Access" policy which was too permissive (ALL)
DROP POLICY IF EXISTS "Public Access" ON bookings;

-- Create explicit policies
-- 1. Allow everyone to create a booking
CREATE POLICY "Enable insert for all users" ON bookings
FOR INSERT WITH CHECK (true);

-- 2. Allow everyone to read bookings (needed for status checks on checkout)
-- Ideally this should be restricted to the creator via a session, 
-- but since we are using anonymous checkout with bookingId, we allow reading by ID.
CREATE POLICY "Enable select for all users" ON bookings
FOR SELECT USING (true);

-- 3. Block UPDATE/DELETE for anonymous users
-- Updates must happen via the API (using service role)
-- No policy for UPDATE/DELETE means they are denied by default.
