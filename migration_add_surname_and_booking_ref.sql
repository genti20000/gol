-- Migration: Add surname and booking_ref fields
-- Run this in your Supabase SQL Editor

-- Add surname to customers table
ALTER TABLE customers ADD COLUMN IF NOT EXISTS surname TEXT;

-- Add surname to waitlist table
ALTER TABLE waitlist ADD COLUMN IF NOT EXISTS surname TEXT;

-- Add customer_surname and booking_ref to bookings table
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS customer_surname TEXT;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS booking_ref TEXT UNIQUE DEFAULT substring(md5(random()::text) from 1 for 8);

-- Update existing bookings to have a booking_ref if they don't have one
UPDATE bookings 
SET booking_ref = substring(md5(random()::text || id) from 1 for 8) 
WHERE booking_ref IS NULL;

-- Disable deposit by default in settings
UPDATE venue_settings 
SET deposit_enabled = false, deposit_amount = 0 
WHERE id = 1;

-- Verify the changes
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'bookings' 
AND column_name IN ('customer_surname', 'booking_ref')
ORDER BY column_name;
