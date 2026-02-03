# Setup Instructions

## 1. Environment Variables
I have created a `.env.local` file in the project root. You need to fill in the following values:

- `SUPABASE_SERVICE_ROLE_KEY`: Your Supabase Service Role Key (from Supabase Dashboard > Project Settings > API).

**Note:** The `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` are already filled in from your existing `.env`.

## 2. Database Migration
The latest code adds new features (Customer Surnames, Booking References) that require a database schema update.

Please run the contents of the file `migration_add_surname_and_booking_ref.sql` in your Supabase SQL Editor.

This SQL script will:
- Add `surname` column to `customers` and `waitlist` tables.
- Add `customer_surname` and `booking_ref` columns to `bookings` table.
- Disable default deposits in settings (as per new requirements).

## 3. Deployment
After filling the `.env.local` and running the migration, you can run the app locally with:
```bash
npm run dev
```
