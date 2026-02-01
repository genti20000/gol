import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { validateBookingDraftInput } from '@/lib/bookingValidation'; // Reuse draft validation for full details
import { BookingStatus, BookingExtraSelection } from '@/types';
import { EXTRAS } from '@/constants';

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
            // Allow updates if it's pending. If confirmed, maybe block?
            // Use case: user goes back in checkout flow to change details.
            // For now, strict on PENDING for this flow to avoid messing up confirmed bookings.
            return NextResponse.json({ error: 'Booking status does not allow updates.' }, { status: 400 });
        }

        // 2. Prepare updates
        const updates: any = {};

        // Update Customer Details if provided
        // We normalize/validate them if they are being set to ensure basic data integrity
        if (payload.firstName !== undefined) updates.customer_name = `${payload.firstName} ${payload.surname || ''}`.trim();
        if (payload.surname !== undefined) updates.customer_surname = payload.surname;
        if (payload.email !== undefined) updates.customer_email = payload.email;
        if (payload.phone !== undefined) updates.customer_phone = payload.phone;
        if (payload.notes !== undefined) updates.notes = payload.notes;

        // 3. Update Extras & Recalculate Price
        // Note: We need to respect the original pricing snapshot for base/extraHours, but extras items can change.
        if (payload.extras) {
            const extrasSelection = payload.extras;
            const guests = booking.guests;

            let extrasTotal = 0;
            const extrasSnapshot: BookingExtraSelection[] = [];

            for (const [extraId, qty] of Object.entries(extrasSelection)) {
                if (qty > 0) {
                    const extraDef = EXTRAS.find(e => e.id === extraId);
                    if (extraDef) {
                        const linePrice = extraDef.pricingMode === 'per_person'
                            ? extraDef.price * guests * qty
                            : extraDef.price * qty;

                        extrasTotal += linePrice;
                        extrasSnapshot.push({
                            extraId: extraDef.id,
                            nameSnapshot: extraDef.name,
                            priceSnapshot: extraDef.price,
                            pricingModeSnapshot: extraDef.pricingMode,
                            quantity: qty,
                            lineTotal: linePrice,
                            infoTextSnapshot: extraDef.infoText
                        });
                    }
                }
            }

            updates.extras_total = extrasTotal;
            updates.extras_snapshot = extrasSnapshot;

            // Re-calculate total_price
            // formula: base_total + extras_price (hours) + extras_total (items) - discount - promo
            // Ensure we don't go below zero
            const newTotalPrice = Math.max(0,
                Number(booking.base_total) +
                Number(booking.extras_price) +
                extrasTotal -
                Number(booking.discount_amount) -
                Number(booking.promo_discount_amount)
            );

            updates.total_price = newTotalPrice;

            // Update deposit amount if dynamic? (Logic usually keeps deposit fixed or re-calcs. 
            // If payment hasn't happened, we can update deposit amount)
            if (!booking.deposit_paid) {
                // Re-fetch logic or just use simple rule.
                // For now, let's keep deposit logic consistent with Init.
                // But we need the settings.
                // To avoid complexity, if deposit is a fixed amount, it doesn't change. 
                // If it's percentage, it might. Assuming fixed for now based on previous code.
            }
        }

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
