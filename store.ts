"use client";

import { useState, useEffect, useMemo, useCallback } from 'react';
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
  LS_BOOKINGS,
  LS_OPERATING_HOURS,
  LS_SPECIAL_HOURS,
  LS_BLOCKS,
  LS_RECURRING_BLOCKS,
  LS_PROMO_CODES,
  LS_SERVICES,
  LS_STAFF,
  LS_SETTINGS,
  LS_CUSTOMERS,
  LS_WAITLIST,
  LS_CAL_SYNC,
  LS_EXTRAS,
  WHATSAPP_URL
} from './constants';
import { supabase } from './lib/supabase';

const DEFAULT_SETTINGS: VenueSettings = {
  cancelCutoffHours: 24,
  rescheduleCutoffHours: 48,
  releasePendingOnPaymentFailure: true,
  deposit_enabled: true,
  deposit_amount: 50,
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

export function useStore() {
  const [loading, setLoading] = useState(true);
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

  // Load from Supabase on mount
  useEffect(() => {
    const fetchData = async () => {
      try {
        const [
          { data: bookingsData },
          { data: roomsData },
          { data: servicesData },
          { data: staffData },
          { data: blocksData },
          { data: recurringBlocksData },
          { data: specialHoursData },
          { data: operatingHoursData },
          { data: settingsData },
          { data: promoCodesData },
          { data: customersData },
          { data: waitlistData },
          { data: extrasData }
        ] = await Promise.all([
          supabase.from('bookings').select('*'),
          supabase.from('rooms').select('*'),
          supabase.from('services').select('*'),
          supabase.from('staff_members').select('*'),
          supabase.from('room_blocks').select('*'),
          supabase.from('recurring_blocks').select('*'),
          supabase.from('special_hours').select('*'),
          supabase.from('operating_hours').select('*').order('day', { ascending: true }),
          supabase.from('venue_settings').select('*').single(),
          supabase.from('promo_codes').select('*'),
          supabase.from('customers').select('*'),
          supabase.from('waitlist').select('*'),
          supabase.from('extras').select('*').order('sort_order', { ascending: true })
        ]);

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
          customer_name: b.customer_name,
          customer_email: b.customer_email,
          customer_phone: b.customer_phone,
          notes: b.notes,
          base_total: b.base_total,
          extras_hours: b.extras_hours,
          extras_price: b.extras_price,
          discount_amount: b.discount_amount,
          promo_code: b.promo_code,
          promo_discount_amount: b.promo_discount_amount,
          total_price: b.total_price,
          created_at: b.created_at,
          magicToken: b.magic_token,
          deposit_amount: b.deposit_amount,
          deposit_paid: b.deposit_paid,
          deposit_forfeited: b.deposit_forfeited,
          extras: b.extras_snapshot,
          extras_total: b.extras_total
        })));
        if (roomsData) setRooms(roomsData as Room[]);
        if (servicesData) setServices(servicesData as Service[]);
        if (staffData) setStaff(staffData.map(s => ({
          ...s,
          servicesOffered: s.services_offered,
          bufferBefore: s.buffer_before,
          bufferAfter: s.buffer_after
        })));
        if (blocksData) setBlocks(blocksData.map(b => ({
          ...b,
          roomId: b.room_id,
          createdAt: new Date(b.created_at).getTime()
        })));
        if (recurringBlocksData) setRecurringBlocks(recurringBlocksData.map(rb => ({
          ...rb,
          dayOfWeek: rb.day_of_week,
          roomId: rb.room_id,
          startTime: rb.start_time,
          endTime: rb.end_time
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
        if (extrasData) setExtras(extrasData.map(e => ({
          ...e,
          pricingMode: e.pricing_mode as 'flat' | 'per_person',
          sortOrder: e.sort_order
        })));

      } catch (err) {
        console.error("Error fetching data from Supabase:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  const getLocalDateString = (isoOrTs: string | number) => {
    const d = new Date(isoOrTs);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  };

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
      const localDate = getLocalDateString(startTs);
      const window = getOperatingWindow(localDate);
      if (!window) return { ok: false, reason: 'Venue is closed on this date' };

      const openParts = window.open.split(':');
      const closeParts = window.close.split(':');
      const startOfDayTs = new Date(localDate + 'T00:00:00').getTime();
      const openTs = startOfDayTs + (parseInt(openParts[0]) * 3600000) + (parseInt(openParts[1]) * 60000);
      let closeTs = startOfDayTs + (parseInt(closeParts[0]) * 3600000) + (parseInt(closeParts[1]) * 60000);

      if (closeTs <= openTs) closeTs += 24 * 3600000;

      if (startTs < openTs || endTs > closeTs) {
        return { ok: false, reason: 'Requested time is outside operating hours' };
      }
    }

    const conflicts = bookings.filter(b => {
      if (b.id === excludeBookingId) return false;
      if (b.status === BookingStatus.CANCELLED) return false;
      if (b.room_id !== roomId) return false;
      const bStart = new Date(b.start_at).getTime();
      const bEnd = new Date(b.end_at).getTime();
      return (startTs < bEnd && endTs > bStart);
    });
    if (conflicts.length > 0) return { ok: false, reason: 'Room is already booked for this time' };

    const blockConflicts = blocks.filter(b => {
      if (b.roomId !== roomId) return false;
      const bStart = new Date(b.start_at).getTime();
      const bEnd = new Date(b.end_at).getTime();
      return (startTs < bEnd && endTs > bStart);
    });
    if (blockConflicts.length > 0) return { ok: false, reason: 'Room is blocked for maintenance' };

    if (staffId) {
      const staffConflicts = bookings.filter(b => {
        if (b.id === excludeBookingId) return false;
        if (b.status === BookingStatus.CANCELLED) return false;
        if (b.staff_id !== staffId) return false;
        const bStart = new Date(b.start_at).getTime();
        const bEnd = new Date(b.end_at).getTime();
        return (startTs < bEnd && endTs > bStart);
      });
      if (staffConflicts.length > 0) return { ok: false, reason: 'Staff member is unavailable' };
    }

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

    const startMinutes = openH * 60 + openM;
    const endMinutes = closeH * 60 + closeM;

    const nowLocal = new Date();
    const minLeadTimeMs = ((settings.minDaysBeforeBooking || 0) * 24 * 3600000) + ((settings.minHoursBeforeBooking || 0) * 3600000);
    const earliestAllowedStart = new Date(nowLocal.getTime() + minLeadTimeMs);

    const [y, mm, dd] = date.split('-').map(Number);
    const baseDate = new Date(y, mm - 1, dd, 0, 0, 0);

    for (let m = startMinutes; m <= endMinutes - durationMinutes; m += SLOT_MINUTES) {
      const slotStart = new Date(baseDate.getTime() + m * 60000);
      if (slotStart < earliestAllowedStart) continue;

      const startAt = slotStart.toISOString();
      const endAt = new Date(slotStart.getTime() + durationMinutes * 60000).toISOString();

      const anyRoom = rooms.some(r => validateInterval(r.id, startAt, endAt, undefined, staffId, true).ok);
      if (anyRoom) {
        const hStr = slotStart.getHours().toString().padStart(2, '0');
        const minStr = slotStart.getMinutes().toString().padStart(2, '0');
        times.push(`${hStr}:${minStr}`);
      }
    }
    return times;
  }, [rooms, getOperatingWindow, validateInterval, settings.minDaysBeforeBooking, settings.minHoursBeforeBooking]);

  const findFirstAvailableRoomAndStaff = useCallback((startAt: string, endAt: string, staffId?: string, serviceId?: string) => {
    if (staffId) {
      for (const r of rooms) {
        if (validateInterval(r.id, startAt, endAt, undefined, staffId, true).ok) {
          return { room_id: r.id, staff_id: staffId };
        }
      }
    }
    const eligibleStaff = staff.filter(s => s.enabled && (!serviceId || s.servicesOffered.includes(serviceId)));
    for (const r of rooms) {
      if (eligibleStaff.length > 0) {
        for (const s of eligibleStaff) {
          if (validateInterval(r.id, startAt, endAt, undefined, s.id, true).ok) {
            return { room_id: r.id, staff_id: s.id };
          }
        }
      } else if (validateInterval(r.id, startAt, endAt, undefined, undefined, true).ok) {
        return { room_id: r.id, staff_id: undefined };
      }
    }
    return null;
  }, [rooms, staff, validateInterval]);

  const addBooking = useCallback(async (booking: Partial<Booking>) => {
    const magicToken = Math.random().toString(36).substring(2, 15);
    const { data, error } = await supabase.from('bookings').insert([{
      room_id: booking.room_id,
      room_name: booking.room_name,
      service_id: booking.service_id,
      staff_id: booking.staff_id,
      start_at: booking.start_at,
      end_at: booking.end_at,
      status: booking.status,
      guests: booking.guests,
      customer_name: booking.customer_name,
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
      console.error("Error adding booking:", error);
      return null;
    }

    const newBooking = { ...data, magicToken: data.magic_token } as Booking;
    setBookings(prev => [...prev, newBooking]);
    return newBooking;
  }, []);

  const updateBooking = useCallback(async (id: string, patch: Partial<Booking>) => {
    const { error } = await supabase.from('bookings').update({
      status: patch.status,
      notes: patch.notes,
      deposit_paid: patch.deposit_paid,
      deposit_forfeited: patch.deposit_forfeited
    }).eq('id', id);

    if (error) console.error("Error updating booking:", error);
    else setBookings(prev => prev.map(b => b.id === id ? { ...b, ...patch } : b));
  }, []);

  const getBookingByMagicToken = useCallback((token: string) => {
    return bookings.find(b => b.magicToken === token);
  }, [bookings]);

  const canRescheduleOrCancel = useCallback((booking: Booking, type: 'reschedule' | 'cancel') => {
    const cutoffHours = type === 'reschedule' ? settings.rescheduleCutoffHours : settings.cancelCutoffHours;
    const start = new Date(booking.start_at).getTime();
    const now = Date.now();
    return (start - now) > (cutoffHours * 3600000);
  }, [settings]);

  const getEnabledExtras = useCallback(() => extras.filter(e => e.enabled), [extras]);

  const computeExtrasTotal = useCallback((selection: Record<string, number>, guests: number) => {
    return Object.entries(selection).reduce((acc, [id, qty]) => {
      const extra = extras.find(e => e.id === id);
      if (!extra) return acc;
      const unitPrice = extra.pricingMode === 'per_person' ? extra.price * guests : extra.price;
      return acc + (unitPrice * qty);
    }, 0);
  }, [extras]);

  const buildBookingExtrasSnapshot = useCallback((selection: Record<string, number>, guests: number) => {
    return Object.entries(selection).map(([id, qty]) => {
      const extra = extras.find(e => e.id === id)!;
      const priceSnapshot = extra.price;
      const unitTotal = extra.pricingMode === 'per_person' ? priceSnapshot * guests : priceSnapshot;
      return { extraId: id, nameSnapshot: extra.name, priceSnapshot, pricingModeSnapshot: extra.pricingMode, quantity: qty, lineTotal: unitTotal * qty };
    });
  }, [extras]);

  const addWaitlistEntry = useCallback(async (entry: Partial<WaitlistEntry>) => {
    const { data, error } = await supabase.from('waitlist').insert([{
      name: entry.name,
      phone: entry.phone,
      preferred_date: entry.preferredDate,
      preferred_time: entry.preferredTime,
      guests: entry.guests,
      status: 'active'
    }]).select().single();

    if (error) {
      console.error("Error adding waitlist entry:", error);
      return { ok: false, reason: error.message };
    }

    const newEntry = { ...data, preferredDate: data.preferred_date, preferredTime: data.preferred_time } as WaitlistEntry;
    setWaitlist(prev => [...prev, newEntry]);
    return { ok: true };
  }, []);

  const getWaitlistForDate = useCallback((date: string) => waitlist.filter(w => w.preferredDate === date), [waitlist]);

  const setWaitlistStatus = useCallback(async (id: string, status: WaitlistEntry['status']) => {
    const { error } = await supabase.from('waitlist').update({ status }).eq('id', id);
    if (error) console.error("Error updating waitlist status:", error);
    else setWaitlist(prev => prev.map(w => w.id === id ? { ...w, status } : w));
  }, []);

  const deleteWaitlistEntry = useCallback(async (id: string) => {
    const { error } = await supabase.from('waitlist').delete().eq('id', id);
    if (error) console.error("Error deleting waitlist entry:", error);
    else setWaitlist(prev => prev.filter(w => w.id !== id));
  }, []);

  const buildWaitlistMessage = useCallback((data: any) => `Hi, I'd like to join the waitlist for ${data.preferredDate}${data.preferredTime ? ` at ${data.preferredTime}` : ''} for ${data.guests} guests. My name is ${data.name || 'a customer'}.`, []);
  const buildWhatsAppUrl = useCallback((message: string) => `${WHATSAPP_URL}?text=${encodeURIComponent(message)}`, []);

  const getBusyIntervals = useCallback((date: string, roomId: string) => {
    const dayBookings = bookings.filter(b => {
      if (b.room_id !== roomId || b.status === BookingStatus.CANCELLED) return false;
      return getLocalDateString(b.start_at) === date;
    });
    const dayBlocks = blocks.filter(b => {
      if (b.roomId !== roomId) return false;
      return getLocalDateString(b.start_at) === date;
    });
    return [
      ...dayBookings.map(b => ({ id: b.id, type: 'booking' as const, start: new Date(b.start_at).getTime(), end: new Date(b.end_at).getTime(), customer_name: b.customer_name, status: b.status })),
      ...dayBlocks.map(b => ({ id: b.id, type: 'block' as const, start: new Date(b.start_at).getTime(), end: new Date(b.end_at).getTime(), reason: b.reason }))
    ];
  }, [bookings, blocks]);

  const getBookingsForDate = useCallback((date: string) => bookings.filter(b => getLocalDateString(b.start_at) === date), [bookings]);
  const getBlocksForDate = useCallback((date: string) => blocks.filter(b => getLocalDateString(b.start_at) === date), [blocks]);

  const addBlock = useCallback(async (block: Partial<RoomBlock>) => {
    const { data, error } = await supabase.from('room_blocks').insert([{
      room_id: block.roomId,
      start_at: block.start_at,
      end_at: block.end_at,
      reason: block.reason
    }]).select().single();

    if (error) console.error("Error adding block:", error);
    else setBlocks(prev => [...prev, { ...data, roomId: data.room_id, createdAt: new Date(data.created_at).getTime() } as RoomBlock]);
  }, []);

  const deleteBlock = useCallback(async (id: string) => {
    const { error } = await supabase.from('room_blocks').delete().eq('id', id);
    if (error) console.error("Error deleting block:", error);
    else setBlocks(prev => prev.filter(b => b.id !== id));
  }, []);

  const toggleRecurringBlock = useCallback(async (id: string, enabled: boolean) => {
    const { error } = await supabase.from('recurring_blocks').update({ enabled }).eq('id', id);
    if (error) console.error("Error toggling recurring block:", error);
    else setRecurringBlocks(prev => prev.map(b => b.id === id ? { ...b, enabled } : b));
  }, []);

  const deleteRecurringBlock = useCallback(async (id: string) => {
    const { error } = await supabase.from('recurring_blocks').delete().eq('id', id);
    if (error) console.error("Error deleting recurring block:", error);
    else setRecurringBlocks(prev => prev.filter(b => b.id !== id));
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

    if (error) console.error("Error updating settings:", error);
    else setSettings(prev => ({ ...prev, ...patch }));
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

    if (error) console.error("Error adding promo code:", error);
    else setPromoCodes(prev => [...prev, { ...data, percentOff: data.percent_off, fixedOff: data.fixed_off, startDate: data.start_date, endDate: data.end_date, minGuests: data.min_guests, maxUses: data.max_uses } as PromoCode]);
  }, []);

  const updatePromoCode = useCallback(async (id: string, patch: Partial<PromoCode>) => {
    const { error } = await supabase.from('promo_codes').update({
      enabled: patch.enabled,
      percent_off: patch.percentOff,
      fixed_off: patch.fixedOff,
      start_date: patch.startDate,
      end_date: patch.endDate,
      min_guests: patch.minGuests,
      max_uses: patch.maxUses
    }).eq('id', id);

    if (error) console.error("Error updating promo code:", error);
    else setPromoCodes(prev => prev.map(p => p.id === id ? { ...p, ...patch } : p));
  }, []);

  const deletePromoCode = useCallback(async (id: string) => {
    const { error } = await supabase.from('promo_codes').delete().eq('id', id);
    if (error) console.error("Error deleting promo code:", error);
    else setPromoCodes(prev => prev.filter(p => p.id !== id));
  }, []);

  const getCalendarSyncConfig = useCallback(() => calSync, [calSync]);
  const setCalendarSyncConfig = useCallback((config: Partial<CalendarSyncConfig>) => setCalSync(prev => ({ ...prev, ...config })), []);
  const regenerateCalendarToken = useCallback(() => setCalSync(prev => ({ ...prev, token: Math.random().toString(36).substring(7), lastRegeneratedAt: new Date().toISOString() })), []);

  const addCustomer = useCallback(async (customer: Partial<Customer>) => {
    const { data, error } = await supabase.from('customers').insert([{
      name: customer.name,
      email: customer.email,
      phone: customer.phone,
      notes: customer.notes,
      total_bookings: 0,
      total_spend: 0
    }]).select().single();

    if (error) {
      console.error("Error adding customer:", error);
      return null;
    }

    const newCustomer = {
      ...data,
      totalBookings: data.total_bookings,
      totalSpend: data.total_spend,
      createdAt: new Date(data.created_at).getTime(),
      updatedAt: new Date(data.updated_at).getTime()
    } as Customer;
    setCustomers(prev => [...prev, newCustomer]);
    return newCustomer;
  }, []);

  const updateCustomer = useCallback(async (id: string, patch: Partial<Customer>) => {
    const { error } = await supabase.from('customers').update({
      name: patch.name,
      email: patch.email,
      phone: patch.phone,
      notes: patch.notes,
      updated_at: new Date().toISOString()
    }).eq('id', id);

    if (error) console.error("Error updating customer:", error);
    else setCustomers(prev => prev.map(c => c.id === id ? { ...c, ...patch, updatedAt: Date.now() } : c));
  }, []);

  const deleteCustomer = useCallback(async (id: string) => {
    const { error } = await supabase.from('customers').delete().eq('id', id);
    if (error) console.error("Error deleting customer:", error);
    else setCustomers(prev => prev.filter(c => c.id !== id));
  }, []);

  const updateOperatingHours = useCallback(async (day: number, patch: Partial<DayOperatingHours>) => {
    const { error } = await supabase.from('operating_hours').update({
      open_time: patch.open,
      close_time: patch.close,
      enabled: patch.enabled
    }).eq('day', day);

    if (error) console.error("Error updating operating hours:", error);
    else setOperatingHours(prev => prev.map(oh => oh.day === day ? { ...oh, ...patch } : oh));
  }, []);

  const addService = useCallback(async (service: Partial<Service>) => {
    const { data, error } = await supabase.from('services').insert([{
      name: service.name,
      duration_minutes: service.durationMinutes,
      base_price: service.basePrice,
      description: service.description,
      enabled: true
    }]).select().single();

    if (error) console.error("Error adding service:", error);
    else setServices(prev => [...prev, { ...data, durationMinutes: data.duration_minutes, basePrice: data.base_price } as Service]);
  }, []);

  const updateService = useCallback(async (id: string, patch: Partial<Service>) => {
    const { error } = await supabase.from('services').update({
      name: patch.name,
      duration_minutes: patch.durationMinutes,
      base_price: patch.basePrice,
      description: patch.description,
      enabled: patch.enabled
    }).eq('id', id);

    if (error) console.error("Error updating service:", error);
    else setServices(prev => prev.map(s => s.id === id ? { ...s, ...patch } : s));
  }, []);

  const deleteService = useCallback(async (id: string) => {
    const { error } = await supabase.from('services').delete().eq('id', id);
    if (error) console.error("Error deleting service:", error);
    else setServices(prev => prev.filter(s => s.id !== id));
  }, []);

  const addExtra = useCallback(async (extra: Partial<Extra>) => {
    const { data, error } = await supabase.from('extras').insert([{
      name: extra.name,
      price: extra.price,
      pricing_mode: extra.pricingMode,
      enabled: true,
      sort_order: extras.length + 1
    }]).select().single();

    if (error) console.error("Error adding extra:", error);
    else setExtras(prev => [...prev, { ...data, pricingMode: data.pricing_mode, sortOrder: data.sort_order } as Extra]);
  }, []);

  const updateExtra = useCallback(async (id: string, patch: Partial<Extra>) => {
    const { error } = await supabase.from('extras').update({
      name: patch.name,
      price: patch.price,
      pricing_mode: patch.pricingMode,
      enabled: patch.enabled,
      sort_order: patch.sortOrder
    }).eq('id', id);

    if (error) console.error("Error updating extra:", error);
    else setExtras(prev => prev.map(e => e.id === id ? { ...e, ...patch } : e));
  }, []);

  const deleteExtra = useCallback(async (id: string) => {
    const { error } = await supabase.from('extras').delete().eq('id', id);
    if (error) console.error("Error deleting extra:", error);
    else setExtras(prev => prev.filter(e => e.id !== id));
  }, []);

  const updateStaff = useCallback(async (id: string, patch: Partial<StaffMember>) => {
    const { error } = await supabase.from('staff_members').update({
      name: patch.name,
      enabled: patch.enabled,
      services_offered: patch.servicesOffered,
      buffer_before: patch.bufferBefore,
      buffer_after: patch.bufferAfter
    }).eq('id', id);

    if (error) console.error("Error updating staff:", error);
    else setStaff(prev => prev.map(s => s.id === id ? { ...s, ...patch } : s));
  }, []);

  const addStaff = useCallback(async (member: Partial<StaffMember>) => {
    const { data, error } = await supabase.from('staff_members').insert([{
      name: member.name,
      enabled: true,
      services_offered: member.servicesOffered || [],
      buffer_before: member.bufferBefore || 0,
      buffer_after: member.bufferAfter || 0
    }]).select().single();

    if (error) console.error("Error adding staff:", error);
    else setStaff(prev => [...prev, { ...data, servicesOffered: data.services_offered, bufferBefore: data.buffer_before, bufferAfter: data.buffer_after } as StaffMember]);
  }, []);

  const deleteStaff = useCallback(async (id: string) => {
    const { error } = await supabase.from('staff_members').delete().eq('id', id);
    if (error) console.error("Error deleting staff:", error);
    else setStaff(prev => prev.filter(s => s.id !== id));
  }, []);

  return {
    loading, bookings, rooms, services, staff, blocks, recurringBlocks, specialHours, settings, promoCodes, customers, waitlist, extras, operatingHours,
    getOperatingWindow, calculatePricing, getValidStartTimes, findFirstAvailableRoomAndStaff, addBooking, updateBooking, getBookingByMagicToken, canRescheduleOrCancel,
    getEnabledExtras, computeExtrasTotal, buildBookingExtrasSnapshot, addWaitlistEntry, getWaitlistForDate, setWaitlistStatus, deleteWaitlistEntry, buildWaitlistMessage, buildWhatsAppUrl, getBusyIntervals, getBookingsForDate, getBlocksForDate,
    addBlock, deleteBlock, toggleRecurringBlock, deleteRecurringBlock, updateSettings, addPromoCode, updatePromoCode, deletePromoCode, getCalendarSyncConfig, setCalendarSyncConfig, regenerateCalendarToken, validateInterval, addCustomer, updateCustomer, deleteCustomer,
    updateOperatingHours, addService, updateService, deleteService, addExtra, updateExtra, deleteExtra, updateStaff, addStaff, deleteStaff
  };
}