import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

import { BASE_DURATION_HOURS, EXTRAS, EARLY_BIRD_LAST_START_TIME, EARLY_BIRD_PRICE_PER_PERSON } from '@/constants';
import { validateBookingDraftInput } from '@/lib/bookingValidation';
import { computeBookingTotals } from '@/lib/bookingTotals';
import { computeOfferDiscounts } from '@/lib/offerUtils';
import { computeAmountDueNow } from '@/lib/paymentLogic';
import { computeEarlyBirdDiscount } from '@/lib/earlyBird';
import { expireStaleDrafts } from '@/lib/draftExpiry';
import { BookingStatus, BookingExtraSelection } from '@/types';
import { getExtraMaxQuantity } from '@/lib/bookingUpdateValidation';
import { isBlockingBookingForAvailability, overlapsRange } from '@/lib/availabilityRules';

type FinalizeRequest = {
  date?: string;
  time?: string;
  guests?: number | string;
  extraHours?: number | string;
  promo?: string | null;
  serviceId?: string | null;
  staffId?: string | null;
  firstName?: string | null;
  surname?: string | null;
  email?: string | null;
  phone?: string | null;
  notes?: string | null;
  specialRequests?: string | null;
  extras?: Record<string, number>;
};

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const toNullableString = (value?: string | null) => {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

export async function POST(request: Request) {
  try {
    if (!supabaseUrl || !supabaseServiceKey) {
      return NextResponse.json({ error: 'Supabase credentials are not configured.' }, { status: 500 });
    }

    const payload = (await request.json().catch(() => null)) as FinalizeRequest | null;
    if (!payload) {
      return NextResponse.json({ error: 'Invalid request payload.' }, { status: 400 });
    }

    const validation = validateBookingDraftInput(payload);
    if (!validation.isValid) {
      return NextResponse.json({ error: 'Missing or invalid booking details.', fields: validation.fieldErrors }, { status: 400 });
    }

    const { date, time, guests, extraHours, firstName, surname, email } = validation.normalized;
    const promo = payload.promo?.trim() ?? '';
    const serviceId = payload.serviceId?.trim();
    const staffId = payload.staffId?.trim() || null;

    if (!serviceId) {
      return NextResponse.json({ error: 'Service is required.' }, { status: 400 });
    }

    const extraOption = EXTRAS.find((extra) => extra.hours === extraHours);
    if (!extraOption) {
      return NextResponse.json({ error: 'Invalid extra hours selection.' }, { status: 400 });
    }

    const startTimestamp = Date.parse(`${date}T${time}:00`);
    if (!Number.isFinite(startTimestamp)) {
      return NextResponse.json({ error: 'Invalid booking date/time' }, { status: 400 });
    }

    const startDate = new Date(startTimestamp);
    const totalDurationHours = BASE_DURATION_HOURS + extraHours;
    const endDate = new Date(startDate.getTime() + totalDurationHours * 3600000);

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    try {
      await expireStaleDrafts(supabase);
    } catch (expiryError) {
      console.warn('Failed to auto-expire stale drafts during finalize.', expiryError);
    }

    const { data: selectedService, error: serviceError } = await supabase
      .from('services')
      .select('id,min_people,max_people,price_per_person_pence,is_active')
      .eq('id', serviceId)
      .maybeSingle();

    if (serviceError || !selectedService || !selectedService.is_active) {
      return NextResponse.json({ error: 'Selected service is unavailable.' }, { status: 400 });
    }

    if (guests < selectedService.min_people || guests > selectedService.max_people) {
      return NextResponse.json({ error: 'Guest count is outside the selected service range.' }, { status: 400 });
    }

    const { data: settings } = await supabase
      .from('venue_settings')
      .select('deposit_enabled,deposit_amount,midweek_discount_percent,offers')
      .maybeSingle();

    const baseTotal = Number(((selectedService.price_per_person_pence * guests) / 100).toFixed(2));
    const extrasPrice = extraOption.price;

    const earlyBird = computeEarlyBirdDiscount({
      baseTotal,
      guests,
      startTime: time,
      targetPricePerPerson: EARLY_BIRD_PRICE_PER_PERSON,
      lastStartTime: EARLY_BIRD_LAST_START_TIME
    });

    const offers = settings?.offers ?? [];
    const offerRes = computeOfferDiscounts(offers, settings?.midweek_discount_percent, date, baseTotal, extrasPrice);
    const discountAmount = offerRes.midweekDiscountAmount + earlyBird.discountAmount;

    let promoDiscountAmount = 0;
    let promoCodeToStore: string | null = promo ? promo : null;

    if (promoCodeToStore) {
      const { data: promoData } = await supabase
        .from('promo_codes')
        .select('code,enabled,percent_off,fixed_off,start_date,end_date,min_guests,max_uses,uses')
        .eq('code', promoCodeToStore)
        .maybeSingle();

      if (!promoData || !promoData.enabled) {
        promoCodeToStore = null;
      } else {
        const today = new Date(date);
        const promoStart = new Date(promoData.start_date);
        const promoEnd = new Date(promoData.end_date);
        const withinWindow = today >= promoStart && today <= promoEnd;
        const minGuestsOk = promoData.min_guests ? guests >= promoData.min_guests : true;
        const maxUsesOk = promoData.max_uses ? (promoData.uses ?? 0) < promoData.max_uses : true;

        if (!withinWindow || !minGuestsOk || !maxUsesOk) {
          promoCodeToStore = null;
        } else if (promoData.percent_off) {
          promoDiscountAmount = Math.round((baseTotal + extrasPrice - discountAmount) * (promoData.percent_off / 100));
        } else if (promoData.fixed_off) {
          promoDiscountAmount = promoData.fixed_off;
        }
      }
    }

    const { data: dbExtras, error: extrasError } = await supabase
      .from('extras')
      .select('*')
      .eq('enabled', true);

    if (extrasError || !dbExtras) {
      return NextResponse.json({ error: 'Unable to validate extras.' }, { status: 500 });
    }

    const extrasSelection = payload.extras || {};
    const extrasById = new Map<string, any>(dbExtras.map((extra: any) => [extra.id, extra]));
    const extrasSnapshot: BookingExtraSelection[] = [];
    let extrasTotal = 0;

    for (const [extraId, qtyRaw] of Object.entries(extrasSelection)) {
      const qty = Number(qtyRaw);
      if (!Number.isFinite(qty) || qty <= 0 || !Number.isInteger(qty)) continue;
      const extraDef = extrasById.get(extraId);
      if (!extraDef) {
        return NextResponse.json({ error: 'Invalid extras selection.' }, { status: 400 });
      }

      const maxQuantity = getExtraMaxQuantity(extraDef);
      if (maxQuantity !== null && qty > maxQuantity) {
        return NextResponse.json({ error: `Quantity exceeds allowed maximum (${maxQuantity}) for ${extraDef.name}.` }, { status: 400 });
      }

      const price = Number(extraDef.price);
      const pricingMode = extraDef.pricing_mode;
      const lineTotal = pricingMode === 'per_person' ? price * guests * qty : price * qty;

      extrasTotal += lineTotal;
      extrasSnapshot.push({
        extraId: extraDef.id,
        nameSnapshot: extraDef.name,
        priceSnapshot: price,
        pricingModeSnapshot: pricingMode as 'flat' | 'per_person',
        quantity: qty,
        lineTotal,
        infoTextSnapshot: extraDef.info_text
      });
    }

    const subtotal = Math.max(0, baseTotal + extrasPrice - discountAmount);
    const afterPromo = Math.max(0, subtotal - promoDiscountAmount);
    const offerPercentDiscount = offerRes.offerPercent > 0 ? Math.round(afterPromo * (offerRes.offerPercent / 100)) : 0;
    const offerFixed = offerRes.offerFixed;

    const totals = computeBookingTotals({
      baseTotal,
      extrasPrice,
      discountAmount: discountAmount + offerPercentDiscount + offerFixed,
      promoDiscountAmount,
      lineItems: extrasSnapshot as any[]
    });

    const grandTotal = Number((totals.grandTotal).toFixed(2));
    const depositAmount = computeAmountDueNow({
      totalPrice: grandTotal,
      depositEnabled: Boolean(settings?.deposit_enabled),
      depositAmount: settings?.deposit_amount ?? 0
    });

    const { data: rooms, error: roomsError } = await supabase
      .from('rooms')
      .select('id,name,is_active')
      .eq('is_active', true)
      .order('name');

    if (roomsError || !rooms) {
      return NextResponse.json({ error: 'Unable to allocate a room.' }, { status: 500 });
    }

    const roomIds = rooms.map((room: any) => room.id);
    const { data: overlappingBookings } = await supabase
      .from('bookings')
      .select('room_id,start_at,end_at,status,expires_at')
      .in('room_id', roomIds)
      .lt('start_at', endDate.toISOString())
      .gt('end_at', startDate.toISOString());

    const { data: roomBlocks } = await supabase
      .from('room_blocks')
      .select('room_id,start_at,end_at')
      .in('room_id', roomIds)
      .lt('start_at', endDate.toISOString())
      .gt('end_at', startDate.toISOString());

    const nowMs = Date.now();
    const blockingBookings = (overlappingBookings ?? []).filter((booking: any) => isBlockingBookingForAvailability(booking, nowMs));

    const assignedRoom = rooms.find((room: any) => {
      const bookingConflict = blockingBookings.some((booking: any) => {
        if (booking.room_id !== room.id) return false;
        const bookingStart = Date.parse(String(booking.start_at || ''));
        const bookingEnd = Date.parse(String(booking.end_at || ''));
        if (!Number.isFinite(bookingStart) || !Number.isFinite(bookingEnd)) return false;
        return overlapsRange(startDate.getTime(), endDate.getTime(), bookingStart, bookingEnd);
      });
      if (bookingConflict) return false;

      const blockConflict = (roomBlocks ?? []).some((block: any) => {
        if (block.room_id !== room.id) return false;
        const blockStart = Date.parse(String(block.start_at || ''));
        const blockEnd = Date.parse(String(block.end_at || ''));
        if (!Number.isFinite(blockStart) || !Number.isFinite(blockEnd)) return false;
        return overlapsRange(startDate.getTime(), endDate.getTime(), blockStart, blockEnd);
      });

      return !blockConflict;
    });

    if (!assignedRoom) {
      return NextResponse.json({ error: 'No rooms available for this time.' }, { status: 409 });
    }

    const insertPayload = {
      room_id: assignedRoom.id,
      room_name: assignedRoom.name,
      service_id: serviceId,
      staff_id: staffId,
      booking_date: date,
      start_time: time,
      duration_hours: totalDurationHours,
      start_at: startDate.toISOString(),
      end_at: endDate.toISOString(),
      status: BookingStatus.CONFIRMED,
      confirmed_at: new Date().toISOString(),
      expires_at: null,
      guests,
      customer_name: `${firstName} ${surname}`.trim(),
      customer_surname: surname,
      customer_email: email,
      customer_phone: toNullableString(payload.phone),
      notes: toNullableString(payload.notes),
      special_requests: toNullableString(payload.specialRequests) ?? toNullableString(payload.notes),
      base_total: baseTotal,
      extras_hours: extraHours,
      extras_price: extrasPrice,
      discount_amount: Number((discountAmount + offerPercentDiscount + offerFixed).toFixed(2)),
      promo_code: promoCodeToStore,
      promo_discount_amount: promoDiscountAmount,
      total_price: grandTotal,
      source: 'public',
      payment_state: 'NONE',
      deposit_amount: depositAmount,
      deposit_paid: depositAmount <= 0,
      extras_total: Number(extrasTotal.toFixed(2)),
      extras_snapshot: extrasSnapshot
    };

    const tryInsert = async () =>
      supabase
        .from('bookings')
        .insert([insertPayload])
        .select('id,booking_access_token')
        .maybeSingle();

    let { data: insertedBooking, error: bookingError } = await tryInsert();

    if (bookingError || !insertedBooking) {
      const code = bookingError?.code;
      const lowerMessage = String(bookingError?.message ?? '').toLowerCase();
      const isOverlapConstraint = code === '23P01' || lowerMessage.includes('bookings_no_overlap_per_room');

      if (isOverlapConstraint) {
        try {
          await expireStaleDrafts(supabase);
          const retry = await tryInsert();
          insertedBooking = retry.data;
          bookingError = retry.error;
        } catch (retryError) {
          console.warn('Finalize retry after stale draft expiry failed.', retryError);
        }
      }

      if (bookingError || !insertedBooking) {
        if (isOverlapConstraint) {
          return NextResponse.json({ error: 'That room was just booked. Please choose another time.' }, { status: 409 });
        }
        return NextResponse.json({ error: 'Unable to finalize booking.' }, { status: 500 });
      }
    }

    return NextResponse.json({ bookingId: insertedBooking.id, bookingToken: insertedBooking.booking_access_token });
  } catch (error) {
    console.error('Unexpected error finalizing booking.', error);
    return NextResponse.json({ error: 'Unable to finalize booking.' }, { status: 500 });
  }
}
