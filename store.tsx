"use client";

import React, { createContext, useContext, useState, useEffect, useMemo, useCallback } from 'react';
import {
  Booking,
  BookingStatus,
  Room,
  Service,
  StaffMember,
  WaitlistEntry,
  RoomBlock,
  RecurringBlock,
  SpecialHours,
  PromoCode,
  Customer,
  VenueSettings,
  CalendarSyncConfig,
  Extra,
  DayOperatingHours
} from './types';
import {
  ROOMS,
  PRICING_TIERS,
  EXTRAS as SESSION_EXTRAS,
  MIDWEEK_DISCOUNT_PERCENT,
  DEFAULT_OPERATING_HOURS,
  SLOT_MINUTES,
  BUFFER_MINUTES,
  WHATSAPP_URL
} from './constants';
import { supabase } from './lib/supabase';

const DEFAULT_SETTINGS: VenueSettings = {
  cancelCutoffHours: 24,
  rescheduleCutoffHours: 48,
  releasePendingOnPaymentFailure: true,
  deposit_enabled: false,
  deposit_amount: 0,
  minDaysBeforeBooking: 0,
  minHoursBeforeBooking: 0
};

const DEFAULT_CAL_SYNC: CalendarSyncConfig = {
  enabled: false,
  token: Math.random().toString(36).substring(7),
  includeCustomerName: true,
  includeBlocks: true,
  includePending: true,
  lastRegeneratedAt: new Date().toISOString()
};

const DEFAULT_SERVICES: Service[] = [
  { id: 'srv-1', name: 'Standard Karaoke Session', durationMinutes: 120, basePrice: 0, enabled: true },
];

const DEFAULT_EXTRAS: Extra[] = [
  { id: 'ext-1', name: 'Pizza Party Platter', price: 45, pricingMode: 'flat', enabled: true, sortOrder: 1 },
  { id: 'ext-2', name: 'Bottle of Prosecco', price: 35, pricingMode: 'flat', enabled: true, sortOrder: 2 },
  { id: 'ext-3', name: 'Unlimited Soft Drinks', price: 5, pricingMode: 'per_person', enabled: true, sortOrder: 3 },
];

interface StoreContextValue {
  loading: boolean;
  loadError: string | null;
  bookings: Booking[];
  rooms: Room[];
  services: Service[];
  staff: StaffMember[];
  blocks: RoomBlock[];
  recurringBlocks: RecurringBlock[];
  specialHours: SpecialHours[];
  settings: VenueSettings;
  promoCodes: PromoCode[];
  customers: Customer[];
  waitlist: WaitlistEntry[];
  calSync: CalendarSyncConfig;
  extras: Extra[];
  operatingHours: DayOperatingHours[];
  getOperatingWindow: (date: string) => { open: string, close: string } | null;
  calculatePricing: (date: string, guests: number, extraHours: number, promoCode?: string) => any;
  getValidStartTimes: (date: string, durationMinutes: number, staffId?: string, serviceId?: string) => string[];
  findFirstAvailableRoomAndStaff: (startAt: string, endAt: string, staffId?: string, serviceId?: string) => any;
  addBooking: (booking: Partial<Booking>) => Promise<Booking | null>;
  updateBooking: (id: string, patch: Partial<Booking>) => Promise<void>;
  getBookingByMagicToken: (token: string) => Booking | undefined;
  canRescheduleOrCancel: (booking: Booking, type: 'reschedule' | 'cancel') => boolean;
  getEnabledExtras: () => Extra[];
  computeExtrasTotal: (selection: Record<string, number>, guests: number) => number;
  buildBookingExtrasSnapshot: (selection: Record<string, number>, guests: number) => any;
  addWaitlistEntry: (entry: Partial<WaitlistEntry>) => Promise<{ ok: boolean; reason?: string }>;
  getWaitlistForDate: (date: string) => WaitlistEntry[];
  setWaitlistStatus: (id: string, status: WaitlistEntry['status']) => Promise<void>;
  deleteWaitlistEntry: (id: string) => Promise<void>;
  buildWaitlistMessage: (data: any) => string;
  buildWhatsAppUrl: (message: string) => string;
  getBusyIntervals: (date: string, roomId: string) => any[];
  getBookingsForDate: (date: string) => Booking[];
  getBlocksForDate: (date: string) => RoomBlock[];
  addBlock: (block: Partial<RoomBlock>) => Promise<void>;
  deleteBlock: (id: string) => Promise<void>;
  toggleRecurringBlock: (id: string, enabled: boolean) => Promise<void>;
  deleteRecurringBlock: (id: string) => Promise<void>;
  updateSettings: (patch: Partial<VenueSettings>) => Promise<void>;
  addPromoCode: (promo: Partial<PromoCode>) => Promise<void>;
  updatePromoCode: (id: string, patch: Partial<PromoCode>) => Promise<void>;
  deletePromoCode: (id: string) => Promise<void>;
  getCalendarSyncConfig: () => CalendarSyncConfig;
  setCalendarSyncConfig: (config: Partial<CalendarSyncConfig>) => void;
  regenerateCalendarToken: () => void;
  validateInterval: (roomId: string, start: string, end: string, excludeBookingId?: string, staffId?: string, skipWindowCheck?: boolean) => { ok: boolean; reason?: string };
  addCustomer: (customer: Partial<Customer>) => Promise<Customer | null>;
  updateCustomer: (id: string, patch: Partial<Customer>) => Promise<void>;
  deleteCustomer: (id: string) => Promise<void>;
  updateOperatingHours: (day: number, patch: Partial<DayOperatingHours>) => Promise<void>;
  addService: (service: Partial<Service>) => Promise<void>;
  updateService: (id: string, patch: Partial<Service>) => Promise<void>;
  deleteService: (id: string) => Promise<void>;
  addExtra: (extra: Partial<Extra>) => Promise<void>;
  updateExtra: (id: string, patch: Partial<Extra>) => Promise<void>;
  deleteExtra: (id: string) => Promise<void>;
  updateStaff: (id: string, patch: Partial<StaffMember>) => Promise<void>;
  addStaff: (member: Partial<StaffMember>) => Promise<void>;
  deleteStaff: (id: string) => Promise<void>;
}

const StoreContext = createContext<StoreContextValue | null>(null);

type StoreMode = 'public' | 'admin';

export function StoreProvider({ children, mode = 'public' }: { children: React.ReactNode; mode?: StoreMode }) {
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [rooms, setRooms] = useState<Room[]>(ROOMS);
  const [services, setServices] = useState<Service[]>(DEFAULT_SERVICES);
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [blocks, setBlocks] = useState<RoomBlock[]>([]);
  const [recurringBlocks, setRecurringBlocks] = useState<RecurringBlock[]>([]);
  const [specialHours, setSpecialHours] = useState<SpecialHours[]>([]);
  const [operatingHours, setOperatingHours] = useState(DEFAULT_OPERATING_HOURS);
  const [settings, setSettings] = useState<VenueSettings>(DEFAULT_SETTINGS);
  const [promoCodes, setPromoCodes] = useState<PromoCode[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [waitlist, setWaitlist] = useState<WaitlistEntry[]>([]);
  const [calSync, setCalSync] = useState<CalendarSyncConfig>(DEFAULT_CAL_SYNC);
  const [extras, setExtras] = useState<Extra[]>(DEFAULT_EXTRAS);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        setLoadError(null);

        const bookingsQuery = mode === 'admin'
          ? supabase.from('bookings').select('*')
          : supabase
            .from('bookings')
            .select('id,room_id,room_name,service_id,staff_id,start_at,end_at,status,guests');

        const roomsQuery = supabase.from('rooms').select('*');
        const servicesQuery = supabase.from('services').select('*');
        const blocksQuery = supabase.from('room_blocks').select('*');
        const specialHoursQuery = supabase.from('special_hours').select('*');
        const operatingHoursQuery = supabase.from('operating_hours').select('*').order('day', { ascending: true });
        const settingsQuery = supabase.from('venue_settings').select('*').single();
        const extrasQuery = supabase.from('extras').select('*').order('sort_order', { ascending: true });
        const staffQuery = mode === 'admin'
          ? supabase.from('staff_members').select('*')
          : Promise.resolve({ data: null, error: null });
        const recurringBlocksQuery = mode === 'admin'
          ? supabase.from('recurring_blocks').select('*')
          : Promise.resolve({ data: null, error: null });
        const promoCodesQuery = mode === 'admin'
          ? supabase.from('promo_codes').select('*')
          : Promise.resolve({ data: null, error: null });
        const customersQuery = mode === 'admin'
          ? supabase.from('customers').select('*')
          : Promise.resolve({ data: null, error: null });
        const waitlistQuery = mode === 'admin'
          ? supabase.from('waitlist').select('*')
          : Promise.resolve({ data: null, error: null });

        const [
          { data: bookingsData, error: bookingsError },
          { data: roomsData, error: roomsError },
          { data: servicesData, error: servicesError },
          { data: blocksData, error: blocksError },
          { data: specialHoursData, error: specialHoursError },
          { data: operatingHoursData, error: operatingHoursError },
          { data: settingsData, error: settingsError },
          { data: extrasData, error: extrasError },
          { data: staffData, error: staffError },
          { data: recurringBlocksData, error: recurringBlocksError },
          { data: promoCodesData, error: promoCodesError },
          { data: customersData, error: customersError },
          { data: waitlistData, error: waitlistError }
        ] = await Promise.all([
          bookingsQuery,
          roomsQuery,
          servicesQuery,
          blocksQuery,
          specialHoursQuery,
          operatingHoursQuery,
          settingsQuery,
          extrasQuery,
          staffQuery,
          recurringBlocksQuery,
          promoCodesQuery,
          customersQuery,
          waitlistQuery
        ]);

        const queryErrors = [
          { name: 'bookings', error: bookingsError },
          { name: 'rooms', error: roomsError },
          { name: 'services', error: servicesError },
          { name: 'room blocks', error: blocksError },
          { name: 'special hours', error: specialHoursError },
          { name: 'operating hours', error: operatingHoursError },
          { name: 'venue settings', error: settingsError },
          { name: 'extras', error: extrasError },
          { name: 'staff members', error: staffError },
          { name: 'recurring blocks', error: recurringBlocksError },
          { name: 'promo codes', error: promoCodesError },
          { name: 'customers', error: customersError },
          { name: 'waitlist', error: waitlistError }
        ].filter(({ error }) => error);

        if (queryErrors.length > 0) {
          queryErrors.forEach(({ name, error }) => {
            console.error(`Error fetching ${name}:`, error);
          });
          setLoadError('Failed to load data. Please refresh and try again.');
          return;
        }

        if (bookingsData) setBookings(bookingsData.map(b => ({
          ...b,
          id: b.id,
          room_id: b.room_id,
          room_name: b.room_name,
          service_id: b.service_id,
          staff_id: b.staff_id,
          start_at: b.start_at,
          end_at: b.end_at,
          status: b.status as BookingStatus,
          guests: b.guests,
          customer_name: b.customer_name ?? '',
          customer_surname: b.customer_surname ?? '',
          customer_email: b.customer_email ?? '',
          customer_phone: b.customer_phone ?? '',
          notes: b.notes,
          base_total: b.base_total ?? 0,
          extras_hours: b.extras_hours ?? 0,
          extras_price: b.extras_price ?? 0,
          discount_amount: b.discount_amount ?? 0,
          promo_code: b.promo_code,
          promo_discount_amount: b.promo_discount_amount ?? 0,
          total_price: b.total_price ?? 0,
          created_at: b.created_at ?? new Date().toISOString(),
          source: b.source,
          magicToken: b.magic_token,
          extras: b.extras_snapshot,
          extras_total: b.extras_total,
          deposit_amount: b.deposit_amount ?? 0,
          deposit_paid: b.deposit_paid ?? false,
          deposit_forfeited: b.deposit_forfeited ?? false
        })));
        if (roomsData) setRooms(roomsData as Room[]);
        if (servicesData) setServices(servicesData as Service[]);
        if (blocksData) setBlocks(blocksData.map(b => ({
          ...b,
          roomId: b.room_id,
          createdAt: new Date(b.created_at).getTime()
        })));
        if (specialHoursData) setSpecialHours(specialHoursData.map(sh => ({
          ...sh,
          open: sh.open_time,
          close: sh.close_time
        })));
        if (operatingHoursData) setOperatingHours(operatingHoursData.map(oh => ({
          day: oh.day,
          open: oh.open_time,
          close: oh.close_time,
          enabled: oh.enabled
        })));
        if (settingsData) setSettings({
          cancelCutoffHours: settingsData.cancel_cutoff_hours,
          rescheduleCutoffHours: settingsData.reschedule_cutoff_hours,
          releasePendingOnPaymentFailure: settingsData.release_pending_on_failure,
          deposit_enabled: settingsData.deposit_enabled,
          deposit_amount: settingsData.deposit_amount,
          minDaysBeforeBooking: settingsData.min_days_before_booking,
          minHoursBeforeBooking: settingsData.min_hours_before_booking
        });
        if (extrasData) setExtras(extrasData.map(e => ({
          ...e,
          pricingMode: e.pricing_mode as 'flat' | 'per_person',
          sortOrder: e.sort_order
        })));
        if (staffData) setStaff(staffData.map(s => ({
          ...s,
          servicesOffered: s.services_offered,
          bufferBefore: s.buffer_before,
          bufferAfter: s.buffer_after
        })));
        if (recurringBlocksData) setRecurringBlocks(recurringBlocksData.map(rb => ({
          ...rb,
          dayOfWeek: rb.day_of_week,
          roomId: rb.room_id,
          startTime: rb.start_time,
          endTime: rb.end_time
        })));
        if (promoCodesData) setPromoCodes(promoCodesData.map(pc => ({
          ...pc,
          percentOff: pc.percent_off,
          fixedOff: pc.fixed_off,
          startDate: pc.start_date,
          endDate: pc.end_date,
          minGuests: pc.min_guests,
          maxUses: pc.max_uses
        })));
        if (customersData) setCustomers(customersData.map(c => ({
          ...c,
          totalBookings: c.total_bookings,
          totalSpend: c.total_spend,
          createdAt: new Date(c.created_at).getTime(),
          updatedAt: new Date(c.updated_at).getTime(),
          lastBookingAt: c.last_booking_at ? new Date(c.last_booking_at).getTime() : undefined
        })));
        if (waitlistData) setWaitlist(waitlistData.map(w => ({
          ...w,
          preferredDate: w.preferred_date,
          preferredTime: w.preferred_time
        })));

      } catch (err) {
        console.error("Error fetching data from Supabase:", err);
        setLoadError('Failed to load data. Please refresh and try again.');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [mode]);

  const getOperatingWindow = useCallback((date: string) => {
    const special = specialHours.find(s => s.date === date);
    if (special) return special.enabled ? { open: special.open!, close: special.close! } : null;
    const day = new Date(date + 'T00:00:00').getDay();
    const config = operatingHours.find(h => h.day === day);
    if (config && config.enabled) return { open: config.open, close: config.close };
    return null;
  }, [specialHours, operatingHours]);

  const calculatePricing = useCallback((date: string, guests: number, extraHours: number, promoCode?: string) => {
    const tier = PRICING_TIERS.find(t => guests >= t.min && guests <= t.max);
    const basePrice = tier ? tier.price : 0;
    const extraPrice = SESSION_EXTRAS.find(e => e.hours === extraHours)?.price || 0;
    const baseTotal = basePrice;
    const day = new Date(date + 'T00:00:00').getDay();
    const isMidweek = day >= 1 && day <= 3;
    const discountPercent = isMidweek ? MIDWEEK_DISCOUNT_PERCENT : 0;
    const discountAmount = Math.round((baseTotal + extraPrice) * (discountPercent / 100));
    let promoDiscountAmount = 0;
    if (promoCode) {
      const promo = promoCodes.find(p => p.code === promoCode && p.enabled);
      if (promo) {
        if (promo.percentOff) promoDiscountAmount = Math.round((baseTotal + extraPrice - discountAmount) * (promo.percentOff / 100));
        else if (promo.fixedOff) promoDiscountAmount = promo.fixedOff;
      }
    }
    const totalPrice = baseTotal + extraPrice - discountAmount - promoDiscountAmount;
    return { baseTotal, extrasPrice: extraPrice, discountAmount, promoDiscountAmount, totalPrice };
  }, [promoCodes]);

  const validateInterval = useCallback((roomId: string, start: string, end: string, excludeBookingId?: string, staffId?: string, skipWindowCheck = false) => {
    const startTs = new Date(start).getTime();
    const endTs = new Date(end).getTime();
    if (!skipWindowCheck) {
      const d = new Date(startTs);
      const localDate = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      const window = getOperatingWindow(localDate);
      if (!window) return { ok: false, reason: 'Venue is closed' };
      const openParts = window.open.split(':');
      const closeParts = window.close.split(':');
      const startOfDayTs = new Date(localDate + 'T00:00:00').getTime();
      const openTs = startOfDayTs + (parseInt(openParts[0]) * 3600000) + (parseInt(openParts[1]) * 60000);
      let closeTs = startOfDayTs + (parseInt(closeParts[0]) * 3600000) + (parseInt(closeParts[1]) * 60000);
      if (closeTs <= openTs) closeTs += 24 * 3600000;
      if (startTs < openTs || endTs > closeTs) return { ok: false, reason: 'Outside hours' };
    }
    const conflicts = bookings.filter(b => b.id !== excludeBookingId && b.status !== BookingStatus.CANCELLED && b.room_id === roomId && (startTs < new Date(b.end_at).getTime() && endTs > new Date(b.start_at).getTime()));
    if (conflicts.length > 0) return { ok: false, reason: 'Room occupied' };
    const blockConflicts = blocks.filter(b => b.roomId === roomId && (startTs < new Date(b.end_at).getTime() && endTs > new Date(b.start_at).getTime()));
    if (blockConflicts.length > 0) return { ok: false, reason: 'Room blocked' };
    return { ok: true };
  }, [bookings, blocks, getOperatingWindow]);

  const getValidStartTimes = useCallback((date: string, durationMinutes: number, staffId?: string, serviceId?: string) => {
    const window = getOperatingWindow(date);
    if (!window || !date) return [];
    const times: string[] = [];
    const openH = parseInt(window.open.split(':')[0]);
    const openM = parseInt(window.open.split(':')[1]);
    let closeH = parseInt(window.close.split(':')[0]);
    const closeM = parseInt(window.close.split(':')[1]);
    if (closeH <= openH) closeH += 24;
    const startMin = openH * 60 + openM;
    const endMin = closeH * 60 + closeM;
    const [y, mm, dd] = date.split('-').map(Number);
    const baseTs = new Date(y, mm - 1, dd, 0, 0, 0).getTime();
    const leadMs = (settings.minDaysBeforeBooking * 24 + settings.minHoursBeforeBooking) * 3600000;
    const minStartTs = Date.now() + leadMs;
    for (let m = startMin; m <= endMin - durationMinutes; m += SLOT_MINUTES) {
      const slotStart = new Date(baseTs + m * 60000);
      if (slotStart.getTime() < minStartTs) continue;
      const startAt = slotStart.toISOString();
      const endAt = new Date(slotStart.getTime() + durationMinutes * 60000).toISOString();
      if (rooms.some(r => validateInterval(r.id, startAt, endAt, undefined, staffId, true).ok)) {
        times.push(`${slotStart.getHours().toString().padStart(2, '0')}:${slotStart.getMinutes().toString().padStart(2, '0')}`);
      }
    }
    return times;
  }, [rooms, getOperatingWindow, settings.minDaysBeforeBooking, settings.minHoursBeforeBooking, validateInterval]);

  const findFirstAvailableRoomAndStaff = useCallback((startAt: string, endAt: string, staffId?: string, serviceId?: string) => {
    for (const r of rooms) {
      if (validateInterval(r.id, startAt, endAt, undefined, staffId, true).ok) return { room_id: r.id, staff_id: staffId };
    }
    return null;
  }, [rooms, validateInterval]);

  const addBooking = useCallback(async (booking: Partial<Booking>) => {
    const normalizedStaffId = typeof booking.staff_id === 'string' && booking.staff_id.trim().length > 0
      ? booking.staff_id
      : null;
    const magicToken = Math.random().toString(36).substring(2, 15);
    const { data, error } = await supabase.from('bookings').insert([{
      room_id: booking.room_id,
      room_name: booking.room_name,
      service_id: booking.service_id,
      staff_id: normalizedStaffId,
      start_at: booking.start_at,
      end_at: booking.end_at,
      status: booking.status,
      guests: booking.guests,
      customer_name: booking.customer_name,
      customer_surname: booking.customer_surname,
      customer_email: booking.customer_email,
      customer_phone: booking.customer_phone,
      notes: booking.notes,
      base_total: booking.base_total,
      extras_hours: booking.extras_hours,
      extras_price: booking.extras_price,
      discount_amount: booking.discount_amount,
      promo_code: booking.promo_code,
      promo_discount_amount: booking.promo_discount_amount,
      total_price: booking.total_price,
      magic_token: magicToken,
      source: booking.source,
      deposit_amount: booking.deposit_amount,
      deposit_paid: booking.deposit_paid,
      deposit_forfeited: booking.deposit_forfeited,
      extras_total: booking.extras_total,
      extras_snapshot: booking.extras
    }]).select().single();
    if (error) {
      console.error("Supabase Error:", error);
      alert(`Database Error: ${error.message}`);
      return null;
    }
    if (!data) {
      console.error("No data returned from insert");
      alert("Error: Database did not return a confirmation.");
      return null;
    }
    const newBooking = { ...data, magicToken: data.magic_token, booking_ref: data.booking_ref } as Booking;
    setBookings(prev => [...prev, newBooking]);

    // Auto-create or update customer in CRM
    if (booking.customer_email) {
      try {
        // Check if customer already exists
        const { data: existingCustomer } = await supabase
          .from('customers')
          .select('*')
          .eq('email', booking.customer_email)
          .single();

        if (existingCustomer) {
          // Update existing customer
          const { data: updated } = await supabase
            .from('customers')
            .update({
              total_bookings: existingCustomer.total_bookings + 1,
              total_spend: existingCustomer.total_spend + (booking.total_price || 0),
              last_booking_at: new Date().toISOString(),
              updated_at: new Date().toISOString()
            })
            .eq('id', existingCustomer.id)
            .select()
            .single();

          if (updated) {
            setCustomers(prev => prev.map(c => c.id === updated.id ? {
              ...updated,
              totalBookings: updated.total_bookings,
              totalSpend: updated.total_spend,
              createdAt: new Date(updated.created_at).getTime(),
              updatedAt: new Date(updated.updated_at).getTime(),
              lastBookingAt: new Date(updated.last_booking_at).getTime()
            } : c));
          }
        } else {
          // Create new customer
          const fullName = booking.customer_surname
            ? `${booking.customer_name} ${booking.customer_surname}`
            : booking.customer_name;

          const { data: newCustomer } = await supabase
            .from('customers')
            .insert([{
              name: fullName,
              surname: booking.customer_surname,
              email: booking.customer_email,
              phone: booking.customer_phone,
              total_bookings: 1,
              total_spend: booking.total_price || 0,
              last_booking_at: new Date().toISOString()
            }])
            .select()
            .single();

          if (newCustomer) {
            setCustomers(prev => [...prev, {
              ...newCustomer,
              totalBookings: newCustomer.total_bookings,
              totalSpend: newCustomer.total_spend,
              createdAt: new Date(newCustomer.created_at).getTime(),
              updatedAt: new Date(newCustomer.updated_at).getTime(),
              lastBookingAt: new Date(newCustomer.last_booking_at).getTime()
            }]);
          }
        }
      } catch (err) {
        console.warn("Failed to auto-sync customer to CRM:", err);
        // Don't fail the booking if customer sync fails
      }
    }

    return newBooking;
  }, []);

  const updateBooking = useCallback(async (id: string, patch: Partial<Booking>) => {
    const payload: Record<string, unknown> = {};
    const assign = (key: string, value: unknown) => {
      if (value !== undefined) payload[key] = value;
    };

    assign('status', patch.status);
    assign('notes', patch.notes);
    assign('deposit_paid', patch.deposit_paid);
    assign('deposit_forfeited', patch.deposit_forfeited);
    assign('customer_name', patch.customer_name);
    assign('customer_surname', patch.customer_surname);
    assign('customer_email', patch.customer_email);
    assign('customer_phone', patch.customer_phone);
    assign('start_at', patch.start_at);
    assign('end_at', patch.end_at);
    assign('guests', patch.guests);
    assign('room_id', patch.room_id);
    assign('room_name', patch.room_name);
    if ('staff_id' in patch) payload.staff_id = patch.staff_id ?? null;
    if ('service_id' in patch) payload.service_id = patch.service_id ?? null;
    assign('base_total', patch.base_total);
    assign('extras_hours', patch.extras_hours);
    assign('extras_price', patch.extras_price);
    assign('discount_amount', patch.discount_amount);
    assign('promo_code', patch.promo_code);
    assign('promo_discount_amount', patch.promo_discount_amount);
    assign('total_price', patch.total_price);
    assign('deposit_amount', patch.deposit_amount);
    assign('extras_total', patch.extras_total);
    assign('extras_snapshot', patch.extras);

    const { error } = await supabase.from('bookings').update(payload).eq('id', id);
    if (!error) setBookings(prev => prev.map(b => b.id === id ? { ...b, ...patch } : b));
  }, []);

  const getBookingByMagicToken = useCallback((token: string) => bookings.find(b => b.magicToken === token), [bookings]);

  const canRescheduleOrCancel = useCallback((booking: Booking, type: 'reschedule' | 'cancel') => {
    const cutoff = type === 'reschedule' ? settings.rescheduleCutoffHours : settings.cancelCutoffHours;
    return (new Date(booking.start_at).getTime() - Date.now()) > (cutoff * 3600000);
  }, [settings]);

  const getEnabledExtras = useCallback(() => extras.filter(e => e.enabled), [extras]);

  const computeExtrasTotal = useCallback((selection: Record<string, number>, guests: number) => {
    return Object.entries(selection).reduce((acc, [id, qty]) => {
      const extra = extras.find(e => e.id === id);
      if (!extra) return acc;
      return acc + ((extra.pricingMode === 'per_person' ? extra.price * guests : extra.price) * qty);
    }, 0);
  }, [extras]);

  const buildBookingExtrasSnapshot = useCallback((selection: Record<string, number>, guests: number) => {
    return Object.entries(selection).map(([id, qty]) => {
      const extra = extras.find(e => e.id === id)!;
      const unit = extra.pricingMode === 'per_person' ? extra.price * guests : extra.price;
      return { extraId: id, nameSnapshot: extra.name, priceSnapshot: extra.price, pricingModeSnapshot: extra.pricingMode, quantity: qty, lineTotal: unit * qty };
    });
  }, [extras]);

  const addWaitlistEntry = useCallback(async (entry: Partial<WaitlistEntry>) => {
    const { data, error } = await supabase.from('waitlist').insert([{ name: entry.name, surname: entry.surname, phone: entry.phone, preferred_date: entry.preferredDate, preferred_time: entry.preferredTime, guests: entry.guests, status: 'active' }]).select().single();
    if (error) return { ok: false, reason: error.message };
    const newEntry = { ...data, preferredDate: data.preferred_date, preferredTime: data.preferred_time } as WaitlistEntry;
    setWaitlist(prev => [...prev, newEntry]);
    return { ok: true };
  }, []);

  const getWaitlistForDate = useCallback((date: string) => waitlist.filter(w => w.preferredDate === date), [waitlist]);
  const setWaitlistStatus = useCallback(async (id: string, status: WaitlistEntry['status']) => {
    const { error } = await supabase.from('waitlist').update({ status }).eq('id', id);
    if (!error) setWaitlist(prev => prev.map(w => w.id === id ? { ...w, status } : w));
  }, []);
  const deleteWaitlistEntry = useCallback(async (id: string) => {
    const { error } = await supabase.from('waitlist').delete().eq('id', id);
    if (!error) setWaitlist(prev => prev.filter(w => w.id !== id));
  }, []);

  const buildWaitlistMessage = useCallback((data: any) => `Hi, waitlist for ${data.preferredDate} at ${data.preferredTime || 'any time'} for ${data.guests} guests.`, []);
  const buildWhatsAppUrl = useCallback((message: string) => `${WHATSAPP_URL}?text=${encodeURIComponent(message)}`, []);

  const getBusyIntervals = useCallback((date: string, roomId: string) => {
    const dayB = bookings.filter(b => b.room_id === roomId && b.status !== BookingStatus.CANCELLED && b.start_at.startsWith(date));
    const dayBl = blocks.filter(b => b.roomId === roomId && b.start_at.startsWith(date));
    return [
      ...dayB.map(b => ({
        id: b.id,
        type: 'booking' as const,
        start: new Date(b.start_at).getTime(),
        end: new Date(b.end_at).getTime(),
        customer_name: b.customer_name,
        guests: b.guests,
        status: b.status,
        notes: b.notes,
        extras: b.extras
      })),
      ...dayBl.map(b => ({ id: b.id, type: 'block' as const, start: new Date(b.start_at).getTime(), end: new Date(b.end_at).getTime(), reason: b.reason }))
    ];
  }, [bookings, blocks]);

  const getBookingsForDate = useCallback((date: string) => bookings.filter(b => b.start_at.startsWith(date)), [bookings]);
  const getBlocksForDate = useCallback((date: string) => blocks.filter(b => b.start_at.startsWith(date)), [blocks]);

  const addBlock = useCallback(async (block: Partial<RoomBlock>) => {
    const { data, error } = await supabase.from('room_blocks').insert([{ room_id: block.roomId, start_at: block.start_at, end_at: block.end_at, reason: block.reason }]).select().single();
    if (!error) setBlocks(prev => [...prev, { ...data, roomId: data.room_id, createdAt: Date.now() } as RoomBlock]);
  }, []);
  const deleteBlock = useCallback(async (id: string) => {
    const { error } = await supabase.from('room_blocks').delete().eq('id', id);
    if (!error) setBlocks(prev => prev.filter(b => b.id !== id));
  }, []);
  const toggleRecurringBlock = useCallback(async (id: string, enabled: boolean) => {
    const { error } = await supabase.from('recurring_blocks').update({ enabled }).eq('id', id);
    if (!error) setRecurringBlocks(prev => prev.map(b => b.id === id ? { ...b, enabled } : b));
  }, []);
  const deleteRecurringBlock = useCallback(async (id: string) => {
    const { error } = await supabase.from('recurring_blocks').delete().eq('id', id);
    if (!error) setRecurringBlocks(prev => prev.filter(b => b.id !== id));
  }, []);

  const updateSettings = useCallback(async (patch: Partial<VenueSettings>) => {
    const { error } = await supabase.from('venue_settings').update({
      cancel_cutoff_hours: patch.cancelCutoffHours,
      reschedule_cutoff_hours: patch.rescheduleCutoffHours,
      release_pending_on_failure: patch.releasePendingOnPaymentFailure,
      deposit_enabled: patch.deposit_enabled,
      deposit_amount: patch.deposit_amount,
      min_days_before_booking: patch.minDaysBeforeBooking,
      min_hours_before_booking: patch.minHoursBeforeBooking
    }).eq('id', 1);
    if (!error) setSettings(prev => ({ ...prev, ...patch }));
  }, []);

  const addPromoCode = useCallback(async (promo: Partial<PromoCode>) => {
    const { data, error } = await supabase.from('promo_codes').insert([{
      code: promo.code,
      enabled: promo.enabled,
      percent_off: promo.percentOff,
      fixed_off: promo.fixedOff,
      start_date: promo.startDate,
      end_date: promo.endDate,
      min_guests: promo.minGuests,
      max_uses: promo.maxUses,
      uses: 0
    }]).select().single();
    if (!error && data) {
      setPromoCodes(prev => [...prev, {
        ...data,
        percentOff: data.percent_off,
        fixedOff: data.fixed_off,
        startDate: data.start_date,
        endDate: data.end_date,
        minGuests: data.min_guests,
        maxUses: data.max_uses
      }]);
    }
  }, []);
  const updatePromoCode = useCallback(async (id: string, patch: Partial<PromoCode>) => {
    await supabase.from('promo_codes').update(patch).eq('id', id);
    setPromoCodes(prev => prev.map(p => p.id === id ? { ...p, ...patch } : p));
  }, []);
  const deletePromoCode = useCallback(async (id: string) => {
    await supabase.from('promo_codes').delete().eq('id', id);
    setPromoCodes(prev => prev.filter(p => p.id !== id));
  }, []);

  const getCalendarSyncConfig = useCallback(() => calSync, [calSync]);
  const setCalendarSyncConfig = useCallback((config: Partial<CalendarSyncConfig>) => setCalSync(prev => ({ ...prev, ...config })), []);
  const regenerateCalendarToken = useCallback(() => setCalSync(prev => ({ ...prev, token: Math.random().toString(36).substring(7), lastRegeneratedAt: new Date().toISOString() })), []);

  const addCustomer = useCallback(async (customer: Partial<Customer>) => {
    const { data, error } = await supabase.from('customers').insert([{ ...customer, total_bookings: 0, total_spend: 0 }]).select().single();
    if (error) return null;
    const c = { ...data, totalBookings: data.total_bookings, totalSpend: data.total_spend, createdAt: Date.now(), updatedAt: Date.now() } as Customer;
    setCustomers(prev => [...prev, c]);
    return c;
  }, []);
  const updateCustomer = useCallback(async (id: string, patch: Partial<Customer>) => {
    await supabase.from('customers').update({ ...patch, updated_at: new Date().toISOString() }).eq('id', id);
    setCustomers(prev => prev.map(c => c.id === id ? { ...c, ...patch, updatedAt: Date.now() } : c));
  }, []);
  const deleteCustomer = useCallback(async (id: string) => {
    await supabase.from('customers').delete().eq('id', id);
    setCustomers(prev => prev.filter(c => c.id !== id));
  }, []);

  const updateOperatingHours = useCallback(async (day: number, patch: Partial<DayOperatingHours>) => {
    await supabase.from('operating_hours').update({ open_time: patch.open, close_time: patch.close, enabled: patch.enabled }).eq('day', day);
    setOperatingHours(prev => prev.map(oh => oh.day === day ? { ...oh, ...patch } : oh));
  }, []);

  const addService = useCallback(async (service: Partial<Service>) => {
    const { data, error } = await supabase.from('services').insert([service]).select().single();
    if (!error) setServices(prev => [...prev, data]);
  }, []);
  const updateService = useCallback(async (id: string, patch: Partial<Service>) => {
    await supabase.from('services').update(patch).eq('id', id);
    setServices(prev => prev.map(s => s.id === id ? { ...s, ...patch } : s));
  }, []);
  const deleteService = useCallback(async (id: string) => {
    await supabase.from('services').delete().eq('id', id);
    setServices(prev => prev.filter(s => s.id !== id));
  }, []);

  const toExtraDbPayload = useCallback((extra: Partial<Extra>) => {
    const { pricingMode, sortOrder, ...rest } = extra;
    const payload: Record<string, unknown> = { ...rest };
    if (pricingMode !== undefined) payload.pricing_mode = pricingMode;
    if (sortOrder !== undefined) payload.sort_order = sortOrder;
    return payload;
  }, []);

  const addExtra = useCallback(async (extra: Partial<Extra>) => {
    const id = `ext-${Date.now()}`;
    const payload = toExtraDbPayload({
      ...extra,
      id,
      enabled: extra.enabled ?? true,
      sortOrder: extra.sortOrder ?? 999
    });
    const { data, error } = await supabase.from('extras').insert([payload]).select().single();
    if (!error && data) {
      setExtras(prev => [...prev, {
        ...data,
        pricingMode: data.pricing_mode as 'flat' | 'per_person',
        sortOrder: data.sort_order
      }]);
    }
  }, [toExtraDbPayload]);
  const updateExtra = useCallback(async (id: string, patch: Partial<Extra>) => {
    const dbPatch = toExtraDbPayload(patch);
    await supabase.from('extras').update(dbPatch).eq('id', id);
    setExtras(prev => prev.map(e => e.id === id ? { ...e, ...patch } : e));
  }, [toExtraDbPayload]);
  const deleteExtra = useCallback(async (id: string) => {
    await supabase.from('extras').delete().eq('id', id);
    setExtras(prev => prev.filter(e => e.id !== id));
  }, []);

  const updateStaff = useCallback(async (id: string, patch: Partial<StaffMember>) => {
    await supabase.from('staff_members').update(patch).eq('id', id);
    setStaff(prev => prev.map(s => s.id === id ? { ...s, ...patch } : s));
  }, []);
  const addStaff = useCallback(async (member: Partial<StaffMember>) => {
    const { data, error } = await supabase.from('staff_members').insert([member]).select().single();
    if (!error) setStaff(prev => [...prev, data]);
  }, []);
  const deleteStaff = useCallback(async (id: string) => {
    await supabase.from('staff_members').delete().eq('id', id);
    setStaff(prev => prev.filter(s => s.id !== id));
  }, []);

  const value = useMemo(() => ({
    loading, loadError, bookings, rooms, services, staff, blocks, recurringBlocks, specialHours, settings, promoCodes, customers, waitlist, extras, operatingHours, calSync,
    getOperatingWindow, calculatePricing, getValidStartTimes, findFirstAvailableRoomAndStaff, addBooking, updateBooking, getBookingByMagicToken, canRescheduleOrCancel,
    getEnabledExtras, computeExtrasTotal, buildBookingExtrasSnapshot, addWaitlistEntry, getWaitlistForDate, setWaitlistStatus, deleteWaitlistEntry, buildWaitlistMessage, buildWhatsAppUrl, getBusyIntervals, getBookingsForDate, getBlocksForDate,
    addBlock, deleteBlock, toggleRecurringBlock, deleteRecurringBlock, updateSettings, addPromoCode, updatePromoCode, deletePromoCode, getCalendarSyncConfig, setCalendarSyncConfig, regenerateCalendarToken, validateInterval, addCustomer, updateCustomer, deleteCustomer,
    updateOperatingHours, addService, updateService, deleteService, addExtra, updateExtra, deleteExtra, updateStaff, addStaff, deleteStaff
  }), [loading, loadError, bookings, rooms, services, staff, blocks, recurringBlocks, specialHours, settings, promoCodes, customers, waitlist, extras, operatingHours, calSync, getOperatingWindow, calculatePricing, getValidStartTimes, findFirstAvailableRoomAndStaff, addBooking, updateBooking, getBookingByMagicToken, canRescheduleOrCancel, getEnabledExtras, computeExtrasTotal, buildBookingExtrasSnapshot, addWaitlistEntry, getWaitlistForDate, setWaitlistStatus, deleteWaitlistEntry, buildWaitlistMessage, buildWhatsAppUrl, getBusyIntervals, getBookingsForDate, getBlocksForDate, addBlock, deleteBlock, toggleRecurringBlock, deleteRecurringBlock, updateSettings, addPromoCode, updatePromoCode, deletePromoCode, getCalendarSyncConfig, setCalendarSyncConfig, regenerateCalendarToken, validateInterval, addCustomer, updateCustomer, deleteCustomer, updateOperatingHours, addService, updateService, deleteService, addExtra, updateExtra, deleteExtra, updateStaff, addStaff, deleteStaff]);

  return (
    <StoreContext.Provider value={value} >
      {children}
    </StoreContext.Provider>
  );
}

export function useStore() {
  const context = useContext(StoreContext);
  if (!context) throw new Error('useStore must be used within a StoreProvider');
  return context;
}
