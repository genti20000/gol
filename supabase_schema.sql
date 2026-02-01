-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Drop existing tables to recreate with correct defaults
DROP TABLE IF EXISTS room_blocks CASCADE;
DROP TABLE IF EXISTS recurring_blocks CASCADE;
DROP TABLE IF EXISTS bookings CASCADE;
DROP TABLE IF EXISTS staff_members CASCADE;
DROP TABLE IF EXISTS services CASCADE;
DROP TABLE IF EXISTS rooms CASCADE;
DROP TABLE IF EXISTS customers CASCADE;
DROP TABLE IF EXISTS waitlist CASCADE;
DROP TABLE IF EXISTS venue_settings CASCADE;
DROP TABLE IF EXISTS operating_hours CASCADE;
DROP TABLE IF EXISTS special_hours CASCADE;
DROP TABLE IF EXISTS promo_codes CASCADE;
DROP TABLE IF EXISTS extras CASCADE;

-- Rooms Table
CREATE TABLE rooms (
  id TEXT PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  min_capacity INTEGER NOT NULL DEFAULT 8,
  max_capacity INTEGER NOT NULL DEFAULT 30,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Services Table
CREATE TABLE services (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  duration_minutes INTEGER NOT NULL,
  base_price NUMERIC NOT NULL DEFAULT 0,
  description TEXT,
  enabled BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Staff Members Table
CREATE TABLE staff_members (
  id TEXT PRIMARY KEY DEFAULT uuid_generate_v4()::text,
  name TEXT NOT NULL,
  enabled BOOLEAN DEFAULT true,
  services_offered TEXT[] DEFAULT '{}',
  buffer_before INTEGER DEFAULT 0,
  buffer_after INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Customers Table
CREATE TABLE customers (
  id TEXT PRIMARY KEY DEFAULT uuid_generate_v4()::text,
  name TEXT NOT NULL,
  surname TEXT,
  email TEXT NOT NULL UNIQUE,
  phone TEXT,
  notes TEXT,
  total_bookings INTEGER DEFAULT 0,
  total_spend NUMERIC DEFAULT 0,
  last_booking_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Bookings Table
CREATE TABLE bookings (
  id TEXT PRIMARY KEY DEFAULT uuid_generate_v4()::text,
  booking_ref TEXT UNIQUE DEFAULT substring(md5(random()::text) from 1 for 8),
  room_id TEXT REFERENCES rooms(id),
  room_name TEXT NOT NULL,
  service_id TEXT REFERENCES services(id),
  staff_id TEXT REFERENCES staff_members(id),
  start_at TIMESTAMPTZ NOT NULL,
  end_at TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL DEFAULT 'PENDING',
  guests INTEGER NOT NULL,
  customer_name TEXT NOT NULL,
  customer_surname TEXT,
  customer_email TEXT NOT NULL,
  customer_phone TEXT,
  notes TEXT,
  base_total NUMERIC NOT NULL DEFAULT 0,
  extras_hours INTEGER DEFAULT 0,
  extras_price NUMERIC NOT NULL DEFAULT 0,
  discount_amount NUMERIC NOT NULL DEFAULT 0,
  promo_code TEXT,
  promo_discount_amount NUMERIC DEFAULT 0,
  total_price NUMERIC NOT NULL DEFAULT 0,
  magic_token TEXT UNIQUE,
  source TEXT DEFAULT 'public',
  deposit_amount NUMERIC NOT NULL DEFAULT 0,
  deposit_paid BOOLEAN DEFAULT false,
  deposit_forfeited BOOLEAN DEFAULT false,
  amount_paid NUMERIC DEFAULT 0,
  extras_total NUMERIC DEFAULT 0,
  extras_snapshot JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT now(),
  confirmed_at TIMESTAMPTZ
);

-- Waitlist Table
CREATE TABLE waitlist (
  id TEXT PRIMARY KEY DEFAULT uuid_generate_v4()::text,
  name TEXT NOT NULL,
  surname TEXT,
  phone TEXT NOT NULL,
  preferred_date DATE NOT NULL,
  preferred_time TIME,
  guests INTEGER NOT NULL,
  status TEXT DEFAULT 'active',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Room Blocks Table
CREATE TABLE room_blocks (
  id TEXT PRIMARY KEY DEFAULT uuid_generate_v4()::text,
  room_id TEXT REFERENCES rooms(id),
  start_at TIMESTAMPTZ NOT NULL,
  end_at TIMESTAMPTZ NOT NULL,
  reason TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Recurring Blocks Table
CREATE TABLE recurring_blocks (
  id TEXT PRIMARY KEY DEFAULT uuid_generate_v4()::text,
  day_of_week INTEGER NOT NULL,
  room_id TEXT REFERENCES rooms(id),
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  reason TEXT,
  enabled BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Venue Settings Table
CREATE TABLE venue_settings (
  id INTEGER PRIMARY KEY DEFAULT 1,
  cancel_cutoff_hours INTEGER DEFAULT 24,
  reschedule_cutoff_hours INTEGER DEFAULT 48,
  release_pending_on_failure BOOLEAN DEFAULT true,
  deposit_enabled BOOLEAN DEFAULT false,
  deposit_amount NUMERIC DEFAULT 0,
  min_days_before_booking INTEGER DEFAULT 0,
  min_hours_before_booking INTEGER DEFAULT 0,
  midweek_discount_percent NUMERIC DEFAULT 25,
  require_deposit BOOLEAN DEFAULT false,
  min_days_lead_time INTEGER DEFAULT 0,
  min_hours_lead_time INTEGER DEFAULT 0,
  midweek_discount INTEGER DEFAULT 0,
  show_midweek_offer BOOLEAN DEFAULT false,
  offers JSONB DEFAULT '[]'::jsonb,
  updated_at TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT one_row CHECK (id = 1)
);

-- Operating Hours
CREATE TABLE operating_hours (
  day INTEGER PRIMARY KEY,
  open_time TIME NOT NULL,
  close_time TIME NOT NULL,
  enabled BOOLEAN DEFAULT true
);

-- Special Hours
CREATE TABLE special_hours (
  date DATE PRIMARY KEY,
  enabled BOOLEAN DEFAULT true,
  open_time TIME,
  close_time TIME
);

-- Promo Codes
CREATE TABLE promo_codes (
  id TEXT PRIMARY KEY DEFAULT uuid_generate_v4()::text,
  code TEXT NOT NULL UNIQUE,
  enabled BOOLEAN DEFAULT true,
  percent_off NUMERIC,
  fixed_off NUMERIC,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  min_guests INTEGER,
  max_uses INTEGER,
  uses INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Extras Table
CREATE TABLE extras (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  info_text TEXT,
  price NUMERIC NOT NULL,
  pricing_mode TEXT NOT NULL,
  enabled BOOLEAN DEFAULT true,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Seed Data
INSERT INTO venue_settings (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

INSERT INTO operating_hours (day, open_time, close_time, enabled) VALUES
(0, '15:00', '03:00', false),
(1, '22:00', '03:00', true),
(2, '22:00', '03:00', true),
(3, '17:00', '03:00', true),
(4, '17:00', '03:00', true),
(5, '17:00', '03:00', true),
(6, '15:00', '03:00', true)
ON CONFLICT (day) DO NOTHING;

INSERT INTO rooms (id, code, name, min_capacity, max_capacity) VALUES
('room-a', 'A', 'Terrace', 8, 100),
('room-b', 'B', 'Vox', 8, 100),
('room-c', 'C', 'Attic', 8, 100)
ON CONFLICT (id) DO NOTHING;

INSERT INTO services (id, name, duration_minutes, base_price) VALUES
('srv-1', 'Standard Karaoke Session', 120, 0)
ON CONFLICT (id) DO NOTHING;

INSERT INTO extras (id, name, price, pricing_mode, sort_order) VALUES
('ext-1', 'Pizza Party Platter', 45, 'flat', 1),
('ext-2', 'Bottle of Prosecco', 35, 'flat', 2),
('ext-3', 'Unlimited Soft Drinks', 5, 'per_person', 3)
ON CONFLICT (id) DO NOTHING;

-- RLS Policies
ALTER TABLE rooms ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public Access" ON rooms FOR ALL USING (true);
ALTER TABLE services ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public Access" ON services FOR ALL USING (true);
ALTER TABLE staff_members ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public Access" ON staff_members FOR ALL USING (true);
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public Access" ON customers FOR ALL USING (true);
ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public Access" ON bookings FOR ALL USING (true);
ALTER TABLE waitlist ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public Access" ON waitlist FOR ALL USING (true);
ALTER TABLE room_blocks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public Access" ON room_blocks FOR ALL USING (true);
ALTER TABLE recurring_blocks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public Access" ON recurring_blocks FOR ALL USING (true);
ALTER TABLE venue_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public Access" ON venue_settings FOR ALL USING (true);
ALTER TABLE operating_hours ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public Access" ON operating_hours FOR ALL USING (true);
ALTER TABLE special_hours ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public Access" ON special_hours FOR ALL USING (true);
ALTER TABLE promo_codes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public Access" ON promo_codes FOR ALL USING (true);
ALTER TABLE extras ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public Access" ON extras FOR ALL USING (true);
