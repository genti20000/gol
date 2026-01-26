import { Room, DayOperatingHours } from './types';

export const LOGO_URL = "https://files.londonkaraoke.club/uploads/1768098773_lkc_512.png";
export const WHATSAPP_URL = "https://wa.me/447761383514";
export const WHATSAPP_PREFILL_ENABLED = true;

export const SLOT_MINUTES = 15;
export const BUFFER_MINUTES = 15;
export const BASE_DURATION_HOURS = 2;

export const LS_BOOKINGS = "lkc_bookings";
export const LS_HOLDS = "lkc_holds";
export const LS_OPERATING_HOURS = "lkc_operating_hours";
export const LS_SPECIAL_HOURS = "lkc_special_hours";
export const LS_BLOCKS = "lkc_room_blocks";
export const LS_RECURRING_BLOCKS = "lkc_recurring_blocks";
export const LS_PROMO_CODES = "lkc_promo_codes";
export const LS_ADMIN_USERS = "lkc_admin_users";
export const LS_SERVICES = "lkc_services";
export const LS_STAFF = "lkc_staff";
export const LS_SETTINGS = "lkc_settings";
export const LS_CUSTOMERS = "lkc_customers";
export const LS_WAITLIST = "lkc_waitlist";
export const LS_CAL_SYNC = "lkc_calendar_sync";
export const LS_EXTRAS = "lkc_extras";

export const ROOMS: Room[] = [
  { id: 'room-a', code: 'A', name: 'Terrace Bar', min_capacity: 8, max_capacity: 100, is_active: true },
  { id: 'room-b', code: 'B', name: 'Vox Room', min_capacity: 8, max_capacity: 100, is_active: true },
  { id: 'room-c', code: 'C', name: 'Attic', min_capacity: 8, max_capacity: 100, is_active: true },
];

export const PRICING_TIERS = [
  { min: 8, max: 8, price: 152 },
  { min: 9, max: 9, price: 171 },
  { min: 10, max: 10, price: 190 },
  { min: 11, max: 11, price: 209 },
  { min: 12, max: 12, price: 228 },
  { min: 13, max: 13, price: 247 },
  { min: 14, max: 14, price: 266 },
  { min: 15, max: 15, price: 285 },
  { min: 16, max: 16, price: 304 },
  { min: 17, max: 17, price: 323 },
  { min: 18, max: 18, price: 342 },
  { min: 19, max: 19, price: 361 },
  { min: 20, max: 20, price: 380 },
  { min: 21, max: 21, price: 399 },
  { min: 22, max: 22, price: 418 },
  { min: 23, max: 23, price: 437 },
  { min: 24, max: 24, price: 456 },
  { min: 25, max: 25, price: 475 },
  { min: 26, max: 26, price: 494 },
  { min: 27, max: 27, price: 513 },
  { min: 28, max: 28, price: 532 },
  { min: 29, max: 29, price: 551 },
  { min: 30, max: 30, price: 570 },
  { min: 31, max: 40, price: 650 },
  { min: 41, max: 50, price: 700 },
  { min: 51, max: 60, price: 750 },
  { min: 61, max: 70, price: 800 },
  { min: 71, max: 80, price: 850 },
  { min: 81, max: 90, price: 900 },
  { min: 91, max: 100, price: 1000 },
];

export const EXTRAS = [
  { hours: 0, price: 0, label: 'None' },
  { hours: 1, price: 100, label: '+1 Hour (£100)' },
  { hours: 2, price: 175, label: '+2 Hours (£175)' },
  { hours: 3, price: 250, label: '+3 Hours (£250)' },
  { hours: 4, price: 300, label: '+4 Hours (£300)' }
];

export const MIDWEEK_DISCOUNT_PERCENT = 25; // Mon, Tue, Wed

export const DEFAULT_OPERATING_HOURS: DayOperatingHours[] = [
  { day: 0, open: '15:00', close: '03:00', enabled: false }, // Sunday CLOSED
  { day: 1, open: '22:00', close: '03:00', enabled: true },
  { day: 2, open: '22:00', close: '03:00', enabled: true },
  { day: 3, open: '17:00', close: '03:00', enabled: true },
  { day: 4, open: '17:00', close: '03:00', enabled: true },
  { day: 5, open: '17:00', close: '03:00', enabled: true },
  { day: 6, open: '15:00', close: '03:00', enabled: true },
];

export const getGuestLabel = (guests: number) => {
  const tier = PRICING_TIERS.find(t => guests >= t.min && guests <= t.max);
  if (!tier) return `${guests} Guests`;
  if (tier.min === tier.max) return `${tier.min} Guests`;
  return `${tier.min}–${tier.max} Guests`;
};