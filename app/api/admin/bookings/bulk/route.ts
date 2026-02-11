import { NextResponse } from 'next/server';
import { ServerAdminAuthError, requireServerAdminAuth } from '@/lib/serverAdminAuth';
import { parseBulkBookingPayload } from '@/lib/adminBookingValidation';

export async function POST(request: Request) {
  try {
    const { supabase, adminEmail } = await requireServerAdminAuth(request);
    const payload = await request.json().catch(() => null);
    const parsed = parseBulkBookingPayload(payload);
    if (!parsed.ok) {
      return NextResponse.json({ error: parsed.error }, { status: 400 });
    }
    const { action, ids } = parsed.value as { action: 'cancel' | 'mark_paid' | 'delete'; ids: string[] };

    if (action === 'cancel') {
      const { data: updatedRows, error } = await supabase
        .from('bookings')
        .update({ status: 'CANCELLED' })
        .in('id', ids)
        .select('id');
      if (error) return NextResponse.json({ error: 'Bulk cancel failed.' }, { status: 500 });

      const updatedIds = (updatedRows ?? []).map((row: any) => String(row.id));
      const missingIds = ids.filter((id) => !updatedIds.includes(id));

      await supabase.from('booking_audit_log').insert(ids.map((bookingId) => ({
        booking_id: bookingId,
        actor_email: adminEmail,
        action: 'bulk_cancel',
        metadata: { idsCount: ids.length }
      })));

      return NextResponse.json({
        ok: true,
        updated: updatedIds.length,
        updatedIds,
        missingIds
      });
    }

    if (action === 'mark_paid') {
      const { data: updatedRows, error } = await supabase
        .from('bookings')
        .update({ payment_state: 'PAID', status: 'CONFIRMED', deposit_paid: true, confirmed_at: new Date().toISOString() })
        .in('id', ids)
        .select('id');

      if (error) return NextResponse.json({ error: 'Bulk mark paid failed.' }, { status: 500 });

      const updatedIds = (updatedRows ?? []).map((row: any) => String(row.id));
      const missingIds = ids.filter((id) => !updatedIds.includes(id));

      await supabase.from('booking_audit_log').insert(ids.map((bookingId) => ({
        booking_id: bookingId,
        actor_email: adminEmail,
        action: 'bulk_mark_paid',
        metadata: { idsCount: ids.length }
      })));

      return NextResponse.json({
        ok: true,
        updated: updatedIds.length,
        updatedIds,
        missingIds
      });
    }

    if (action === 'delete') {
      const { data: deletedRows, error } = await supabase
        .from('bookings')
        .delete()
        .in('id', ids)
        .select('id');

      if (error) return NextResponse.json({ error: 'Bulk delete failed.' }, { status: 500 });

      const deletedIds = (deletedRows ?? []).map((row: any) => String(row.id));
      const missingIds = ids.filter((id) => !deletedIds.includes(id));

      if (deletedIds.length > 0) {
        await supabase.from('booking_audit_log').insert(deletedIds.map((bookingId) => ({
          booking_id: bookingId,
          actor_email: adminEmail,
          action: 'bulk_delete',
          metadata: { idsCount: ids.length }
        })));
      }

      return NextResponse.json({
        ok: true,
        updated: deletedIds.length,
        updatedIds: deletedIds,
        missingIds
      });
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
