import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

import { BASE_DURATION_HOURS, EXTRAS, MIDWEEK_DISCOUNT_PERCENT, PRICING_TIERS } from '@/constants';
import {
  REQUIRED_BOOKING_DRAFT_FIELDS,
  REQUIRED_BOOKING_INSERT_FIELDS,
  buildCustomerName,
  validateBookingDraftInput
} from '@/lib/bookingValidation';
import { computeAmountDueNow } from '@/lib/paymentLogic';
import { BookingStatus } from '@/types';

type DraftRequest = {
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
};

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const isNonEmptyString = (value?: string | null): value is string =>
  typeof value === 'string' && value.trim().length > 0;

export async function POST(request: Request) {
  try {
    if (!supabaseUrl || !supabaseServiceKey) {
      return NextResponse.json(
        { error: 'Supabase credentials are not configured.' },
        { status: 500 }
      );
    }

    const payload = (await request.json().catch(() => null)) as DraftRequest | null;
    if (!payload) {
      return NextResponse.json({ error: 'Invalid request payload.' }, { status: 400 });
    }

    const validation = validateBookingDraftInput(payload);
    if (!validation.isValid) {
      return NextResponse.json(
        {
          error: 'Missing or invalid booking details.',
          fields: validation.fieldErrors,
          required: REQUIRED_BOOKING_DRAFT_FIELDS
        },
        { status: 400 }
      );
    }

    const { date, time, guests, extraHours, firstName, surname, email } = validation.normalized;
    const promo = payload.promo?.trim() ?? '';

    const tier = PRICING_TIERS.find((t) => guests >= t.min && guests <= t.max);
    if (!tier) {
      return NextResponse.json({ error: 'Guest count is out of range.' }, { status: 400 });
    }

    const extraOption = EXTRAS.find((extra) => extra.hours === extraHours);
    if (!extraOption) {
      return NextResponse.json({ error: 'Invalid extra hours selection.' }, { status: 400 });
    }

    const startTimestamp = Date.parse(`${date}T${time}:00`);
    if (!Number.isFinite(startTimestamp)) {
      console.error('Invalid booking date/time for booking draft.', { date, time, payload });
      return NextResponse.json({ error: 'Invalid booking date/time' }, { status: 400 });
    }
    const startDate = new Date(startTimestamp);

    const totalDurationHours = BASE_DURATION_HOURS + extraHours;
    const endDate = new Date(startDate.getTime() + totalDurationHours * 3600000);

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { data: settings, error: settingsError } = await supabase
      .from('venue_settings')
      .select('deposit_enabled,deposit_amount,midweek_discount_percent')
      .maybeSingle();

    if (settingsError) {
      console.warn('Failed to load venue settings for booking draft, using defaults.', settingsError);
    } else if (!settings) {
      console.warn('Venue settings row is missing for booking draft, using defaults.');
    }

    const baseTotal = tier.price;
    const extrasPrice = extraOption.price;
    const dayOfWeek = new Date(`${date}T00:00:00`).getDay();
    const isMidweek = dayOfWeek >= 1 && dayOfWeek <= 3;
    const discountPercent = isMidweek
      ? Math.max(0, settings?.midweek_discount_percent ?? MIDWEEK_DISCOUNT_PERCENT)
      : 0;
    const discountAmount = Math.round((baseTotal + extrasPrice) * (discountPercent / 100));

    let promoDiscountAmount = 0;
    let promoCodeToStore: string | null = promo ? promo : null;

    if (promoCodeToStore) {
      const { data: promoData, error: promoError } = await supabase
        .from('promo_codes')
        .select('code,enabled,percent_off,fixed_off,start_date,end_date,min_guests,max_uses,uses')
        .eq('code', promoCodeToStore)
        .maybeSingle();

      if (promoError) {
        console.error('Failed to load promo code for booking draft.', promoError);
      }

      if (promoError || !promoData || !promoData.enabled) {
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
          promoDiscountAmount = Math.round(
            (baseTotal + extrasPrice - discountAmount) * (promoData.percent_off / 100)
          );
        } else if (promoData.fixed_off) {
          promoDiscountAmount = promoData.fixed_off;
        }
      }
    }

    const totalPrice = Math.max(0, baseTotal + extrasPrice - discountAmount - promoDiscountAmount);
    const depositEnabled = Boolean(settings?.deposit_enabled);
    const depositAmountSetting = settings?.deposit_amount ?? 0;
    const depositAmount = computeAmountDueNow({
      totalPrice,
      depositEnabled,
      depositAmount: depositAmountSetting
    });
    const isZeroDeposit = depositAmount <= 0;

    const nowIso = new Date().toISOString();
    let existingDraftQuery = supabase
      .from('bookings')
      .select('*')
      .eq('status', BookingStatus.DRAFT)
      .eq('source', 'public')
      .eq('start_at', startDate.toISOString())
      .eq('end_at', endDate.toISOString())
      .eq('guests', guests)
      .eq('extras_hours', extraHours);

    existingDraftQuery = isNonEmptyString(payload.serviceId)
      ? existingDraftQuery.eq('service_id', payload.serviceId)
      : existingDraftQuery.is('service_id', null);
    existingDraftQuery = isNonEmptyString(payload.staffId)
      ? existingDraftQuery.eq('staff_id', payload.staffId)
      : existingDraftQuery.is('staff_id', null);
    existingDraftQuery = isNonEmptyString(promoCodeToStore)
      ? existingDraftQuery.eq('promo_code', promoCodeToStore)
      : existingDraftQuery.is('promo_code', null);

    const { data: existingDraft, error: existingDraftError } = await existingDraftQuery
      .or(`expires_at.is.null,expires_at.gte.${nowIso}`)
      .maybeSingle();

    if (existingDraftError) {
      console.error('Failed to load existing booking draft.', existingDraftError);
      return NextResponse.json({ error: 'Unable to load booking draft.' }, { status: 500 });
    }

    if (existingDraft) {
      const { data: refreshedDraft, error: refreshError } = await supabase
        .from('bookings')
        .update({
          booking_date: date,
          start_time: time,
          duration_hours: totalDurationHours,
          customer_name: buildCustomerName(firstName, surname),
          customer_surname: surname,
          customer_email: email,
          customer_phone: isNonEmptyString(payload.phone) ? payload.phone.trim() : null,
          notes: isNonEmptyString(payload.notes) ? payload.notes.trim() : null
        })
        .eq('id', existingDraft.id)
        .select('*')
        .maybeSingle();

      if (refreshError) {
        console.error('Failed to refresh booking draft details.', refreshError);
        return NextResponse.json({ error: 'Unable to update booking draft.' }, { status: 500 });
      }

      return NextResponse.json({ bookingId: existingDraft.id, booking: refreshedDraft ?? existingDraft });
    }

    const { data: rooms, error: roomsError } = await supabase
      .from('rooms')
      .select('id,name,is_active')
      .eq('is_active', true)
      .order('name');

    if (roomsError || !rooms) {
      console.error('Failed to load rooms for booking draft.', roomsError);
      return NextResponse.json({ error: 'Unable to allocate a room.' }, { status: 500 });
    }

    const { data: overlappingBookings, error: bookingsError } = await supabase
      .from('bookings')
      .select('room_id')
      .neq('status', BookingStatus.CANCELLED)
      .lt('start_at', endDate.toISOString())
      .gt('end_at', startDate.toISOString());

    if (bookingsError) {
      console.error('Failed to load bookings for draft validation.', bookingsError);
      return NextResponse.json({ error: 'Unable to validate availability.' }, { status: 500 });
    }

    const { data: roomBlocks, error: blocksError } = await supabase
      .from('room_blocks')
      .select('room_id')
      .lt('start_at', endDate.toISOString())
      .gt('end_at', startDate.toISOString());

    if (blocksError) {
      console.error('Failed to load room blocks for draft validation.', blocksError);
      return NextResponse.json({ error: 'Unable to validate availability.' }, { status: 500 });
    }

    const blockedRoomIds = new Set<string>();
    (overlappingBookings ?? []).forEach((booking) => {
      if (booking.room_id) blockedRoomIds.add(booking.room_id);
    });
    (roomBlocks ?? []).forEach((block) => {
      if (block.room_id) blockedRoomIds.add(block.room_id);
    });

    const assignedRoom = rooms.find((room) => !blockedRoomIds.has(room.id));
    if (!assignedRoom) {
      return NextResponse.json({ error: 'No rooms available for this time.' }, { status: 409 });
    }

    const assignedRoomId = assignedRoom.id;
    if (!assignedRoomId) {
      return NextResponse.json({ error: 'Unable to allocate a room.' }, { status: 500 });
    }

    let resolvedRoomName = assignedRoom.name?.trim() ?? '';
    if (!resolvedRoomName) {
      const { data: roomData, error: roomError } = await supabase
        .from('rooms')
        .select('name')
        .eq('id', assignedRoomId)
        .single();

      if (roomError) {
        console.error('Failed to resolve room name for booking draft.', roomError);
        return NextResponse.json({ error: 'Unable to allocate a room.' }, { status: 500 });
      }

      resolvedRoomName = roomData?.name?.trim() ?? '';
    }

    if (!resolvedRoomName) {
      return NextResponse.json({ error: 'Unable to allocate a room.' }, { status: 500 });
    }

    const expiresAt = new Date(Date.now() + 20 * 60 * 1000).toISOString();

    const { buildDraftBookingPayload } = await import('@/lib/bookingPayload');
    const bookingPayload = buildDraftBookingPayload({
      roomId: assignedRoomId,
      roomName: resolvedRoomName,
      serviceId: isNonEmptyString(payload.serviceId) ? payload.serviceId : null,
      staffId: isNonEmptyString(payload.staffId) ? payload.staffId : null,
      date,
      time,
      extraHours: extraHours,
      baseDurationHours: BASE_DURATION_HOURS,
      baseTotal,
      extrasPrice,
      discountAmount,
      promoCode: promoCodeToStore,
      promoDiscountAmount,
      totalPrice,
      source: 'public',
      depositAmount,
      depositPaid: isZeroDeposit,
      expiresAt,
      firstName,
      surname,
      email,
      phone: isNonEmptyString(payload.phone) ? payload.phone.trim() : null,
      notes: isNonEmptyString(payload.notes) ? payload.notes.trim() : null
    });
    bookingPayload.guests = guests;

    const missingInsertFields = REQUIRED_BOOKING_INSERT_FIELDS.filter((field) => {
      const value = bookingPayload[field as keyof typeof bookingPayload];
      if (typeof value === 'string') return value.trim().length === 0;
      return value === null || value === undefined;
    });

    if (missingInsertFields.length > 0) {
      return NextResponse.json(
        {
          error: 'Missing required booking fields for insert.',
          fields: missingInsertFields
        },
        { status: 400 }
      );
    }

    console.log('booking insert payload keys', Object.keys(bookingPayload), 'booking_date', bookingPayload.booking_date);

    const { data: insertedBooking, error: bookingError } = await supabase
      .from('bookings')
      .insert([bookingPayload])
      .select('id')
      .maybeSingle();

    if (bookingError || !insertedBooking) {
      console.error('Failed to create booking draft.', {
        error: { message: bookingError?.message, hint: bookingError?.hint, code: bookingError?.code },
        payloadKeys: Object.keys(bookingPayload),
        booking_date: bookingPayload.booking_date
      });
      const errorMessage = bookingError?.message
        ? `Unable to create booking draft: ${bookingError.message}`
        : 'Unable to create booking draft.';
      return NextResponse.json({ error: errorMessage }, { status: 500 });
    }

    const { data: booking, error: fetchError } = await supabase
      .from('bookings')
      .select('*')
      .eq('id', insertedBooking.id)
      .maybeSingle();

    if (fetchError || !booking) {
      console.error('Failed to fetch booking draft after insert.', { error: fetchError, payload: bookingPayload });
      return NextResponse.json({ error: 'Unable to load booking draft.' }, { status: 500 });
    }

    return NextResponse.json({ bookingId: booking.id, booking });
  } catch (error) {
    console.error('Unexpected error creating booking draft.', error);
    return NextResponse.json({ error: 'Unable to create booking draft.' }, { status: 500 });
  }
}
