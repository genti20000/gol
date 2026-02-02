import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { validateBookingDraftInput } from '@/lib/bookingValidation'; // Reuse draft validation for full details
import { BookingStatus, BookingExtraSelection } from '@/types';

type UpdateRequest = {
    firstName?: string;
    surname?: string;
    email?: string;
    phone?: string;
    notes?: string;
    extras?: Record<string, number>; // extraId -> quantity
};

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

export async function POST(request: Request, { params }: { params: { id: string } }) {
    try {
        const bookingId = params.id;
        if (!bookingId) {
            return NextResponse.json({ error: 'Booking ID is required.' }, { status: 400 });
        }

        if (!supabaseUrl || !supabaseServiceKey) {
            return NextResponse.json({ error: 'Server configuration error.' }, { status: 500 });
        }

        const payload = (await request.json().catch(() => null)) as UpdateRequest | null;
        if (!payload) {
            return NextResponse.json({ error: 'Invalid request payload.' }, { status: 400 });
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

        if (booking.status !== BookingStatus.PENDING) {
            return NextResponse.json({ error: 'Booking status does not allow updates.' }, { status: 400 });
        }

        // 2. Prepare updates
        const updates: any = {};

        if (payload.firstName !== undefined) updates.customer_name = `${payload.firstName} ${payload.surname || ''}`.trim();
        if (payload.surname !== undefined) updates.customer_surname = payload.surname;
        if (payload.email !== undefined) updates.customer_email = payload.email;
        if (payload.phone !== undefined) updates.customer_phone = payload.phone;
        if (payload.notes !== undefined) updates.notes = payload.notes;

        // 3. Update Extras & Recalculate Price
        if (payload.extras) {
            const extrasSelection = payload.extras;
            const guests = booking.guests;

            // Fetch available extras from DB
            const { data: dbExtras, error: extrasError } = await supabase
                .from('extras')
                .select('*')
                .eq('enabled', true);

            if (extrasError || !dbExtras) {
                console.error('Failed to fetch extras definitions', extrasError);
                return NextResponse.json({ error: 'Unable to validate extras.' }, { status: 500 });
            }

            let extrasTotal = 0;
            const extrasSnapshot: BookingExtraSelection[] = [];

            for (const [extraId, qty] of Object.entries(extrasSelection)) {
                if (qty > 0) {
                    const extraDef = dbExtras.find((e: any) => e.id === extraId);
                    if (extraDef) {
                        // DB columns are snake_case usually, need to verify.
                        // Based on schema: price, pricing_mode, name, info_text

                        const price = Number(extraDef.price);
                        const pricingMode = extraDef.pricing_mode; // snake_case in DB

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
            }

            updates.extras_total = extrasTotal;
            updates.extras_snapshot = extrasSnapshot;

            // Re-calculate total_price
            const newTotalPrice = Math.max(0,
                Number(booking.base_total) +
                Number(booking.extras_price) +
                extrasTotal -
                Number(booking.discount_amount) -
                Number(booking.promo_discount_amount)
            );

            updates.total_price = newTotalPrice;
        }

        // If start_at present, compute booking_date and start_time to keep DB consistent
        if (updates.start_at) {
            try {
                const datePart = updates.start_at.split('T')[0];
                const timePart = (updates.start_at.split('T')[1] || '').substring(0,5);
                updates.booking_date = datePart;
                updates.start_time = timePart;
            } catch (err) {
                console.warn('Unable to compute booking_date from start_at for update.', err, updates.start_at);
            }
        }

        console.log('booking update payload keys', Object.keys(updates), 'computed_booking_date', updates.booking_date);

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
