import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

import { BASE_DURATION_HOURS, EXTRAS, MIDWEEK_DISCOUNT_PERCENT, PRICING_TIERS } from '@/constants';
import {
    REQUIRED_BOOKING_INSERT_FIELDS,
    validateBookingInitInput
} from '@/lib/bookingValidation';
import { computeAmountDueNow } from '@/lib/paymentLogic';
import { BookingStatus } from '@/types';

type InitRequest = {
    date?: string;
    time?: string;
    guests?: number | string;
    extraHours?: number | string;
    serviceId?: string | null;
    staffId?: string | null;
    promo?: string | null;
};

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

export async function POST(request: Request) {
    try {
        if (!supabaseUrl || !supabaseServiceKey) {
            return NextResponse.json(
                { error: 'Supabase credentials are not configured.' },
                { status: 500 }
            );
        }

        const payload = (await request.json().catch(() => null)) as InitRequest | null;
        if (!payload) {
            return NextResponse.json({ error: 'Invalid request payload.' }, { status: 400 });
        }

        const validation = validateBookingInitInput(payload);
        if (!validation.isValid) {
            return NextResponse.json(
                {
                    error: 'Missing or invalid booking details.',
                    fields: validation.fieldErrors
                },
                { status: 400 }
            );
        }

        const { date, time, guests, extraHours } = validation.normalized;
        const promo = payload.promo?.trim() ?? '';
        const serviceId = payload.serviceId;
        const staffId = payload.staffId;

        // --- Availability & Pricing Logic (Reuse from create-draft) ---

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
            console.error('Invalid booking date/time for init.', { date, time, payload });
            return NextResponse.json({ error: 'Invalid booking date/time' }, { status: 400 });
        }
        const startDate = new Date(startTimestamp);
        const totalDurationHours = BASE_DURATION_HOURS + extraHours;
        const endDate = new Date(startDate.getTime() + totalDurationHours * 3600000);

        const supabase = createClient(supabaseUrl, supabaseServiceKey);

        // Fetch Venue Settings
        const { data: settings, error: settingsError } = await supabase
            .from('venue_settings')
            .select('deposit_enabled,deposit_amount,midweek_discount_percent')
            .maybeSingle();

        if (settingsError) {
            console.warn('Failed to load venue settings (init), using defaults.', settingsError);
        }

        // Pricing Calculation
        const baseTotal = tier.price;
        const extrasPrice = extraOption.price; // This is the session extension price, not "extras" items
        const dayOfWeek = new Date(`${date}T00:00:00`).getDay();
        const isMidweek = dayOfWeek >= 1 && dayOfWeek <= 3;
        const discountPercent = isMidweek
            ? Math.max(0, settings?.midweek_discount_percent ?? MIDWEEK_DISCOUNT_PERCENT)
            : 0;
        const discountAmount = Math.round((baseTotal + extrasPrice) * (discountPercent / 100));

        // Promo Code Logic
        let promoDiscountAmount = 0;
        let promoCodeToStore: string | null = promo ? promo : null;

        if (promoCodeToStore) {
            const { data: promoData, error: promoError } = await supabase
                .from('promo_codes')
                .select('code,enabled,percent_off,fixed_off,start_date,end_date,min_guests,max_uses,uses')
                .eq('code', promoCodeToStore)
                .maybeSingle();

            if (promoError || !promoData || !promoData.enabled) {
                promoCodeToStore = null;
            } else {
                const today = new Date(date);
                const promoStart = new Date(promoData.start_date);
                const promoEnd = new Date(promoData.end_date);

                // Basic promo validation
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

        // Deposit
        const depositEnabled = Boolean(settings?.deposit_enabled);
        const depositAmountSetting = settings?.deposit_amount ?? 0;
        const depositAmount = computeAmountDueNow({
            totalPrice,
            depositEnabled,
            depositAmount: depositAmountSetting
        });
        const isZeroDeposit = depositAmount <= 0;

        // Room Allocation
        const { data: rooms, error: roomsError } = await supabase
            .from('rooms')
            .select('id,name,is_active')
            .eq('is_active', true)
            .order('name');

        if (roomsError || !rooms) {
            console.error('Failed to load rooms (init).', roomsError);
            return NextResponse.json({ error: 'Unable to allocate a room.' }, { status: 500 });
        }

        // Availability Check
        const { data: overlappingBookings } = await supabase
            .from('bookings')
            .select('room_id')
            .neq('status', BookingStatus.CANCELLED)
            .neq('status', BookingStatus.FAILED) // Also ignore failed ones? 
            .lt('start_at', endDate.toISOString())
            .gt('end_at', startDate.toISOString());

        const { data: roomBlocks } = await supabase
            .from('room_blocks')
            .select('room_id')
            .lt('start_at', endDate.toISOString())
            .gt('end_at', startDate.toISOString());

        const blockedRoomIds = new Set<string>();
        (overlappingBookings ?? []).forEach((b) => b.room_id && blockedRoomIds.add(b.room_id));
        (roomBlocks ?? []).forEach((b) => b.room_id && blockedRoomIds.add(b.room_id));

        const assignedRoom = rooms.find((room) => !blockedRoomIds.has(room.id));
        if (!assignedRoom) {
            return NextResponse.json({ error: 'No rooms available for this time.' }, { status: 409 });
        }

        const expiresAt = new Date(Date.now() + 20 * 60 * 1000).toISOString(); // 20 min TTL for PENDING

        const bookingPayload = {
            room_id: assignedRoom.id,
            room_name: assignedRoom.name,
            service_id: serviceId || null,
            staff_id: staffId || null,
            booking_date: date,
            start_time: time,
            duration_hours: totalDurationHours,
            start_at: startDate.toISOString(),
            end_at: endDate.toISOString(),
            status: BookingStatus.PENDING, // Changed from DRAFT to PENDING
            expires_at: expiresAt,
            guests,
            base_total: baseTotal,
            extras_hours: extraHours,
            extras_price: extrasPrice,
            discount_amount: discountAmount,
            promo_code: promoCodeToStore,
            promo_discount_amount: promoDiscountAmount,
            total_price: totalPrice,
            source: 'public',
            deposit_amount: depositAmount,
            deposit_paid: isZeroDeposit,
            extras_total: 0,
            extras_snapshot: [], // JSONB
            // Customer details are NULL initially
            customer_name: null,
            customer_surname: null,
            customer_email: null,
            customer_phone: null,
            notes: null
        };

        console.log('booking init payload', bookingPayload);

        const { data: insertedBooking, error: bookingError } = await supabase
            .from('bookings')
            .insert([bookingPayload])
            .select('id')
            .maybeSingle();

        if (bookingError || !insertedBooking) {
            console.error('Failed to create booking (init).', bookingError);
            return NextResponse.json({ error: 'Unable to initialize booking.' }, { status: 500 });
        }

        return NextResponse.json({ bookingId: insertedBooking.id });

    } catch (error) {
        console.error('Unexpected error in booking init.', error);
        return NextResponse.json({ error: 'Unable to initialize booking.' }, { status: 500 });
    }
}
