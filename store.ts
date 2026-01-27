
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
  const [rooms] = useState<Room[]>(ROOMS);
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
    const load = () => {
      try {
        const b = localStorage.getItem(LS_BOOKINGS); if (b) setBookings(JSON.parse(b));
        const s = localStorage.getItem(LS_SERVICES); if (s) setServices(JSON.parse(s));
        const st = localStorage.getItem(LS_STAFF); if (st) setStaff(JSON.parse(st));
        const bl = localStorage.getItem(LS_BLOCKS); if (bl) setBlocks(JSON.parse(bl));
        const rb = localStorage.getItem(LS_RECURRING_BLOCKS); if (rb) setRecurringBlocks(JSON.parse(rb));
        const oh = localStorage.getItem(LS_OPERATING_HOURS); if (oh) setOperatingHours(JSON.parse(oh));
        const sh = localStorage.getItem(LS_SPECIAL_HOURS); if (sh) setSpecialHours(JSON.parse(sh));
        const se = localStorage.getItem(LS_SETTINGS); if (se) setSettings(JSON.parse(se));
        const pc = localStorage.getItem(LS_PROMO_CODES); if (pc) setPromoCodes(JSON.parse(pc));
        const cu = localStorage.getItem(LS_CUSTOMERS); if (cu) setCustomers(JSON.parse(cu));
        const wl = localStorage.getItem(LS_WAITLIST); if (wl) setWaitlist(JSON.parse(wl));
        const cs = localStorage.getItem(LS_CAL_SYNC); if (cs) setCalSync(JSON.parse(cs));
        const ex = localStorage.getItem(LS_EXTRAS); if (ex) setExtras(JSON.parse(ex));
      } catch (e) {
        console.error("Failed to load store data from localStorage", e);
      }
      setLoading(false);
    };
    load();
  }, []);

  useEffect(() => {
    if (!loading) {
      localStorage.setItem(LS_BOOKINGS, JSON.stringify(bookings));
      localStorage.setItem(LS_SERVICES, JSON.stringify(services));
      localStorage.setItem(LS_STAFF, JSON.stringify(staff));
      localStorage.setItem(LS_BLOCKS, JSON.stringify(blocks));
      localStorage.setItem(LS_RECURRING_BLOCKS, JSON.stringify(recurringBlocks));
      localStorage.setItem(LS_OPERATING_HOURS, JSON.stringify(operatingHours));
      localStorage.setItem(LS_SPECIAL_HOURS, JSON.stringify(specialHours));
      localStorage.setItem(LS_SETTINGS, JSON.stringify(settings));
      localStorage.setItem(LS_PROMO_CODES, JSON.stringify(promoCodes));
      localStorage.setItem(LS_CUSTOMERS, JSON.stringify(customers));
      localStorage.setItem(LS_WAITLIST, JSON.stringify(waitlist));
      localStorage.setItem(LS_CAL_SYNC, JSON.stringify(calSync));
      localStorage.setItem(LS_EXTRAS, JSON.stringify(extras));
    }
  }, [bookings, services, staff, blocks, recurringBlocks, operatingHours, specialHours, settings, promoCodes, customers, waitlist, calSync, extras, loading]);

  const getOperatingWindow = useCallback((date: string) => {
    const special = specialHours.find(s => s.date === date);
    if (special) return special.enabled ? { open: special.open!, close: special.close! } : null;
    
    const day = new Date(date).getDay();
    const config = operatingHours.find(h => h.day === day);
    if (config && config.enabled) return { open: config.open, close: config.close };
    return null;
  }, [specialHours, operatingHours]);

  const calculatePricing = useCallback((date: string, guests: number, extraHours: number, promoCode?: string) => {
    const tier = PRICING_TIERS.find(t => guests >= t.min && guests <= t.max);
    const basePrice = tier ? tier.price : 0;
    const extraPrice = SESSION_EXTRAS.find(e => e.hours === extraHours)?.price || 0;
    const baseTotal = basePrice;
    
    const day = new Date(date).getDay();
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

  const validateInterval = useCallback((roomId: string, start: string, end: string, excludeBookingId?: string, staffId?: string) => {
    const startTs = new Date(start).getTime();
    const endTs = new Date(end).getTime();
    const date = start.split('T')[0];
    const window = getOperatingWindow(date);
    if (!window) return { ok: false, reason: 'Venue is closed on this date' };

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
    if (!window) return [];

    const times: string[] = [];
    const openH = parseInt(window.open.split(':')[0]);
    const openM = parseInt(window.open.split(':')[1]);
    let closeH = parseInt(window.close.split(':')[0]);
    const closeM = parseInt(window.close.split(':')[1]);

    if (closeH <= openH) closeH += 24;

    const startMinutes = openH * 60 + openM;
    const endMinutes = closeH * 60 + closeM;

    const now = new Date();
    const minLeadTimeMs = (settings.minDaysBeforeBooking * 24 * 3600000) + (settings.minHoursBeforeBooking * 3600000);
    const earliestAllowedStart = new Date(now.getTime() + minLeadTimeMs);

    for (let m = startMinutes; m <= endMinutes - durationMinutes; m += SLOT_MINUTES) {
      const hStr = Math.floor((m % (24 * 60)) / 60).toString().padStart(2, '0');
      const minStr = (m % 60).toString().padStart(2, '0');
      const time = `${hStr}:${minStr}`;
      const startAt = new Date(`${date}T${time}`).toISOString();
      
      // Lead time check
      if (new Date(startAt) < earliestAllowedStart) continue;

      const endAt = new Date(new Date(startAt).getTime() + durationMinutes * 60000).toISOString();
      const anyRoom = rooms.some(r => validateInterval(r.id, startAt, endAt, undefined, staffId).ok);
      if (anyRoom) times.push(time);
    }
    return times;
  }, [rooms, getOperatingWindow, validateInterval, settings.minDaysBeforeBooking, settings.minHoursBeforeBooking]);

  const findFirstAvailableRoomAndStaff = useCallback((startAt: string, endAt: string, staffId?: string, serviceId?: string) => {
    if (staffId) {
      for (const r of rooms) {
        if (validateInterval(r.id, startAt, endAt, undefined, staffId).ok) {
          return { room_id: r.id, staff_id: staffId };
        }
      }
    }
    const eligibleStaff = staff.filter(s => s.enabled && (!serviceId || s.servicesOffered.includes(serviceId)));
    for (const r of rooms) {
      if (eligibleStaff.length > 0) {
        for (const s of eligibleStaff) {
          if (validateInterval(r.id, startAt, endAt, undefined, s.id).ok) {
            return { room_id: r.id, staff_id: s.id };
          }
        }
      } else if (validateInterval(r.id, startAt, endAt).ok) {
        return { room_id: r.id, staff_id: undefined };
      }
    }
    return null;
  }, [rooms, staff, validateInterval]);

  const addBooking = useCallback((booking: Partial<Booking>) => {
    const newBooking = { ...booking, id: Math.random().toString(36).substring(2, 9), magicToken: Math.random().toString(36).substring(2, 15) } as Booking;
    setBookings(prev => [...prev, newBooking]);
    return newBooking;
  }, []);

  const updateBooking = useCallback((id: string, patch: Partial<Booking>) => {
    setBookings(prev => prev.map(b => b.id === id ? { ...b, ...patch } : b));
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

  const addWaitlistEntry = useCallback((entry: Partial<WaitlistEntry>): { ok: boolean; reason?: string } => {
    const newEntry = { ...entry, id: Math.random().toString(36).substring(2, 9), status: 'active', created_at: new Date().toISOString() } as WaitlistEntry;
    setWaitlist(prev => [...prev, newEntry]);
    return { ok: true };
  }, []);

  const getWaitlistForDate = useCallback((date: string) => waitlist.filter(w => w.preferredDate === date), [waitlist]);
  const setWaitlistStatus = useCallback((id: string, status: WaitlistEntry['status']) => setWaitlist(prev => prev.map(w => w.id === id ? { ...w, status } : w)), []);
  const deleteWaitlistEntry = useCallback((id: string) => setWaitlist(prev => prev.filter(w => w.id !== id)), []);
  const buildWaitlistMessage = useCallback((data: any) => `Hi, I'd like to join the waitlist for ${data.preferredDate}${data.preferredTime ? ` at ${data.preferredTime}` : ''} for ${data.guests} guests. My name is ${data.name || 'a customer'}.`, []);
  const buildWhatsAppUrl = useCallback((message: string) => `${WHATSAPP_URL}?text=${encodeURIComponent(message)}`, []);

  const getBusyIntervals = useCallback((date: string, roomId: string) => {
    const dayBookings = bookings.filter(b => b.start_at.startsWith(date) && b.room_id === roomId && b.status !== BookingStatus.CANCELLED);
    const dayBlocks = blocks.filter(b => b.start_at.startsWith(date) && b.roomId === roomId);
    return [
      ...dayBookings.map(b => ({ id: b.id, type: 'booking' as const, start: new Date(b.start_at).getTime(), end: new Date(b.end_at).getTime(), customer_name: b.customer_name, status: b.status })),
      ...dayBlocks.map(b => ({ id: b.id, type: 'block' as const, start: new Date(b.start_at).getTime(), end: new Date(b.end_at).getTime(), reason: b.reason }))
    ];
  }, [bookings, blocks]);

  const getBookingsForDate = useCallback((date: string) => bookings.filter(b => b.start_at.startsWith(date)), [bookings]);
  const getBlocksForDate = useCallback((date: string) => blocks.filter(b => b.start_at.startsWith(date)), [blocks]);

  const addBlock = useCallback((block: Partial<RoomBlock>) => setBlocks(prev => [...prev, { ...block, id: Math.random().toString(36).substring(2, 9), createdAt: Date.now() } as RoomBlock]), []);
  const deleteBlock = useCallback((id: string) => setBlocks(prev => prev.filter(b => b.id !== id)), []);
  const toggleRecurringBlock = useCallback((id: string, enabled: boolean) => setRecurringBlocks(prev => prev.map(b => b.id === id ? { ...b, enabled } : b)), []);
  const deleteRecurringBlock = useCallback((id: string) => setRecurringBlocks(prev => prev.filter(b => b.id !== id)), []);

  const updateSettings = useCallback((patch: Partial<VenueSettings>) => setSettings(prev => ({ ...prev, ...patch })), []);

  const addPromoCode = useCallback((promo: Partial<PromoCode>) => setPromoCodes(prev => [...prev, { ...promo, id: Math.random().toString(36).substring(2, 9), uses: 0 } as PromoCode]), []);
  const updatePromoCode = useCallback((id: string, patch: Partial<PromoCode>) => setPromoCodes(prev => prev.map(p => p.id === id ? { ...p, ...patch } : p)), []);
  const deletePromoCode = useCallback((id: string) => setPromoCodes(prev => prev.filter(p => p.id !== id)), []);

  const getCalendarSyncConfig = useCallback(() => calSync, [calSync]);
  const setCalendarSyncConfig = useCallback((config: Partial<CalendarSyncConfig>) => setCalSync(prev => ({ ...prev, ...config })), []);
  const regenerateCalendarToken = useCallback(() => setCalSync(prev => ({ ...prev, token: Math.random().toString(36).substring(7), lastRegeneratedAt: new Date().toISOString() })), []);

  const addCustomer = useCallback((customer: Partial<Customer>) => {
    const newCustomer = { ...customer, id: Math.random().toString(36).substring(2, 9), createdAt: Date.now(), updatedAt: Date.now(), totalBookings: customer.totalBookings || 0, totalSpend: customer.totalSpend || 0 } as Customer;
    setCustomers(prev => [...prev, newCustomer]);
    return newCustomer;
  }, []);
  const updateCustomer = useCallback((id: string, patch: Partial<Customer>) => setCustomers(prev => prev.map(c => c.id === id ? { ...c, ...patch, updatedAt: Date.now() } : c)), []);
  const deleteCustomer = useCallback((id: string) => setCustomers(prev => prev.filter(c => c.id !== id)), []);

  const updateOperatingHours = useCallback((day: number, patch: Partial<DayOperatingHours>) => {
    setOperatingHours(prev => prev.map(oh => oh.day === day ? { ...oh, ...patch } : oh));
  }, []);

  const addService = useCallback((service: Partial<Service>) => {
    setServices(prev => [...prev, { ...service, id: Math.random().toString(36).substring(2, 9), enabled: true } as Service]);
  }, []);
  const updateService = useCallback((id: string, patch: Partial<Service>) => {
    setServices(prev => prev.map(s => s.id === id ? { ...s, ...patch } : s));
  }, []);
  const deleteService = useCallback((id: string) => {
    setServices(prev => prev.filter(s => s.id !== id));
  }, []);

  const addExtra = useCallback((extra: Partial<Extra>) => {
    setExtras(prev => [...prev, { ...extra, id: Math.random().toString(36).substring(2, 9), enabled: true, sortOrder: prev.length + 1 } as Extra]);
  }, []);
  const updateExtra = useCallback((id: string, patch: Partial<Extra>) => {
    setExtras(prev => prev.map(e => e.id === id ? { ...e, ...patch } : e));
  }, []);
  const deleteExtra = useCallback((id: string) => {
    setExtras(prev => prev.filter(e => e.id !== id));
  }, []);

  const updateStaff = useCallback((id: string, patch: Partial<StaffMember>) => {
    setStaff(prev => prev.map(s => s.id === id ? { ...s, ...patch } : s));
  }, []);
  const addStaff = useCallback((member: Partial<StaffMember>) => {
    setStaff(prev => [...prev, { ...member, id: Math.random().toString(36).substring(2, 9), enabled: true } as StaffMember]);
  }, []);
  const deleteStaff = useCallback((id: string) => {
    setStaff(prev => prev.filter(s => s.id !== id));
  }, []);

  return {
    loading, bookings, rooms, services, staff, blocks, recurringBlocks, specialHours, settings, promoCodes, customers, waitlist, extras, operatingHours,
    getOperatingWindow, calculatePricing, getValidStartTimes, findFirstAvailableRoomAndStaff, addBooking, updateBooking, getBookingByMagicToken, canRescheduleOrCancel,
    getEnabledExtras, computeExtrasTotal, buildBookingExtrasSnapshot, addWaitlistEntry, getWaitlistForDate, setWaitlistStatus, deleteWaitlistEntry, buildWaitlistMessage, buildWhatsAppUrl, getBusyIntervals, getBookingsForDate, getBlocksForDate,
    addBlock, deleteBlock, toggleRecurringBlock, deleteRecurringBlock, updateSettings, addPromoCode, updatePromoCode, deletePromoCode, getCalendarSyncConfig, setCalendarSyncConfig, regenerateCalendarToken, validateInterval, addCustomer, updateCustomer, deleteCustomer,
    updateOperatingHours, addService, updateService, deleteService, addExtra, updateExtra, deleteExtra, updateStaff, addStaff, deleteStaff
  };
}
