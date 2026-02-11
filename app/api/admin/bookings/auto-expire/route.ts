import { NextResponse } from 'next/server';
import { ServerAdminAuthError, requireServerAdminAuth } from '@/lib/serverAdminAuth';
import { PAYMENT_STATES, shouldAutoExpirePendingBooking } from '@/lib/adminBookingOps';
import { expireStaleDrafts } from '@/lib/draftExpiry';

export async function POST(request: Request) {
  try {
    const { supabase, adminEmail } = await requireServerAdminAuth(request);
    let expiredDraftIds: string[] = [];
    try {
      expiredDraftIds = await expireStaleDrafts(supabase);
    } catch (draftError) {
      console.warn('[ADMIN AUTO-EXPIRE] Failed to expire stale drafts.', draftError);
    }
    const configuredHours = Number(process.env.PENDING_BOOKING_EXPIRY_HOURS ?? '24');
    const expiryHours = Number.isFinite(configuredHours) && configuredHours > 0 ? configuredHours : 24;

    const { data: pendingBookings, error } = await supabase
      .from('bookings')
      .select('*')
      .eq('status', 'PENDING')
      .order('created_at', { ascending: true });

    if (error) {
      return NextResponse.json({ error: 'Failed to query pending bookings.' }, { status: 500 });
    }

    const expirable = (pendingBookings ?? []).filter((booking: any) =>
      shouldAutoExpirePendingBooking({ ...booking, payment_state: booking.payment_state ?? PAYMENT_STATES.NONE }, expiryHours)
    );

    if (expirable.length === 0) {
      return NextResponse.json({ ok: true, cancelled: 0, expiredDrafts: expiredDraftIds.length, expiryHours });
    }

    const ids = expirable.map((booking: any) => booking.id);

    const { error: updateError } = await supabase
      .from('bookings')
      .update({ status: 'CANCELLED' })
      .in('id', ids);

    if (updateError) {
      return NextResponse.json({ error: 'Failed to auto-cancel pending bookings.' }, { status: 500 });
    }

    await supabase.from('booking_audit_log').insert(
      expirable.map((booking: any) => ({
        booking_id: booking.id,
        actor_email: adminEmail,
        action: 'auto_expired',
        old_values: { status: booking.status, payment_state: booking.payment_state ?? PAYMENT_STATES.NONE },
        new_values: { status: 'CANCELLED', payment_state: booking.payment_state ?? PAYMENT_STATES.NONE },
        metadata: { expiryHours, createdAt: booking.created_at }
      }))
    );

    return NextResponse.json({ ok: true, cancelled: ids.length, expiredDrafts: expiredDraftIds.length, expiryHours });
  } catch (error) {
    if (error instanceof ServerAdminAuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error('[ADMIN AUTO-EXPIRE] Unexpected error', error);
    return NextResponse.json({ error: 'Unexpected error during auto-expire run.' }, { status: 500 });
  }
}
