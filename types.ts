
export enum RateType {
  EARLY_BIRD = 'EARLY_BIRD',
  CLASSIC = 'CLASSIC'
}

export enum BookingStatus {
  PENDING = 'PENDING',
  CONFIRMED = 'CONFIRMED',
  CANCELLED = 'CANCELLED',
  NO_SHOW = 'NO_SHOW'
}

export interface Room {
  id: string;
  code: 'A' | 'B' | 'C';
  name: string;
  min_capacity: number;
  max_capacity: number;
  is_active: boolean;
}

export interface Service {
  id: string;
  name: string;
  durationMinutes: number;
  basePrice: number;
  description?: string;
  enabled: boolean;
}

export interface StaffMember {
  id: string;
  name: string;
  enabled: boolean;
  servicesOffered: string[]; // ids of services
  bufferBefore: number; // minutes
  bufferAfter: number; // minutes
}

export interface MagicLink {
  token: string;
  bookingId: string;
  expiresAt: number;
}

export interface Extra {
  id: string;
  name: string;
  description?: string;
  infoText?: string;
  price: number;
  pricingMode: 'flat' | 'per_person';
  enabled: boolean;
  sortOrder: number;
}

export interface BookingExtraSelection {
  extraId: string;
  nameSnapshot: string;
  priceSnapshot: number;
  pricingModeSnapshot: 'flat' | 'per_person';
  quantity: number;
  lineTotal: number;
}

export interface Booking {
  id: string;
  booking_ref?: string;
  room_id: string;
  room_name: string;
  service_id?: string;
  staff_id?: string;
  start_at: string; // ISO
  end_at: string; // ISO
  status: BookingStatus;
  guests: number;
  customer_name: string;
  customer_surname?: string;
  customer_email: string;
  customer_phone?: string;
  notes?: string;
  base_total: number;
  extras_hours: number;
  extras_price: number;
  discount_amount: number;
  promo_code?: string;
  promo_discount_amount?: number;
  total_price: number;
  created_at: string;
  source?: 'public' | 'admin';
  magicToken?: string;
  // Deposit tracking
  deposit_amount: number;
  deposit_paid: boolean;
  deposit_forfeited?: boolean;
  // Extras
  extras?: BookingExtraSelection[];
  extras_total?: number;
}

export interface WaitlistEntry {
  id: string;
  name: string;
  surname?: string;
  phone: string;
  preferredDate: string; // "YYYY-MM-DD"
  preferredTime?: string; // "HH:MM"
  guests: number;
  status: 'active' | 'contacted' | 'closed';
  created_at: string; // ISO string
}

export interface RoomBlock {
  id: string;
  roomId: string;
  start_at: string;
  end_at: string;
  reason?: string;
  createdAt: number;
}

export interface RecurringBlock {
  id: string;
  dayOfWeek: number; // 0-6
  roomId: string;
  startTime: string; // HH:mm
  endTime: string; // HH:mm
  reason?: string;
  enabled: boolean;
}

export interface DayOperatingHours {
  day: number;
  open: string;
  close: string;
  enabled: boolean;
}

export interface SpecialHours {
  date: string; // YYYY-MM-DD
  enabled: boolean;
  open?: string;
  close?: string;
}

export interface PromoCode {
  id: string;
  code: string;
  enabled: boolean;
  percentOff?: number;
  fixedOff?: number;
  startDate: string;
  endDate: string;
  minGuests?: number;
  maxUses?: number;
  uses: number;
}

export interface Customer {
  id: string;
  name: string;
  surname?: string;
  email: string;
  phone?: string;
  notes?: string;
  totalBookings: number;
  totalSpend: number;
  createdAt: number;
  updatedAt: number;
  lastBookingAt?: number;
}

export interface AdminUser {
  id: string;
  email: string;
  role: 'admin' | 'staff';
}

export interface VenueSettings {
  cancelCutoffHours: number;
  rescheduleCutoffHours: number;
  releasePendingOnPaymentFailure: boolean;
  // Deposit Settings
  deposit_enabled: boolean;
  deposit_amount: number;
  // Lead Time Settings
  minDaysBeforeBooking: number;
  minHoursBeforeBooking: number;
}

export interface CalendarSyncConfig {
  enabled: boolean;
  token: string;
  includeCustomerName: boolean;
  includeBlocks: boolean;
  includePending: boolean;
  lastRegeneratedAt: string;
}
