import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/requireAdmin';
import { deriveStatusFromPaymentState, PAYMENT_STATES, validateNotesInput } from '@/lib/adminBookingOps';
import { parseAdminBookingAction, parseBookingId, parseCancelReason } from '@/lib/adminBookingValidation';
import { sendAdminNewBookingPush } from '@/lib/adminPush';
import { writeAdminAuditLog } from '@/lib/adminAuditLog';

export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const bookingIdResult = parseBookingId(params.id);
    if (!bookingIdResult.ok) {
      return NextResponse.json({ error: bookingIdResult.error }, { status: 400 });
    }
    const bookingId = bookingIdResult.value as string;

    let payload;
    try {
      payload = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 });
    }

    const actionResult = parseAdminBookingAction(payload?.action);
    if (!actionResult.ok) {
      return NextResponse.json({ error: actionResult.error }, { status: 400 });
    }
    const action = actionResult.value as 'update_notes' | 'mark_paid' | 'cancel' | 'send_payment_link';
    const admin = await requireAdmin(request);
    if (admin instanceof NextResponse) return admin;
    const { supabase, adminEmail } = admin;

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
      if (booking.status === 'EXPIRED' || booking.status === 'CANCELLED') {
        return NextResponse.json({ error: 'Payment link is only available for live bookings.' }, { status: 400 });
      }
      const paymentLink = `https://payments.example.com/booking/${bookingId}`;
      await writeAdminAuditLog({
        adminEmail,
        action: 'BOOKING_PAYMENT_LINK_SENT',
        entityType: 'booking',
        entityId: bookingId,
        meta: {
          bookingRef: booking.booking_ref ?? null,
          customerName: booking.customer_name ?? null,
          paymentState: booking.payment_state ?? PAYMENT_STATES.NONE,
          paymentLink
        }
      }, supabase);
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

      await writeAdminAuditLog({
        adminEmail,
        action: 'BOOKING_NOTES_UPDATE',
        entityType: 'booking',
        entityId: bookingId,
        meta: {
          bookingRef: booking.booking_ref ?? null,
          customerName: booking.customer_name ?? null,
          oldNotes: booking.notes ?? null,
          newNotes: notes
        }
      }, supabase);
      return NextResponse.json({ ok: true, booking: updated });
    }

    if (action === 'mark_paid') {
      if (booking.status === 'EXPIRED' || booking.status === 'CANCELLED') {
        return NextResponse.json({ error: 'Expired/cancelled bookings cannot be marked paid.' }, { status: 400 });
      }
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

      await writeAdminAuditLog({
        adminEmail,
        action: 'BOOKING_MARK_PAID',
        entityType: 'booking',
        entityId: bookingId,
        meta: {
          bookingRef: booking.booking_ref ?? null,
          customerName: booking.customer_name ?? null,
          oldStatus: booking.status,
          newStatus: updated.status,
          oldPaymentState: booking.payment_state ?? PAYMENT_STATES.NONE,
          newPaymentState: updated.payment_state,
          totalPrice: updated.total_price ?? booking.total_price ?? null
        }
      }, supabase);

      if (booking.status !== 'CONFIRMED' && updated.status === 'CONFIRMED') {
        await sendAdminNewBookingPush({
          id: updated.id,
          booking_ref: updated.booking_ref,
          room_name: updated.room_name,
          start_at: updated.start_at,
          customer_name: updated.customer_name
        });
      }

      return NextResponse.json({ ok: true, booking: updated });
    }

    if (action === 'cancel') {
      if (booking.status === 'EXPIRED') {
        return NextResponse.json({ error: 'Expired bookings cannot be cancelled again.' }, { status: 400 });
      }
      const reason = parseCancelReason(payload?.reason);
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

      await writeAdminAuditLog({
        adminEmail,
        action: 'BOOKING_CANCEL',
        entityType: 'booking',
        entityId: bookingId,
        meta: {
          bookingRef: booking.booking_ref ?? null,
          customerName: booking.customer_name ?? null,
          cancelReason: reason,
          oldStatus: booking.status,
          newStatus: updated.status,
          paymentState: updated.payment_state ?? booking.payment_state ?? PAYMENT_STATES.NONE
        }
      }, supabase);
      return NextResponse.json({ ok: true, booking: updated });
    }

    return NextResponse.json({ error: 'Unsupported action.' }, { status: 400 });
  } catch (error) {
    console.error('[ADMIN PATCH] Unexpected error', error);
    return NextResponse.json({ error: 'An unexpected error occurred.' }, { status: 500 });
  }
}
