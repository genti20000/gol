import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

import { BASE_DURATION_HOURS, EXTRAS, MIDWEEK_DISCOUNT_PERCENT, PRICING_TIERS } from '@/constants';
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

const parseNumber = (value: number | string | undefined) => {
  if (typeof value === 'number') return value;
  if (typeof value === 'string' && value.trim().length > 0) return Number(value);
  return NaN;
};

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

    const date = payload.date?.trim();
    const time = payload.time?.trim();
    const guests = parseNumber(payload.guests);
    const extraHours = parseNumber(payload.extraHours);
    const promo = payload.promo?.trim() ?? '';

    if (!date || !time) {
      return NextResponse.json({ error: 'Missing date or time.' }, { status: 400 });
    }

    if (!Number.isFinite(guests)) {
      return NextResponse.json({ error: 'Invalid guests value.' }, { status: 400 });
    }

    if (!Number.isFinite(extraHours)) {
      return NextResponse.json({ error: 'Invalid extra hours value.' }, { status: 400 });
    }

    const tier = PRICING_TIERS.find((t) => guests >= t.min && guests <= t.max);
    if (!tier) {
      return NextResponse.json({ error: 'Guest count is out of range.' }, { status: 400 });
    }

    const extraOption = EXTRAS.find((extra) => extra.hours === extraHours);
    if (!extraOption) {
      return NextResponse.json({ error: 'Invalid extra hours selection.' }, { status: 400 });
    }

    const startDate = new Date(`${date}T${time}`);
    if (!Number.isFinite(startDate.getTime())) {
      return NextResponse.json({ error: 'Invalid booking date or time.' }, { status: 400 });
    }

    const totalDurationHours = BASE_DURATION_HOURS + extraHours;
    const endDate = new Date(startDate.getTime() + totalDurationHours * 3600000);

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { data: settings, error: settingsError } = await supabase
      .from('venue_settings')
      .select('deposit_enabled,deposit_amount,midweek_discount_percent')
      .single();

    if (settingsError) {
      console.error('Failed to load venue settings for booking draft.', settingsError);
      return NextResponse.json({ error: 'Unable to load pricing settings.' }, { status: 500 });
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
        .single();

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

    const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();

    const { data: booking, error: bookingError } = await supabase
      .from('bookings')
      .insert([
        {
          room_id: assignedRoom.id,
          room_name: assignedRoom.name,
          service_id: isNonEmptyString(payload.serviceId) ? payload.serviceId : null,
          staff_id: isNonEmptyString(payload.staffId) ? payload.staffId : null,
          start_at: startDate.toISOString(),
          end_at: endDate.toISOString(),
          status: BookingStatus.PENDING,
          payment_status: 'UNPAID',
          expires_at: expiresAt,
          guests,
          customer_name: isNonEmptyString(payload.firstName) ? payload.firstName : null,
          customer_surname: isNonEmptyString(payload.surname) ? payload.surname : null,
          customer_email: isNonEmptyString(payload.email) ? payload.email : null,
          customer_phone: isNonEmptyString(payload.phone) ? payload.phone : null,
          notes: isNonEmptyString(payload.notes) ? payload.notes : null,
          base_total: baseTotal,
          extras_hours: extraHours,
          extras_price: extrasPrice,
          discount_amount: discountAmount,
          promo_code: promoCodeToStore,
          promo_discount_amount: promoDiscountAmount,
          total_price: totalPrice,
          source: 'public',
          deposit_amount: depositAmount,
          deposit_paid: false,
          extras_total: 0,
          extras_snapshot: []
        }
      ])
      .select('*')
      .single();

    if (bookingError || !booking) {
      console.error('Failed to create booking draft.', bookingError);
      return NextResponse.json({ error: 'Unable to create booking draft.' }, { status: 500 });
    }

    return NextResponse.json({ bookingId: booking.id, booking });
  } catch (error) {
    console.error('Unexpected error creating booking draft.', error);
    return NextResponse.json({ error: 'Unable to create booking draft.' }, { status: 500 });
  }
}
