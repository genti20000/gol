import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/requireAdmin';
import { parseBookingId } from '@/lib/adminBookingValidation';
import { writeAdminAuditLog } from '@/lib/adminAuditLog';

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
    const bookingIdResult = parseBookingId(params.id);
    if (!bookingIdResult.ok) {
      return NextResponse.json({ error: bookingIdResult.error }, { status: 400 });
    }
    const bookingId = bookingIdResult.value as string;

    const admin = await requireAdmin(request);
    if (admin instanceof NextResponse) return admin;
    const { supabase, adminEmail } = admin;

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

    await writeAdminAuditLog({
      adminEmail,
      action: 'BOOKING_DELETE',
      entityType: 'booking',
      entityId: bookingId,
      meta: {
        bookingRef: booking.booking_ref ?? null,
        customerName: booking.customer_name ?? null
      }
    }, supabase);

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('[ADMIN DELETE] Unexpected error', error);
    return NextResponse.json(
      { error: 'An unexpected error occurred.' },
      { status: 500 }
    );
  }
}
