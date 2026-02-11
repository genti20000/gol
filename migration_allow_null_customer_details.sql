-- Make customer_name and customer_email nullable to support booking initialization
ALTER TABLE bookings ALTER COLUMN customer_name DROP NOT NULL;
ALTER TABLE bookings ALTER COLUMN customer_email DROP NOT NULL;
