import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { BookingStatus } from '@/types';
import { validateBookingDraftInput } from '@/lib/bookingValidation';

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

        const supabase = createClient(supabaseUrl, supabaseServiceKey);

        // 1. Fetch booking
        const { data: booking, error: fetchError } = await supabase
            .from('bookings')
            .select('*')
            .eq('id', bookingId)
            .maybeSingle();

        if (fetchError || !booking) {
            return NextResponse.json({ error: 'Booking not found.' }, { status: 404 });
        }

        if (booking.status !== BookingStatus.PENDING) {
            if (booking.status === BookingStatus.CONFIRMED) {
                return NextResponse.json({ message: 'Booking already confirmed.', booking });
            }
            return NextResponse.json({ error: `Booking cannot be confirmed (Status: ${booking.status})` }, { status: 400 });
        }

        // 2. Final Validation
        // Ensure all required fields are present before confirming
        // We map the DB fields back to the input format for validation
        const inputForValidation = {
            date: booking.start_at.split('T')[0],
            time: booking.start_at.split('T')[1].substring(0, 5),
            guests: booking.guests,
            extraHours: booking.extras_hours,
            firstName: booking.customer_name ? booking.customer_name.split(' ')[0] : '', // approximate
            surname: booking.customer_surname,
            email: booking.customer_email
        };

        // Note: We use the strict validator here
        const validation = validateBookingDraftInput(inputForValidation);
        if (!validation.isValid) {
            return NextResponse.json({
                error: 'Cannot confirm: Missing details.',
                fields: validation.fieldErrors
            }, { status: 400 });
        }

        // 3. Confirm
        const confirmPayload = { status: BookingStatus.CONFIRMED, confirmed_at: new Date().toISOString() };
        console.log('confirming booking', { bookingId, payloadKeys: Object.keys(confirmPayload), computed_booking_date: booking.booking_date ?? booking.start_at?.split('T')[0] });
        const { data: confirmedBooking, error: confirmError } = await supabase
            .from('bookings')
            .update(confirmPayload)
            .eq('id', bookingId)
            .select('*')
            .single();

        if (confirmError) {
            console.error('Failed to confirm booking.', confirmError);
            return NextResponse.json({ error: 'Unable to confirm booking.' }, { status: 500 });
        }

        // TODO: Send Confirmation Email (existing logic usually handles this via triggers or another call)

        return NextResponse.json({ success: true, booking: confirmedBooking });

    } catch (error) {
        console.error('Unexpected error in confirmation.', error);
        return NextResponse.json({ error: 'Unable to confirm booking.' }, { status: 500 });
    }
}
