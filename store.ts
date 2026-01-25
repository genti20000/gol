
"use client";

import { useState, useEffect, useMemo, useCallback } from 'react';
/* Rest of the file remains identical */
import { 
  Booking, 
  BookingStatus, 
  Room, 
  DayOperatingHours, 
  RoomBlock, 
  Customer,
  RecurringBlock,
  SpecialHours,
  PromoCode,
  AdminUser, 
  Service,
  StaffMember,
  MagicLink,
  VenueSettings,
  WaitlistEntry,
  CalendarSyncConfig,
  Extra,
  BookingExtraSelection
} from './types';
import { 
  ROOMS, 
  DEFAULT_OPERATING_HOURS, 
  PRICING_TIERS, 
  EXTRAS, 
  MIDWEEK_DISCOUNT_PERCENT,
  SLOT_MINUTES,
  BUFFER_MINUTES,
  LS_BOOKINGS,
  LS_OPERATING_HOURS,
  LS_SPECIAL_HOURS,
  LS_BLOCKS,
  LS_RECURRING_BLOCKS,
  LS_PROMO_CODES,
  LS_ADMIN_USERS,
  LS_SERVICES,
  LS_STAFF,
  LS_SETTINGS,
  LS_CUSTOMERS,
  LS_WAITLIST,
  WHATSAPP_URL,
  LS_CAL_SYNC,
  LS_EXTRAS
} from './constants';

export function ceilToNextSlot(ts: number, slotMinutes = SLOT_MINUTES) {
  const ms = slotMinutes * 60 * 1000;
  return Math.ceil(ts / ms) * ms;
}

const DEFAULT_SETTINGS: VenueSettings = {
  cancelCutoffHours: 24,
  rescheduleCutoffHours: 24,
  releasePendingOnPaymentFailure: true,
  deposit_enabled: false,
  deposit_amount: 50
};

const DEFAULT_SERVICES: Service[] = [
  { id: 'service-karaoke', name: 'Karaoke Session', durationMinutes: 120, basePrice: 0, description: '2 Hour private karaoke room experience.', enabled: true }
];

const DEFAULT_EXTRAS: Extra[] = [
  { id: 'ex-soft-drinks', name: 'Soft Drinks Package', description: 'Unlimited soft drinks for the group.', price: 30, pricingMode: 'flat', enabled: true, sortOrder: 0 },
  { id: 'ex-bottle-service', name: 'Bottle Service', description: 'Premium bottle service delivered to your suite.', price: 120, pricingMode: 'flat', enabled: true, sortOrder: 1 },
  { id: 'ex-snacks', name: 'Snacks Platter', description: 'A selection of party snacks.', price: 25, pricingMode: 'flat', enabled: true, sortOrder: 2 },
  { id: 'ex-extra-guest', name: 'Extra Guest Add-On', description: 'Add one additional guest beyond capacity.', price: 5, pricingMode: 'per_person', enabled: false, sortOrder: 3 }
];

const generateToken = () => {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID().replace(/-/g, '');
  }
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
};

const DEFAULT_CAL_SYNC: CalendarSyncConfig = {
  enabled: false,
  token: generateToken(),
  includeCustomerName: false,
  includeBlocks: true,
  includePending: false,
  lastRegeneratedAt: new Date().toISOString()
};

export const useStore = () => {
  const [rooms] = useState<Room[]>(ROOMS);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [blocks, setBlocks] = useState<RoomBlock[]>([]);
  const [recurringBlocks, setRecurringBlocks] = useState<RecurringBlock[]>([]);
  const [operatingHours, setOperatingHours] = useState<DayOperatingHours[]>(DEFAULT_OPERATING_HOURS);
  const [specialHours, setSpecialHours] = useState<SpecialHours[]>([]);
  const [promoCodes, setPromoCodes] = useState<PromoCode[]>([]);
  const [adminUsers, setAdminUsers] = useState<AdminUser[]>([]);
  const [services, setServices] = useState<Service[]>(DEFAULT_SERVICES);
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [settings, setSettings] = useState<VenueSettings>(DEFAULT_SETTINGS);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [waitlist, setWaitlist] = useState<WaitlistEntry[]>([]);
  const [calendarSyncConfig, setCalendarSyncConfigState] = useState<CalendarSyncConfig>(DEFAULT_CAL_SYNC);
  const [extrasCatalog, setExtrasCatalog] = useState<Extra[]>(DEFAULT_EXTRAS);
  const [loading, setLoading] = useState(true);

  const persist = (key: string, data: any) => localStorage.setItem(key, JSON.stringify(data));

  useEffect(() => {
    const load = () => {
      try {
        const b = localStorage.getItem(LS_BOOKINGS);
        const bl = localStorage.getItem(LS_BLOCKS);
        const rbl = localStorage.getItem(LS_RECURRING_BLOCKS);
        const oh = localStorage.getItem(LS_OPERATING_HOURS);
        const sh = localStorage.getItem(LS_SPECIAL_HOURS);
        const pc = localStorage.getItem(LS_PROMO_CODES);
        const au = localStorage.getItem(LS_ADMIN_USERS);
        const svc = localStorage.getItem(LS_SERVICES);
        const stf = localStorage.getItem(LS_STAFF);
        const set = localStorage.getItem(LS_SETTINGS);
        const c = localStorage.getItem(LS_CUSTOMERS);
        const wl = localStorage.getItem(LS_WAITLIST);
        const cs = localStorage.getItem(LS_CAL_SYNC);
        const ex = localStorage.getItem(LS_EXTRAS);

        if (b) setBookings(JSON.parse(b));
        if (bl) setBlocks(JSON.parse(bl));
        if (rbl) setRecurringBlocks(JSON.parse(rbl));
        if (oh) setOperatingHours(JSON.parse(oh));
        if (sh) setSpecialHours(JSON.parse(sh));
        if (pc) setPromoCodes(JSON.parse(pc));
        if (au) setAdminUsers(JSON.parse(au));
        if (svc) setServices(JSON.parse(svc));
        if (stf) setStaff(JSON.parse(stf));
        if (set) setSettings(JSON.parse(set));
        if (c) setCustomers(JSON.parse(c));
        if (wl) setWaitlist(JSON.parse(wl));
        if (cs) setCalendarSyncConfigState(JSON.parse(cs));
        if (ex) setExtrasCatalog(JSON.parse(ex));
      } catch (e) {
        console.error("Failed to load local data", e);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const buildWaitlistMessage = (entry: Partial<WaitlistEntry>) => {
    const msg = `Hi, I'd like to join the waitlist for ${entry.preferredDate}. Group size: ${entry.guests}. Preferred time: ${entry.preferredTime || 'Any'}.`;
    return msg;
  };

  const buildWhatsAppUrl = (message: string) => {
    const separator = WHATSAPP_URL.includes('?') ? '&' : '?';
    return `${WHATSAPP_URL}${separator}text=${encodeURIComponent(message)}`;
  };

  const addWaitlistEntry = (payload: Omit<WaitlistEntry, "id" | "created_at" | "status">): { ok: boolean; reason?: string; entry?: WaitlistEntry } => {
    if (!payload.name) return { ok: false, reason: "Name is required" };
    if (!payload.phone) return { ok: false, reason: "Phone is required" };
    if (!payload.preferredDate) return { ok: false, reason: "Date is required" };
    if (payload.guests < 8 || payload.guests > 100) return { ok: false, reason: "Group size must be between 8 and 100" };

    const entry: WaitlistEntry = {
      ...payload,
      id: Math.random().toString(36).substr(2, 9),
      created_at: new Date().toISOString(),
      status: "active"
    };

    const next = [...waitlist, entry];
    setWaitlist(next);
    persist(LS_WAITLIST, next);
    return { ok: true, entry };
  };

  const setWaitlistStatus = (id: string, status: "active" | "contacted" | "closed") => {
    const next = waitlist.map(w => w.id === id ? { ...w, status } : w);
    setWaitlist(next);
    persist(LS_WAITLIST, next);
  };

  const getWaitlistForDate = (dateYYYYMMDD: string) => {
    return waitlist.filter(w => w.preferredDate === dateYYYYMMDD);
  };

  const deleteWaitlistEntry = (id: string) => {
    const next = waitlist.filter(w => w.id !== id);
    setWaitlist(next);
    persist(LS_WAITLIST, next);
  };

  const getBookingsForDate = (date: string) => bookings.filter(b => b.start_at.startsWith(date));
  const getBlocksForDate = (date: string) => blocks.filter(b => b.start_at.startsWith(date));

  const recomputeCustomerMetrics = useCallback((allBookings: Booking[], currentCustomers: Customer[]) => {
    const metricsMap = new Map<string, { totalBookings: number, totalSpend: number, lastBookingAt?: number }>();
    
    allBookings.forEach(book => {
      const email = book.customer_email.toLowerCase();
      const isConfirmed = book.status === BookingStatus.CONFIRMED;
      const current = metricsMap.get(email) || { totalBookings: 0, totalSpend: 0 };
      
      if (isConfirmed) {
        current.totalBookings += 1;
        current.totalSpend += book.total_price;
        const bTime = new Date(book.start_at).getTime();
        if (!current.lastBookingAt || bTime > current.lastBookingAt) {
          current.lastBookingAt = bTime;
        }
      }
      metricsMap.set(email, current);
    });

    const nextCustomers = currentCustomers.map(c => {
      const metrics = metricsMap.get(c.email.toLowerCase()) || { totalBookings: 0, totalSpend: 0 };
      return {
        ...c,
        totalBookings: metrics.totalBookings,
        totalSpend: metrics.totalSpend,
        lastBookingAt: metrics.lastBookingAt,
        updatedAt: Date.now()
      };
    });

    const knownEmails = new Set(nextCustomers.map(c => c.email.toLowerCase()));
    metricsMap.forEach((metrics, email) => {
      if (!knownEmails.has(email)) {
        const firstBooking = allBookings.find(b => b.customer_email.toLowerCase() === email);
        if (firstBooking) {
          nextCustomers.push({
            id: Math.random().toString(36).substr(2, 9),
            name: firstBooking.customer_name,
            email: email,
            phone: firstBooking.customer_phone,
            notes: firstBooking.notes || '',
            totalBookings: metrics.totalBookings,
            totalSpend: metrics.totalSpend,
            lastBookingAt: metrics.lastBookingAt,
            createdAt: new Date(firstBooking.created_at).getTime(),
            updatedAt: Date.now()
          });
        }
      }
    });

    return nextCustomers;
  }, []);

  const upsertCustomer = useCallback((customer: Partial<Customer>) => {
    setCustomers(prev => {
      let next;
      const existingIdx = prev.findIndex(c => c.email.toLowerCase() === customer.email?.toLowerCase());
      if (existingIdx > -1) {
        next = [...prev];
        next[existingIdx] = { ...next[existingIdx], ...customer, updatedAt: Date.now() };
      } else {
        const n: Customer = {
          id: Math.random().toString(36).substr(2, 9),
          name: customer.name || 'Unknown',
          email: customer.email || '',
          phone: customer.phone,
          notes: customer.notes || '',
          totalBookings: 0,
          totalSpend: 0,
          createdAt: Date.now(),
          updatedAt: Date.now(),
          ...customer
        };
        next = [...prev, n];
      }
      persist(LS_CUSTOMERS, next);
      return next;
    });
  }, []);

  const getCustomerByEmail = (email: string) => customers.find(c => c.email.toLowerCase() === email.toLowerCase());
  const getCustomerById = (id: string) => customers.find(c => c.id === id);

  const getOperatingWindow = (dateStr: string) => {
    const date = new Date(dateStr);
    const day = date.getDay();
    const special = specialHours.find(s => s.date === dateStr);
    if (special) {
      if (!special.enabled) return null;
      return { open: special.open!, close: special.close! };
    }
    const config = operatingHours.find(h => h.day === day);
    if (!config || !config.enabled) return null;
    return { open: config.open, close: config.close };
  };

  const isDateOpen = (dateStr: string) => getOperatingWindow(dateStr) !== null;

  const getBusyIntervals = (dateStr: string, roomId: string, staffId?: string) => {
    const window = getOperatingWindow(dateStr);
    if (!window) return [];

    const date = new Date(dateStr);
    const day = date.getDay();
    
    let windowStart = new Date(`${dateStr}T${window.open}`).getTime();
    let windowEnd = new Date(`${dateStr}T${window.close}`).getTime();
    if (windowEnd <= windowStart) windowEnd += 86400000;

    const roomBlocks = blocks
      .filter(b => b.roomId === roomId)
      .map(b => ({ 
        start: new Date(b.start_at).getTime(), 
        end: new Date(b.end_at).getTime(), 
        type: 'block' as const, 
        id: b.id, 
        reason: b.reason 
      }))
      .filter(i => i.start < windowEnd && i.end > windowStart);

    const roomBookings = bookings
      .filter(b => b.room_id === roomId && b.status !== BookingStatus.CANCELLED)
      .map(b => ({ 
        start: new Date(b.start_at).getTime(), 
        end: new Date(b.end_at).getTime(), 
        type: 'booking' as const, 
        id: b.id, 
        staff_id: b.staff_id,
        customer_name: b.customer_name,
        status: b.status,
        guests: b.guests
      }))
      .filter(i => i.start < windowEnd && i.end > windowStart);
    
    const staffBookings = staffId 
      ? bookings
          .filter(b => b.staff_id === staffId && b.status !== BookingStatus.CANCELLED)
          .map(b => ({ 
            start: new Date(b.start_at).getTime(), 
            end: new Date(b.end_at).getTime(), 
            type: 'booking' as const, 
            id: b.id, 
            customer_name: b.customer_name,
            status: b.status
          }))
          .filter(i => i.start < windowEnd && i.end > windowStart)
      : [];

    const recBlocks = recurringBlocks
      .filter(rb => rb.roomId === roomId && rb.enabled && rb.dayOfWeek === day)
      .map(rb => {
        const start = new Date(`${dateStr}T${rb.startTime}`).getTime();
        let end = new Date(`${dateStr}T${rb.endTime}`).getTime();
        if (end <= start) end += 86400000;
        return { start, end, type: 'recurring' as const, id: rb.id, reason: rb.reason };
      });

    return [...roomBlocks, ...roomBookings, ...recBlocks, ...staffBookings];
  };

  const validateInterval = (roomId: string, startIso: string, endIso: string, ignoreBookingId?: string, staffId?: string) => {
    const start = new Date(startIso).getTime();
    const end = new Date(endIso).getTime();
    const dateStr = startIso.split('T')[0];
    
    const window = getOperatingWindow(dateStr);
    if (!window) return { ok: false, reason: "Venue is closed on this date." };
    
    let windowStart = new Date(`${dateStr}T${window.open}`).getTime();
    let windowEnd = new Date(`${dateStr}T${window.close}`).getTime();
    if (windowEnd <= windowStart) windowEnd += 86400000;
    
    if (start < windowStart || end > windowEnd) {
      return { ok: false, reason: "Outside operating hours." };
    }

    const busy = getBusyIntervals(dateStr, roomId, staffId);
    const bufferMs = BUFFER_MINUTES * 60000;

    for (const item of busy) {
      if (item.id === ignoreBookingId) continue;
      const bStart = item.start - bufferMs;
      const bEnd = item.end + bufferMs;
      if (start < bEnd && end > bStart) {
        return { ok: false, reason: "Overlap with existing session/block/buffer." };
      }
    }
    
    return { ok: true };
  };

  const findFirstAvailableRoomAndStaff = (startIso: string, endIso: string, preferredStaffId?: string, serviceId?: string): { room_id: string, staff_id: string } | null => {
    const availableStaff = staff.filter(s => s.enabled && (!serviceId || s.servicesOffered.includes(serviceId)));
    const targetStaff = preferredStaffId ? availableStaff.filter(s => s.id === preferredStaffId) : availableStaff;

    // Only iterate through active rooms
    for (const r of rooms.filter(room => room.is_active)) {
      if (staff.length > 0) {
        for (const s of targetStaff) {
          if (validateInterval(r.id, startIso, endIso, undefined, s.id).ok) {
            return { room_id: r.id, staff_id: s.id };
          }
        }
      } else {
        if (validateInterval(r.id, startIso, endIso).ok) return { room_id: r.id, staff_id: '' };
      }
    }
    return null;
  };

  const getValidStartTimes = (dateStr: string, totalDurationMinutes: number, staffId?: string, serviceId?: string) => {
    const dateObj = new Date(dateStr + "T00:00:00");
    const todayObj = new Date();
    todayObj.setHours(0, 0, 0, 0);

    if (dateObj.getTime() < todayObj.getTime()) return [];

    const window = getOperatingWindow(dateStr);
    if (!window) return [];

    let currentMins = parseInt(window.open.split(':')[0]) * 60 + parseInt(window.open.split(':')[1]);
    let endMins = parseInt(window.close.split(':')[0]) * 60 + parseInt(window.close.split(':')[1]);
    if (endMins <= currentMins) endMins += 1440;

    const results: string[] = [];
    const step = SLOT_MINUTES;
    const nowTs = Date.now();
    const bufferMs = BUFFER_MINUTES * 60000;
    const localDayStartTs = dateObj.getTime();

    for (let m = currentMins; m <= endMins - totalDurationMinutes; m += step) {
      const slotStartTs = localDayStartTs + (m * 60000);
      
      if (slotStartTs < nowTs + bufferMs) continue;

      const h = Math.floor((m % 1440) / 60);
      const min = (m % 1440) % 60;
      const timeStr = `${h.toString().padStart(2, '0')}:${min.toString().padStart(2, '0')}`;
      
      const startIso = new Date(slotStartTs).toISOString();
      const endIso = new Date(slotStartTs + totalDurationMinutes * 60000).toISOString();

      if (findFirstAvailableRoomAndStaff(startIso, endIso, staffId, serviceId)) {
        results.push(timeStr);
      }
    }
    
    return results;
  };

  const calculatePricing = (dateStr: string, guests: number, extraHours: number, promoCode?: string) => {
    const tier = PRICING_TIERS.find(t => guests >= t.min && guests <= t.max);
    const baseTotal = tier ? tier.price : 0;
    
    const day = new Date(dateStr).getDay();
    const isMidweek = day >= 1 && day <= 3;
    const discountAmount = isMidweek ? (baseTotal * MIDWEEK_DISCOUNT_PERCENT) / 100 : 0;
    const extrasPrice = (EXTRAS.find(e => e.hours === extraHours) || { price: 0 }).price;

    let promoDiscountAmount = 0;
    let promoError = null;

    if (promoCode) {
      if (isMidweek) {
        promoError = "Promos cannot be combined with midweek discounts.";
      } else {
        const promo = promoCodes.find(p => p.code.toUpperCase() === promoCode.toUpperCase() && p.enabled);
        if (promo) {
          const now = new Date().toISOString().split('T')[0];
          if (now < promo.startDate || now > promo.endDate) promoError = "Promo code has expired.";
          else if (promo.maxUses && promo.uses >= promo.maxUses) promoError = "Promo code limit reached.";
          else if (promo.minGuests && guests < promo.minGuests) promoError = `Min ${promo.minGuests} guests required.`;
          else {
            if (promo.percentOff) promoDiscountAmount = (baseTotal * promo.percentOff) / 100;
            else if (promo.fixedOff) promoDiscountAmount = Math.min(baseTotal, promo.fixedOff);
          }
        } else promoError = "Invalid promo code.";
      }
    }

    const total = baseTotal - discountAmount + extrasPrice - promoDiscountAmount;
    return { baseTotal, discountAmount, extrasPrice, promoDiscountAmount, totalPrice: Math.max(0, total), promoError };
  };

  const getEnabledExtras = () => {
    return [...extrasCatalog]
      .filter(e => e.enabled)
      .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name));
  };

  const computeExtrasTotal = (selectionMap: Record<string, number>, guests: number) => {
    let total = 0;
    const enabled = getEnabledExtras();
    enabled.forEach(e => {
      const qty = selectionMap[e.id] || 0;
      if (qty > 0) {
        if (e.pricingMode === 'flat') {
          total += e.price * qty;
        } else {
          total += e.price * guests;
        }
      }
    });
    return total;
  };

  const buildBookingExtrasSnapshot = (selectionMap: Record<string, number>, guests: number): BookingExtraSelection[] => {
    const snapshot: BookingExtraSelection[] = [];
    const enabled = getEnabledExtras();
    enabled.forEach(e => {
      const qty = selectionMap[e.id] || 0;
      if (qty > 0) {
        const lineTotal = e.pricingMode === 'flat' ? e.price * qty : e.price * guests;
        snapshot.push({
          extraId: e.id,
          nameSnapshot: e.name,
          priceSnapshot: e.price,
          pricingModeSnapshot: e.pricingMode,
          quantity: e.pricingMode === 'flat' ? qty : 1,
          lineTotal
        });
      }
    });
    return snapshot;
  };

  const addExtra = (patch: Omit<Extra, 'id'>) => {
    const next: Extra = { ...patch, id: 'ex-' + Math.random().toString(36).substr(2, 5) };
    const nextCatalog = [...extrasCatalog, next];
    setExtrasCatalog(nextCatalog);
    persist(LS_EXTRAS, nextCatalog);
    return next;
  };

  const updateExtra = (id: string, patch: Partial<Extra>) => {
    const nextCatalog = extrasCatalog.map(e => e.id === id ? { ...e, ...patch } : e);
    setExtrasCatalog(nextCatalog);
    persist(LS_EXTRAS, nextCatalog);
  };

  const deleteExtra = (id: string) => {
    const nextCatalog = extrasCatalog.filter(e => e.id !== id);
    setExtrasCatalog(nextCatalog);
    persist(LS_EXTRAS, nextCatalog);
  };

  const reorderExtras = (idsInOrder: string[]) => {
    const nextCatalog = extrasCatalog.map(e => {
      const idx = idsInOrder.indexOf(e.id);
      return idx > -1 ? { ...e, sortOrder: idx } : e;
    });
    setExtrasCatalog(nextCatalog);
    persist(LS_EXTRAS, nextCatalog);
  };

  const addBooking = (b: Omit<Booking, 'id' | 'magicToken' | 'deposit_amount' | 'deposit_paid' | 'deposit_forfeited'> & Partial<Pick<Booking, 'deposit_amount' | 'deposit_paid' | 'deposit_forfeited'>>) => {
    const n: Booking = { 
      ...b, 
      id: Math.random().toString(36).substr(2, 9),
      magicToken: Math.random().toString(36).substring(2, 15),
      deposit_amount: b.deposit_amount ?? (settings.deposit_enabled ? settings.deposit_amount : 0),
      deposit_paid: b.deposit_paid ?? false,
      deposit_forfeited: b.deposit_forfeited ?? false
    };
    const next = [...bookings, n];
    setBookings(next);
    persist(LS_BOOKINGS, next);

    upsertCustomer({
      name: n.customer_name,
      email: n.customer_email,
      phone: n.customer_phone,
      notes: n.notes
    });
    
    setTimeout(() => {
        setCustomers(prev => {
            const recomputed = recomputeCustomerMetrics(next, prev);
            persist(LS_CUSTOMERS, recomputed);
            return recomputed;
        });
    }, 0);

    return n;
  };

  const updateBooking = (id: string, patch: Partial<Booking>) => {
    const next = bookings.map(b => b.id === id ? { ...b, ...patch } : b);
    setBookings(next);
    persist(LS_BOOKINGS, next);

    if (patch.customer_email || patch.customer_name || patch.customer_phone) {
        const b = next.find(b => b.id === id);
        if (b) {
            upsertCustomer({
                name: b.customer_name,
                email: b.customer_email,
                phone: b.customer_phone
            });
        }
    }

    setTimeout(() => {
        setCustomers(prev => {
            const recomputed = recomputeCustomerMetrics(next, prev);
            persist(LS_CUSTOMERS, recomputed);
            return recomputed;
        });
    }, 0);
  };

  const cancelBooking = (id: string) => {
    const b = bookings.find(x => x.id === id);
    if (!b) return;

    const canRefund = canRescheduleOrCancel(b, 'cancel');
    const updatePatch: Partial<Booking> = { status: BookingStatus.CANCELLED };
    
    if (!canRefund && b.deposit_amount > 0) {
      updatePatch.deposit_forfeited = true;
      updatePatch.deposit_paid = false;
    }
    
    updateBooking(id, updatePatch);
  };
  
  const deleteBooking = (id: string) => {
    const next = bookings.filter(b => b.id !== id);
    setBookings(next);
    persist(LS_BOOKINGS, next);
    
    setTimeout(() => {
        setCustomers(prev => {
            const recomputed = recomputeCustomerMetrics(next, prev);
            persist(LS_CUSTOMERS, recomputed);
            return recomputed;
        });
    }, 0);
  };

  const addBlock = (b: Omit<RoomBlock, 'id' | 'createdAt'>) => {
    const n = { ...b, id: Math.random().toString(36).substr(2, 9), createdAt: Date.now() };
    const next = [...blocks, n];
    setBlocks(next);
    persist(LS_BLOCKS, next);
    return n;
  };

  const deleteBlock = (id: string) => {
    const next = blocks.filter(b => b.id !== id);
    setBlocks(next);
    persist(LS_BLOCKS, next);
  };

  const addRecurringBlock = (rb: Omit<RecurringBlock, 'id'>) => {
    const n = { ...rb, id: Math.random().toString(36).substr(2, 9) };
    const next = [...recurringBlocks, n];
    setRecurringBlocks(next);
    persist(LS_RECURRING_BLOCKS, next);
    return n;
  };

  const updateRecurringBlock = (id: string, patch: Partial<RecurringBlock>) => {
    const next = recurringBlocks.map(r => r.id === id ? { ...r, ...patch } : r);
    setRecurringBlocks(next);
    persist(LS_RECURRING_BLOCKS, next);
  };

  const deleteRecurringBlock = (id: string) => {
    const next = recurringBlocks.filter(r => r.id !== id);
    setRecurringBlocks(next);
    persist(LS_RECURRING_BLOCKS, next);
  };

  const toggleRecurringBlock = (id: string, enabled: boolean) => updateRecurringBlock(id, { enabled });

  const updateOperatingHours = (hours: DayOperatingHours[]) => {
    setOperatingHours(hours);
    persist(LS_OPERATING_HOURS, hours);
  };

  const upsertSpecialHours = (sh: SpecialHours) => {
    const next = [...specialHours.filter(s => s.date !== sh.date), sh];
    setSpecialHours(next);
    persist(LS_SPECIAL_HOURS, next);
  };

  const deleteSpecialHours = (date: string) => {
    const next = specialHours.filter(s => s.date !== date);
    setSpecialHours(next);
    persist(LS_SPECIAL_HOURS, next);
  };

  const addPromoCode = (pc: Omit<PromoCode, 'id' | 'uses'>) => {
    const n = { ...pc, id: Math.random().toString(36).substr(2, 9), uses: 0 };
    const next = [...promoCodes, n];
    setPromoCodes(next);
    persist(LS_PROMO_CODES, next);
  };

  const updatePromoCode = (id: string, patch: Partial<PromoCode>) => {
    const next = promoCodes.map(p => p.id === id ? { ...p, ...patch } : p);
    setPromoCodes(next);
    persist(LS_PROMO_CODES, next);
  };

  const addService = (s: Omit<Service, 'id'>) => {
    const ns = { ...s, id: 'svc-' + Math.random().toString(36).substr(2, 5) };
    const next = [...services, ns];
    setServices(next);
    persist(LS_SERVICES, next);
  };

  const updateService = (id: string, patch: Partial<Service>) => {
    const next = services.map(s => s.id === id ? { ...s, ...patch } : s);
    setServices(next);
    persist(LS_SERVICES, next);
  };

  const deleteService = (id: string) => {
    const next = services.filter(s => s.id !== id);
    setServices(next);
    persist(LS_SERVICES, next);
  };

  const addStaff = (st: Omit<StaffMember, 'id'>) => {
    const nst = { ...st, id: 'staff-' + Math.random().toString(36).substr(2, 5) };
    const next = [...staff, nst];
    setStaff(next);
    persist(LS_STAFF, next);
  };

  const updateStaff = (id: string, patch: Partial<StaffMember>) => {
    const next = staff.map(s => s.id === id ? { ...s, ...patch } : s);
    setStaff(next);
    persist(LS_STAFF, next);
  };

  const deleteStaff = (id: string) => {
    const next = staff.filter(s => s.id !== id);
    setStaff(next);
    persist(LS_STAFF, next);
  };

  const updateSettings = (patch: Partial<VenueSettings>) => {
    const next = { ...settings, ...patch };
    setSettings(next);
    persist(LS_SETTINGS, next);
  };

  const updateCustomerNotes = (email: string, notes: string) => {
    upsertCustomer({ email, notes });
  };

  const adjustBooking = (id: string, startIso: string, endIso: string, roomId: string) => {
    const validation = validateInterval(roomId, startIso, endIso, id);
    if (!validation.ok) return validation;
    updateBooking(id, { start_at: startIso, end_at: endIso, room_id: roomId, room_name: rooms.find(r => r.id === roomId)?.name || 'Room' });
    return { ok: true };
  };

  const getBookingByMagicToken = (token: string) => {
    return bookings.find(b => b.magicToken === token);
  };

  const canRescheduleOrCancel = (booking: Booking, type: 'reschedule' | 'cancel') => {
    const cutoffHours = type === 'cancel' ? settings.cancelCutoffHours : settings.rescheduleCutoffHours;
    const now = new Date().getTime();
    const start = new Date(booking.start_at).getTime();
    const diffHours = (start - now) / (1000 * 60 * 60);
    return diffHours >= cutoffHours && booking.status !== BookingStatus.CANCELLED;
  };

  const markDepositPaid = (id: string, paid: boolean) => {
    updateBooking(id, { deposit_paid: paid, deposit_forfeited: false });
  };

  const markDepositForfeited = (id: string, forfeited: boolean) => {
    updateBooking(id, { deposit_forfeited: forfeited, deposit_paid: false });
  };

  const getDepositSettings = () => ({
    enabled: settings.deposit_enabled,
    amount: settings.deposit_amount
  });

  const getCalendarSyncConfig = () => calendarSyncConfig;
  const setCalendarSyncConfig = (patch: Partial<CalendarSyncConfig>) => {
    const next = { ...calendarSyncConfig, ...patch };
    setCalendarSyncConfigState(next);
    persist(LS_CAL_SYNC, next);
  };
  const regenerateCalendarToken = () => {
    const newToken = generateToken();
    const next = { ...calendarSyncConfig, token: newToken, lastRegeneratedAt: new Date().toISOString() };
    setCalendarSyncConfigState(next);
    persist(LS_CAL_SYNC, next);
    return newToken;
  };

  return {
    rooms, bookings, blocks, recurringBlocks, operatingHours, specialHours, promoCodes, adminUsers, customers, services, staff, settings, waitlist, loading, extrasCatalog,
    getOperatingWindow, isDateOpen, getValidStartTimes, getBusyIntervals, findFirstAvailableRoomAndStaff, validateInterval, calculatePricing,
    getEnabledExtras, computeExtrasTotal, buildBookingExtrasSnapshot, addExtra, updateExtra, deleteExtra, reorderExtras,
    addBooking, updateBooking, cancelBooking, deleteBooking, addBlock, deleteBlock, addRecurringBlock, updateRecurringBlock, deleteRecurringBlock, toggleRecurringBlock,
    updateOperatingHours, upsertSpecialHours, deleteSpecialHours, addPromoCode, updatePromoCode, addService, updateService, deleteService, addStaff, updateStaff, deleteStaff,
    updateSettings, updateCustomerNotes, getBookingByMagicToken, canRescheduleOrCancel, adjustBooking, upsertCustomer, getCustomerByEmail, getCustomerById,
    addWaitlistEntry, deleteWaitlistEntry, buildWaitlistMessage, getBookingsForDate, getBlocksForDate,
    markDepositPaid, markDepositForfeited, getDepositSettings, buildWhatsAppUrl, setWaitlistStatus, getWaitlistForDate,
    getCalendarSyncConfig, setCalendarSyncConfig, regenerateCalendarToken
  };
};
