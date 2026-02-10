import { NextResponse } from 'next/server';
import { ServerAdminAuthError, requireServerAdminAuth } from '@/lib/serverAdminAuth';

export async function POST(request: Request) {
  try {
    const { supabase, adminEmail } = await requireServerAdminAuth(request);
    const payload = await request.json().catch(() => null);
    const action = payload?.action;
    const ids: string[] = Array.isArray(payload?.ids) ? payload.ids.filter(Boolean) : [];

    if (!action || ids.length === 0) {
      return NextResponse.json({ error: 'Action and booking ids are required.' }, { status: 400 });
    }

    if (action === 'cancel') {
      const { error } = await supabase.from('bookings').update({ status: 'CANCELLED' }).in('id', ids);
      if (error) return NextResponse.json({ error: 'Bulk cancel failed.' }, { status: 500 });

      await supabase.from('booking_audit_log').insert(ids.map((bookingId) => ({
        booking_id: bookingId,
        actor_email: adminEmail,
        action: 'bulk_cancel',
        metadata: { idsCount: ids.length }
      })));

      return NextResponse.json({ ok: true, updated: ids.length });
    }

    if (action === 'mark_paid') {
      const { error } = await supabase
        .from('bookings')
        .update({ payment_state: 'PAID', status: 'CONFIRMED', deposit_paid: true, confirmed_at: new Date().toISOString() })
        .in('id', ids);

      if (error) return NextResponse.json({ error: 'Bulk mark paid failed.' }, { status: 500 });

      await supabase.from('booking_audit_log').insert(ids.map((bookingId) => ({
        booking_id: bookingId,
        actor_email: adminEmail,
        action: 'bulk_mark_paid',
        metadata: { idsCount: ids.length }
      })));

      return NextResponse.json({ ok: true, updated: ids.length });
    }

    return NextResponse.json({ error: 'Unsupported bulk action.' }, { status: 400 });
  } catch (error) {
    if (error instanceof ServerAdminAuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error('[ADMIN BULK BOOKINGS] Unexpected error', error);
    return NextResponse.json({ error: 'Unexpected error.' }, { status: 500 });
  }
}
