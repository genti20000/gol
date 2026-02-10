import { NextResponse } from 'next/server';
import { ServerAdminAuthError, requireServerAdminAuth } from '@/lib/serverAdminAuth';
import { deriveStatusFromPaymentState, PAYMENT_STATES, validateNotesInput } from '@/lib/adminBookingOps';

type BookingAction = 'update_notes' | 'mark_paid' | 'cancel' | 'send_payment_link';

const upsertAuditLog = async (
  supabase: any,
  bookingId: string,
  actorEmail: string,
  action: string,
  oldValues: Record<string, unknown>,
  newValues: Record<string, unknown>,
  metadata?: Record<string, unknown>
) => {
  await supabase.from('booking_audit_log').insert({
    booking_id: bookingId,
    actor_email: actorEmail,
    action,
    old_values: oldValues,
    new_values: newValues,
    metadata: metadata ?? null
  });
};

export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const bookingId = params.id;
    if (!bookingId) {
      return NextResponse.json({ error: 'Missing booking id.' }, { status: 400 });
    }

    let payload;
    try {
      payload = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 });
    }

    const action = (payload?.action ?? 'update_notes') as BookingAction;
    const { supabase, adminEmail } = await requireServerAdminAuth(request);

    const { data: booking, error: bookingError } = await supabase
      .from('bookings')
      .select('*')
      .eq('id', bookingId)
      .maybeSingle();

    if (bookingError || !booking) {
      console.error('[ADMIN PATCH] Booking fetch failed', bookingError);
      return NextResponse.json({ error: 'Booking not found.' }, { status: 404 });
    }

    if (action === 'send_payment_link') {
      const paymentLink = `https://payments.example.com/booking/${bookingId}`;
      await upsertAuditLog(
        supabase,
        bookingId,
        adminEmail,
        'send_payment_link',
        { payment_state: booking.payment_state ?? PAYMENT_STATES.NONE },
        { payment_state: booking.payment_state ?? PAYMENT_STATES.NONE },
        { paymentLink, todo: 'Integrate Stripe/SumUp payment-link generation.' }
      );
      return NextResponse.json({ ok: true, paymentLink, todo: 'Integrate Stripe/SumUp' });
    }

    if (action === 'update_notes') {
      const noteResult = validateNotesInput(payload?.notes);
      if (!noteResult.ok) {
        return NextResponse.json({ error: noteResult.error }, { status: 400 });
      }

      const notes = noteResult.normalized;
      const { data: updated, error: updateError } = await supabase
        .from('bookings')
        .update({ notes })
        .eq('id', bookingId)
        .select('*')
        .maybeSingle();

      if (updateError || !updated) {
        console.error('[ADMIN PATCH] Update failed', updateError);
        return NextResponse.json({ error: 'Failed to update booking.' }, { status: 500 });
      }

      await upsertAuditLog(supabase, bookingId, adminEmail, 'update_notes', { notes: booking.notes ?? null }, { notes });
      return NextResponse.json({ ok: true, booking: updated });
    }

    if (action === 'mark_paid') {
      if (!String(booking.customer_name ?? '').trim() || !String(booking.customer_email ?? '').trim()) {
        return NextResponse.json({ error: 'Missing customer details.' }, { status: 400 });
      }

      const paymentState = PAYMENT_STATES.PAID;
      const status = deriveStatusFromPaymentState({ ...booking, payment_state: paymentState });
      const { data: updated, error: updateError } = await supabase
        .from('bookings')
        .update({
          payment_state: paymentState,
          status,
          deposit_paid: true,
          amount_paid: booking.total_price,
          confirmed_at: status === 'CONFIRMED' ? new Date().toISOString() : booking.confirmed_at
        })
        .eq('id', bookingId)
        .select('*')
        .maybeSingle();

      if (updateError || !updated) {
        console.error('[ADMIN PATCH] Mark paid failed', updateError);
        return NextResponse.json({ error: 'Failed to mark booking paid.' }, { status: 500 });
      }

      await upsertAuditLog(
        supabase,
        bookingId,
        adminEmail,
        'mark_paid',
        { status: booking.status, payment_state: booking.payment_state ?? PAYMENT_STATES.NONE },
        { status: updated.status, payment_state: updated.payment_state }
      );

      return NextResponse.json({ ok: true, booking: updated });
    }

    if (action === 'cancel') {
      const reason = payload?.reason === 'auto_expired' ? 'auto_expired' : 'admin_cancelled';
      const { data: updated, error: updateError } = await supabase
        .from('bookings')
        .update({ status: 'CANCELLED' })
        .eq('id', bookingId)
        .select('*')
        .maybeSingle();

      if (updateError || !updated) {
        console.error('[ADMIN PATCH] Cancel failed', updateError);
        return NextResponse.json({ error: 'Failed to cancel booking.' }, { status: 500 });
      }

      await upsertAuditLog(
        supabase,
        bookingId,
        adminEmail,
        reason,
        { status: booking.status, payment_state: booking.payment_state ?? PAYMENT_STATES.NONE },
        { status: updated.status, payment_state: updated.payment_state }
      );
      return NextResponse.json({ ok: true, booking: updated });
    }

    return NextResponse.json({ error: 'Unsupported action.' }, { status: 400 });
  } catch (error) {
    if (error instanceof ServerAdminAuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    console.error('[ADMIN PATCH] Unexpected error', error);
    return NextResponse.json({ error: 'An unexpected error occurred.' }, { status: 500 });
  }
}
