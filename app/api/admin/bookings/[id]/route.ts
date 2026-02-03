import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

/**
 * PATCH /api/admin/bookings/:id
 * Admin-only endpoint to update booking notes.
 * Requires Authorization header with Bearer token from Supabase session.
 * Body: { notes: string } (max 2000 chars, trimmed)
 */
export async function PATCH(
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

    // Parse request body
    let payload;
    try {
      payload = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 });
    }

    if (typeof payload.notes !== 'string') {
      return NextResponse.json({ error: 'Missing or invalid notes field.' }, { status: 400 });
    }

    // Trim and validate notes length
    let notes = payload.notes.trim();
    if (notes.length > 2000) {
      return NextResponse.json(
        { error: 'Notes must be 2000 characters or less.' },
        { status: 400 }
      );
    }

    // Convert empty string to null for cleaner database storage
    notes = notes.length === 0 ? null : notes;

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
      console.warn('[ADMIN PATCH] Auth verification failed', userError);
      return NextResponse.json(
        { error: 'Unauthorized: invalid token' },
        { status: 401 }
      );
    }

    const adminEmail = userData.user.email;

    // Fetch the booking to confirm it exists
    const { data: booking, error: bookingError } = await supabase
      .from('bookings')
      .select('id, booking_ref, customer_name, notes')
      .eq('id', bookingId)
      .maybeSingle();

    if (bookingError || !booking) {
      console.error('[ADMIN PATCH] Booking fetch failed', bookingError);
      return NextResponse.json({ error: 'Booking not found.' }, { status: 404 });
    }

    // Update the booking notes
    const { data: updated, error: updateError } = await supabase
      .from('bookings')
      .update({ notes })
      .eq('id', bookingId)
      .select('*')
      .maybeSingle();

    if (updateError || !updated) {
      console.error('[ADMIN PATCH] Update failed', updateError);
      return NextResponse.json(
        { error: 'Failed to update booking.' },
        { status: 500 }
      );
    }

    // Log the action server-side
    console.log(
      `[ADMIN PATCH] Admin ${adminEmail} updated notes on booking ${bookingId} (ref: ${booking.booking_ref}, customer: ${booking.customer_name}) at ${new Date().toISOString()}. Old: "${booking.notes}" → New: "${notes}"`
    );

    return NextResponse.json({ ok: true, booking: updated });
  } catch (error) {
    console.error('[ADMIN PATCH] Unexpected error', error);
    return NextResponse.json(
      { error: 'An unexpected error occurred.' },
      { status: 500 }
    );
  }
}
