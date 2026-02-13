import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/requireAdmin';
import { parseBulkBookingPayload } from '@/lib/adminBookingValidation';
import { sendAdminNewBookingPush } from '@/lib/adminPush';
import { writeAdminAuditLog } from '@/lib/adminAuditLog';

export async function POST(request: Request) {
  try {
    const admin = await requireAdmin(request);
    if (admin instanceof NextResponse) return admin;
    const { supabase, adminEmail } = admin;
    const payload = await request.json().catch(() => null);
    const parsed = parseBulkBookingPayload(payload);
    if (!parsed.ok) {
      return NextResponse.json({ error: parsed.error }, { status: 400 });
    }
    const { action, ids, includeExpired } = parsed.value as { action: 'cancel' | 'mark_paid' | 'delete'; ids: string[]; includeExpired?: boolean };

    if (action === 'cancel') {
      let updateQuery = supabase
        .from('bookings')
        .update({ status: 'CANCELLED' })
        .in('id', ids)
        .in('status', ['CONFIRMED', 'PENDING']);
      if (includeExpired) {
        updateQuery = supabase
          .from('bookings')
          .update({ status: 'CANCELLED' })
          .in('id', ids)
          .in('status', ['CONFIRMED', 'PENDING', 'EXPIRED']);
      }
      const { data: updatedRows, error } = await updateQuery.select('id');
      if (error) return NextResponse.json({ error: 'Bulk cancel failed.' }, { status: 500 });

      const updatedIds = (updatedRows ?? []).map((row: any) => String(row.id));
      const missingIds = ids.filter((id) => !updatedIds.includes(id));

      await Promise.all(updatedIds.map((bookingId) =>
        writeAdminAuditLog({
          adminEmail,
          action: 'BOOKING_BULK_CANCEL',
          entityType: 'booking',
          entityId: bookingId,
          meta: { idsCount: ids.length }
        }, supabase)
      ));

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
        .in('status', ['CONFIRMED', 'PENDING'])
        .select('id,booking_ref,room_name,start_at,customer_name');

      if (error) return NextResponse.json({ error: 'Bulk mark paid failed.' }, { status: 500 });

      const updatedIds = (updatedRows ?? []).map((row: any) => String(row.id));
      const missingIds = ids.filter((id) => !updatedIds.includes(id));

      await Promise.all(updatedIds.map((bookingId) =>
        writeAdminAuditLog({
          adminEmail,
          action: 'BOOKING_BULK_MARK_PAID',
          entityType: 'booking',
          entityId: bookingId,
          meta: { idsCount: ids.length }
        }, supabase)
      ));

      await Promise.all(
        (updatedRows ?? []).map((booking: any) =>
          sendAdminNewBookingPush({
            id: booking.id,
            booking_ref: booking.booking_ref,
            room_name: booking.room_name,
            start_at: booking.start_at,
            customer_name: booking.customer_name
          })
        )
      );

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
        await Promise.all(deletedIds.map((bookingId) =>
          writeAdminAuditLog({
            adminEmail,
            action: 'BOOKING_BULK_DELETE',
            entityType: 'booking',
            entityId: bookingId,
            meta: { idsCount: ids.length }
          }, supabase)
        ));
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
    console.error('[ADMIN BULK BOOKINGS] Unexpected error', error);
    return NextResponse.json({ error: 'Unexpected error.' }, { status: 500 });
  }
}
