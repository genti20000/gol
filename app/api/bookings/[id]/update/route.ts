import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { BookingStatus, BookingExtraSelection } from '@/types';
import { isBookingTokenValid } from '@/lib/bookingAccessToken';
import { validateBookingDraftInput } from '@/lib/bookingValidation';
import { getExtraMaxQuantity, validateBookingUpdateInput } from '@/lib/bookingUpdateValidation';
import { computeBookingTotals } from '@/lib/bookingTotals';
import { parseBookingId } from '@/lib/adminBookingValidation';
import { isDraftExpired } from '@/lib/draftExpiry';

type UpdateRequest = {
    bookingToken?: string;
    token?: string;
    firstName?: string;
    surname?: string;
    email?: string;
    phone?: string;
    notes?: string;
    specialRequests?: string;
    extras?: Record<string, number>; // extraId -> quantity
};

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const VALIDATION_STUB = {
    date: '2000-01-01',
    time: '10:00',
    guests: 1,
    extraHours: 0
};

export async function POST(request: Request, { params }: { params: { id: string } }) {
    try {
        const bookingIdResult = parseBookingId(params.id);
        if (!bookingIdResult.ok) {
            return NextResponse.json({ error: bookingIdResult.error }, { status: 400 });
        }
        const bookingId = bookingIdResult.value as string;

        if (!supabaseUrl || !supabaseServiceKey) {
            return NextResponse.json({ error: 'Server configuration error.' }, { status: 500 });
        }

        const rawPayload = (await request.json().catch(() => null)) as unknown;
        const payloadValidation = validateBookingUpdateInput(rawPayload);
        if (!payloadValidation.isValid) {
            return NextResponse.json(
                {
                    error: 'Invalid request payload.',
                    fields: payloadValidation.fieldErrors
                },
                { status: 400 }
            );
        }

        const payload = payloadValidation.normalized as UpdateRequest;

        // Reuse draft validation logic for shared contact rules where applicable.
        if (payload.firstName !== undefined || payload.surname !== undefined || payload.email !== undefined) {
            const draftValidation = validateBookingDraftInput({
                ...VALIDATION_STUB,
                firstName: payload.firstName ?? 'N/A',
                surname: payload.surname ?? 'N/A',
                email: payload.email ?? 'placeholder@example.com'
            });

            const contactErrors: Record<string, string> = {};
            if (payload.firstName !== undefined && draftValidation.fieldErrors.firstName) {
                contactErrors.firstName = draftValidation.fieldErrors.firstName;
            }
            if (payload.surname !== undefined && draftValidation.fieldErrors.surname) {
                contactErrors.surname = draftValidation.fieldErrors.surname;
            }
            if (payload.email !== undefined && draftValidation.fieldErrors.email) {
                contactErrors.email = draftValidation.fieldErrors.email;
            }

            if (Object.keys(contactErrors).length > 0) {
                return NextResponse.json(
                    {
                        error: 'Invalid contact details.',
                        fields: contactErrors
                    },
                    { status: 400 }
                );
            }
        }

        const bookingToken = ((payload.bookingToken || payload.token || '').trim() || (new URL(request.url).searchParams.get('bookingToken') || '').trim() || (request.headers.get('x-booking-token') || '').trim());
        if (!bookingToken) {
            return NextResponse.json({ error: 'Access denied.' }, { status: 403 });
        }

        const supabase = createClient(supabaseUrl, supabaseServiceKey);

        // 1. Fetch current booking
        const { data: booking, error: fetchError } = await supabase
            .from('bookings')
            .select('*')
            .eq('id', bookingId)
            .maybeSingle();

        if (fetchError || !booking) {
            return NextResponse.json({ error: 'Booking not found.' }, { status: 404 });
        }

        if (!isBookingTokenValid(bookingToken, booking.booking_access_token)) {
            return NextResponse.json({ error: 'Access denied.' }, { status: 403 });
        }

        if (isDraftExpired(booking)) {
            await supabase
                .from('bookings')
                .update({ status: BookingStatus.EXPIRED })
                .eq('id', bookingId)
                .eq('status', BookingStatus.DRAFT);
            return NextResponse.json({ error: 'Booking session expired. Please choose another slot.' }, { status: 410 });
        }

        if (booking.status !== BookingStatus.PENDING && booking.status !== BookingStatus.DRAFT) {
            return NextResponse.json({ error: 'Booking status does not allow updates.' }, { status: 400 });
        }

        // 2. Prepare updates
        const updates: Record<string, string | number | null | BookingExtraSelection[]> = {};

        if (payload.firstName !== undefined) updates.customer_name = `${payload.firstName ?? ''} ${payload.surname ?? ''}`.trim();
        if (payload.surname !== undefined) updates.customer_surname = payload.surname;
        if (payload.email !== undefined) updates.customer_email = payload.email;
        if (payload.phone !== undefined) updates.customer_phone = payload.phone;
        if (payload.notes !== undefined) updates.notes = payload.notes;
        if (payload.specialRequests !== undefined) updates.special_requests = payload.specialRequests;

        // 3. Update Extras & Recalculate Price
        if (payload.extras) {
            const extrasSelection: Record<string, number> = payload.extras;
            const guests = Number(booking.guests) || 0;

            // Fetch available extras from DB
            const { data: dbExtras, error: extrasError } = await supabase
                .from('extras')
                .select('*')
                .eq('enabled', true);

            if (extrasError || !dbExtras) {
                console.error('Failed to fetch extras definitions', extrasError);
                return NextResponse.json({ error: 'Unable to validate extras.' }, { status: 500 });
            }

            const extrasById = new Map<string, any>(dbExtras.map((extra: any) => [extra.id, extra]));
            const unknownIds = Object.keys(extrasSelection).filter((extraId) => !extrasById.has(extraId));
            if (unknownIds.length > 0) {
                return NextResponse.json(
                    {
                        error: 'Invalid extras selection.',
                        fields: {
                            extras: `Unknown extras: ${unknownIds.join(', ')}`
                        }
                    },
                    { status: 400 }
                );
            }

            let extrasTotal = 0;
            const extrasSnapshot: BookingExtraSelection[] = [];

            for (const [extraId, qty] of Object.entries(extrasSelection)) {
                const extraDef = extrasById.get(extraId);
                if (!extraDef) {
                    continue;
                }

                const maxQuantity = getExtraMaxQuantity(extraDef);
                if (maxQuantity !== null && qty > maxQuantity) {
                    return NextResponse.json(
                        {
                            error: 'Invalid extras selection.',
                            fields: {
                                [`extras.${extraId}`]: `Quantity exceeds allowed maximum (${maxQuantity}).`
                            }
                        },
                        { status: 400 }
                    );
                }

                if (qty > 0) {
                    const price = Number(extraDef.price);
                    const pricingMode = extraDef.pricing_mode;

                    const linePrice = pricingMode === 'per_person'
                        ? price * guests * qty
                        : price * qty;

                    extrasTotal += linePrice;
                    extrasSnapshot.push({
                        extraId: extraDef.id,
                        nameSnapshot: extraDef.name,
                        priceSnapshot: price,
                        pricingModeSnapshot: pricingMode as 'flat' | 'per_person',
                        quantity: qty,
                        lineTotal: linePrice,
                        infoTextSnapshot: extraDef.info_text
                    });
                }
            }

            updates.extras_total = extrasTotal;
            updates.extras_snapshot = extrasSnapshot;

            const totals = computeBookingTotals({
                baseTotal: Number(booking.base_total),
                extrasPrice: Number(booking.extras_price),
                discountAmount: Number(booking.discount_amount),
                promoDiscountAmount: Number(booking.promo_discount_amount),
                lineItems: extrasSnapshot as any[]
            });

            updates.total_price = totals.grandTotal;
        }

        // If start_at present, compute booking_date and start_time to keep DB consistent
        if ((updates as any).start_at) {
            try {
                const startAt = String((updates as any).start_at);
                const datePart = startAt.split('T')[0];
                const timePart = (startAt.split('T')[1] || '').substring(0, 5);
                updates.booking_date = datePart;
                updates.start_time = timePart;
            } catch (err) {
                console.warn('Unable to compute booking_date from start_at for update.', err, (updates as any).start_at);
            }
        }

        console.log('booking update payload keys', Object.keys(updates), 'computed_booking_date', (updates as any).booking_date);

        // 4. Perform Update
        const { data: updatedBooking, error: updateError } = await supabase
            .from('bookings')
            .update(updates)
            .eq('id', bookingId)
            .select('*')
            .single();

        if (updateError) {
            console.error('Failed to update booking.', updateError);
            return NextResponse.json({ error: 'Unable to update booking.' }, { status: 500 });
        }

        return NextResponse.json({ booking: updatedBooking });

    } catch (error) {
        console.error('Unexpected error in booking update.', error);
        return NextResponse.json({ error: 'Unable to update booking.' }, { status: 500 });
    }
}
