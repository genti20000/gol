import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

import { BASE_DURATION_HOURS, EXTRAS, EARLY_BIRD_LAST_START_TIME, EARLY_BIRD_PRICE_PER_PERSON } from '@/constants';
import {
    REQUIRED_BOOKING_INSERT_FIELDS,
    validateBookingInitInput
} from '@/lib/bookingValidation';
import { buildDraftBookingPayload } from '@/lib/bookingPayload';
import { computeBookingTotals } from '@/lib/bookingTotals';
import { computeOfferDiscounts } from '@/lib/offerUtils';
import { computeAmountDueNow } from '@/lib/paymentLogic';
import { computeEarlyBirdDiscount } from '@/lib/earlyBird';
import { expireStaleDrafts, getDraftExpiryIso } from '@/lib/draftExpiry';
import { BookingStatus } from '@/types';
import { requireAdmin } from '@/lib/requireAdmin';

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
        const admin = await requireAdmin(request);
        if (admin instanceof NextResponse) return admin;

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
        if (!serviceId) {
            return NextResponse.json({ error: "Service is required." }, { status: 400 });
        }
        const staffId = payload.staffId;

        const supabase = admin.supabase;
        try {
            await expireStaleDrafts(supabase);
        } catch (expiryError) {
            console.warn('Failed to auto-expire stale drafts during init.', expiryError);
        }

        // --- Availability & Pricing Logic (Reuse from create-draft) ---

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

        // Fetch Venue Settings
        const { data: settings, error: settingsError } = await supabase
            .from('venue_settings')
            .select('deposit_enabled,deposit_amount,midweek_discount_percent,offers')
            .maybeSingle();

        if (settingsError) {
            console.warn('Failed to load venue settings (init), using defaults.', settingsError);
        }

        // Pricing Calculation
        const baseTotal = Number(((selectedService.price_per_person_pence * guests) / 100).toFixed(2));
        const extrasPrice = extraOption.price; // This is the session extension price, not "extras" items
        const earlyBird = computeEarlyBirdDiscount({
            baseTotal,
            guests,
            startTime: time,
            targetPricePerPerson: EARLY_BIRD_PRICE_PER_PERSON,
            lastStartTime: EARLY_BIRD_LAST_START_TIME
        });
        const offers = settings?.offers ?? [];
        const offerRes = computeOfferDiscounts(offers, settings?.midweek_discount_percent, date, baseTotal, extrasPrice);
        const discountPercent = offerRes.effectiveMidweekPercent;
        const discountAmount = offerRes.midweekDiscountAmount + earlyBird.discountAmount;

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

        const subtotal = Math.max(0, baseTotal + extrasPrice - discountAmount);
        const afterPromo = Math.max(0, subtotal - promoDiscountAmount);
        const offerPercentDiscount = offerRes.offerPercent > 0 ? Math.round(afterPromo * (offerRes.offerPercent / 100)) : 0;
        const offerFixed = offerRes.offerFixed;
        const lineItems: Array<{ lineTotal: number }> = [];
        const totals = computeBookingTotals({
            baseTotal,
            extrasPrice,
            discountAmount: discountAmount + offerPercentDiscount + offerFixed,
            promoDiscountAmount,
            lineItems
        });

        // Deposit
        const depositEnabled = Boolean(settings?.deposit_enabled);
        const depositAmountSetting = settings?.deposit_amount ?? 0;
        const depositAmount = computeAmountDueNow({
            totalPrice: totals.grandTotal,
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
            .select('room_id,status,expires_at')
            .not('status', 'in', `(${BookingStatus.CANCELLED},${BookingStatus.FAILED},${BookingStatus.EXPIRED})`)
            .lt('start_at', endDate.toISOString())
            .gt('end_at', startDate.toISOString());

        const { data: roomBlocks } = await supabase
            .from('room_blocks')
            .select('room_id')
            .lt('start_at', endDate.toISOString())
            .gt('end_at', startDate.toISOString());

        const blockedRoomIds = new Set<string>();
        (overlappingBookings ?? []).forEach((b) => {
            const status = String((b as any).status || '');
            if (status === BookingStatus.DRAFT) {
                const expiresAtRaw = (b as any).expires_at;
                const expiresAtMs = Date.parse(String(expiresAtRaw || ''));
                if (Number.isFinite(expiresAtMs) && expiresAtMs <= Date.now()) {
                    return;
                }
            }
            b.room_id && blockedRoomIds.add(b.room_id);
        });
        (roomBlocks ?? []).forEach((b) => b.room_id && blockedRoomIds.add(b.room_id));

        const assignedRoom = rooms.find((room) => !blockedRoomIds.has(room.id));
        if (!assignedRoom) {
            return NextResponse.json({ error: 'No rooms available for this time.' }, { status: 409 });
        }

        const expiresAt = getDraftExpiryIso();

        const bookingPayload = buildDraftBookingPayload({
            roomId: assignedRoom.id,
            roomName: assignedRoom.name,
            serviceId: serviceId || null,
            staffId: staffId || null,
            date,
            time,
            extraHours: extraHours,
            baseDurationHours: BASE_DURATION_HOURS,
            baseTotal,
            extrasPrice,
            discountAmount,
            promoCode: promoCodeToStore,
            promoDiscountAmount,
            totalPrice: totals.grandTotal,
            source: 'public',
            depositAmount,
            depositPaid: isZeroDeposit,
            expiresAt,
            firstName: '',
            surname: '',
            email: null,
            phone: null,
            notes: null,
            specialRequests: null
        });
        // Keep init rows as DRAFT until customer details are collected in checkout.
        // DB constraints require contact details for active states.
        bookingPayload.status = BookingStatus.DRAFT;
        bookingPayload.guests = guests;
        bookingPayload.extras_total = totals.extrasTotal;
        bookingPayload.total_price = totals.grandTotal;

        console.log('booking init payload keys', Object.keys(bookingPayload), 'booking_date', bookingPayload.booking_date);

        const tryInsertDraft = async () =>
            supabase
                .from('bookings')
                .insert([bookingPayload])
                .select('id,booking_access_token')
                .maybeSingle();

        let { data: insertedBooking, error: bookingError } = await tryInsertDraft();

        if (bookingError || !insertedBooking) {
            const code = bookingError?.code;
            const message = bookingError?.message ?? '';
            const lowerMessage = message.toLowerCase();
            const isContactConstraint =
                code === '23514' &&
                lowerMessage.includes('bookings_contact_required_for_active_states_check');
            const isOverlapConstraint =
                code === '23P01' || lowerMessage.includes('bookings_no_overlap_per_room');

            console.error('Failed to create booking (init).', {
                error: { message: bookingError?.message, hint: bookingError?.hint, code: bookingError?.code },
                payloadKeys: Object.keys(bookingPayload),
                booking_date: bookingPayload.booking_date
            });
            if (isContactConstraint) {
                return NextResponse.json({ error: 'Unable to initialize booking draft. Please try another time slot.' }, { status: 409 });
            }
            if (isOverlapConstraint) {
                try {
                    await expireStaleDrafts(supabase);
                    const retryResult = await tryInsertDraft();
                    insertedBooking = retryResult.data;
                    bookingError = retryResult.error;
                } catch (retryExpiryError) {
                    console.warn('Failed to expire stale drafts before retrying init insert.', retryExpiryError);
                }

                if (!bookingError && insertedBooking) {
                    return NextResponse.json({ bookingId: insertedBooking.id, bookingToken: insertedBooking.booking_access_token });
                }
                return NextResponse.json({ error: 'That room was just booked. Please choose another time.' }, { status: 409 });
            }
            return NextResponse.json({ error: 'Unable to initialize booking.' }, { status: 500 });
        }

        return NextResponse.json({ bookingId: insertedBooking.id, bookingToken: insertedBooking.booking_access_token });

    } catch (error) {
        console.error('Unexpected error in booking init.', error);
        return NextResponse.json({ error: 'Unable to initialize booking.' }, { status: 500 });
    }
}
