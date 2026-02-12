import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/requireAdmin';
import { PAYMENT_STATES, shouldAutoExpirePendingBooking } from '@/lib/adminBookingOps';
import { expireStaleDrafts } from '@/lib/draftExpiry';
import { writeAdminAuditLog } from '@/lib/adminAuditLog';

export async function POST(request: Request) {
  try {
    const admin = await requireAdmin(request);
    if (admin instanceof NextResponse) return admin;
    const { supabase, adminEmail } = admin;
    let expiredDraftIds: string[] = [];
    try {
      expiredDraftIds = await expireStaleDrafts(supabase);
    } catch (draftError) {
      console.warn('[ADMIN AUTO-EXPIRE] Failed to expire stale drafts.', draftError);
    }
    await Promise.all(
      expiredDraftIds.map((bookingId) =>
        writeAdminAuditLog({
          adminEmail,
          action: 'BOOKING_AUTO_EXPIRE_DRAFT',
          entityType: 'booking',
          entityId: bookingId,
          meta: { trigger: 'auto-expire-route' }
        }, supabase)
      )
    );
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

    await Promise.all(
      expirable.map((booking: any) =>
        writeAdminAuditLog({
          adminEmail,
          action: 'BOOKING_AUTO_EXPIRE_PENDING',
          entityType: 'booking',
          entityId: String(booking.id),
          meta: {
            oldStatus: booking.status,
            newStatus: 'CANCELLED',
            paymentState: booking.payment_state ?? PAYMENT_STATES.NONE,
            expiryHours,
            createdAt: booking.created_at
          }
        }, supabase)
      )
    );

    return NextResponse.json({ ok: true, cancelled: ids.length, expiredDrafts: expiredDraftIds.length, expiryHours });
  } catch (error) {
    console.error('[ADMIN AUTO-EXPIRE] Unexpected error', error);
    return NextResponse.json({ error: 'Unexpected error during auto-expire run.' }, { status: 500 });
  }
}
