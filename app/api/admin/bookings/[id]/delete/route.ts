import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

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
    if (!supabaseUrl || !supabaseServiceKey) {
      return NextResponse.json(
        { error: 'Supabase credentials are not configured.' },
        { status: 500 }
      );
    }

    const bookingId = params.id;
    if (!bookingId) {
      return NextResponse.json({ error: 'Missing booking id.' }, { status: 400 });
    }

    // Verify admin access via Bearer token
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'Unauthorized: missing or invalid token' },
        { status: 401 }
      );
    }

    const token = authHeader.slice(7);
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Verify the token is valid and belongs to an admin user
    const { data: userData, error: userError } = await supabase.auth.getUser(token);

    if (userError || !userData?.user?.email) {
      console.warn('[ADMIN DELETE] Auth verification failed', userError);
      return NextResponse.json(
        { error: 'Unauthorized: invalid token' },
        { status: 401 }
      );
    }

    const adminEmail = userData.user.email;

    // Fetch the booking to confirm it exists
    const { data: booking, error: bookingError } = await supabase
      .from('bookings')
      .select('id, booking_ref, customer_name')
      .eq('id', bookingId)
      .maybeSingle();

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
    console.error('[ADMIN DELETE] Unexpected error', error);
    return NextResponse.json(
      { error: 'An unexpected error occurred.' },
      { status: 500 }
    );
  }
}
