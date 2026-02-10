import { NextResponse } from 'next/server';
import { ServerAdminAuthError, requireServerAdminAuth } from '@/lib/serverAdminAuth';

type BookingForDeleteLog = {
  id: string;
  booking_ref: string;
  customer_name: string;
};

/**
 * DELETE /api/admin/bookings/:id
 * Admin-only endpoint to delete a booking.
 * Requires Authorization header with Bearer token from Supabase session.
 */
export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const bookingId = params.id;
    if (!bookingId) {
      return NextResponse.json({ error: 'Missing booking id.' }, { status: 400 });
    }

    const { supabase, adminEmail } = await requireServerAdminAuth(request);

    // Fetch the booking to confirm it exists
    const { data: booking, error: bookingError } = await supabase
      .from('bookings')
      .select('id, booking_ref, customer_name')
      .eq('id', bookingId)
      .maybeSingle<BookingForDeleteLog>();

    if (bookingError || !booking) {
      console.error('[ADMIN DELETE] Booking fetch failed', bookingError);
      return NextResponse.json({ error: 'Booking not found.' }, { status: 404 });
    }

    // Delete the booking
    const { error: deleteError } = await supabase
      .from('bookings')
      .delete()
      .eq('id', bookingId);

    if (deleteError) {
      console.error('[ADMIN DELETE] Deletion failed', deleteError);
      return NextResponse.json(
        { error: 'Failed to delete booking.' },
        { status: 500 }
      );
    }

    // Log the action server-side
    console.log(`[ADMIN DELETE] Admin ${adminEmail} deleted booking ${bookingId} (ref: ${booking.booking_ref}, customer: ${booking.customer_name}) at ${new Date().toISOString()}`);

    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof ServerAdminAuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    console.error('[ADMIN DELETE] Unexpected error', error);
    return NextResponse.json(
      { error: 'An unexpected error occurred.' },
      { status: 500 }
    );
  }
}
