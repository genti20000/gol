import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/requireAdmin';
import { writeAdminAuditLog } from '@/lib/adminAuditLog';

type MovePayload = {
  bookingId?: string;
  roomId?: string;
  startAt?: string;
  endAt?: string;
};

const parseIso = (value?: string) => {
  const iso = String(value || '');
  const ms = Date.parse(iso);
  return Number.isFinite(ms) ? iso : null;
};

const isBlockingStatus = (status: string | null) => {
  if (!status) return false;
  return ['CONFIRMED', 'PENDING', 'DRAFT'].includes(status);
};

export async function POST(request: Request) {
  try {
    const admin = await requireAdmin(request);
    if (admin instanceof NextResponse) return admin;
    const { supabase, adminEmail } = admin;

    const payload = (await request.json().catch(() => null)) as MovePayload | null;
    if (!payload) {
      return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 });
    }

    const bookingId = String(payload.bookingId || '').trim();
    const roomId = String(payload.roomId || '').trim();
    const startAt = parseIso(payload.startAt);
    const endAt = parseIso(payload.endAt);
    if (!bookingId || !roomId || !startAt || !endAt) {
      return NextResponse.json({ error: 'Missing booking move fields.' }, { status: 400 });
    }

    const startMs = Date.parse(startAt);
    const endMs = Date.parse(endAt);
    if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || endMs <= startMs) {
      return NextResponse.json({ error: 'Invalid booking times.' }, { status: 400 });
    }

    const { data: booking, error: bookingError } = await supabase
      .from('bookings')
      .select('id,room_id,start_at,end_at,status,booking_ref,customer_name')
      .eq('id', bookingId)
      .maybeSingle();

    if (bookingError || !booking) {
      return NextResponse.json({ error: 'Booking not found.' }, { status: 404 });
    }

    const { data: overlapping } = await supabase
      .from('bookings')
      .select('id,status,start_at,end_at')
      .eq('room_id', roomId)
      .neq('id', bookingId)
      .lt('start_at', endAt)
      .gt('end_at', startAt);

    const hasConflict = (overlapping || []).some((item: any) => isBlockingStatus(item.status));
    if (hasConflict) {
      return NextResponse.json({ error: 'Target slot conflicts with an existing booking.' }, { status: 409 });
    }

    const { data: updated, error: updateError } = await supabase
      .from('bookings')
      .update({
        room_id: roomId,
        start_at: startAt,
        end_at: endAt,
        booking_date: startAt.slice(0, 10),
        start_time: startAt.slice(11, 19)
      })
      .eq('id', bookingId)
      .select('id,room_id,start_at,end_at,status,booking_ref,customer_name')
      .maybeSingle();

    if (updateError || !updated) {
      return NextResponse.json({ error: 'Unable to persist booking move.' }, { status: 500 });
    }

    await writeAdminAuditLog({
      adminEmail,
      action: 'BOOKING_MOVE',
      entityType: 'booking',
      entityId: bookingId,
      meta: {
        bookingRef: booking.booking_ref ?? null,
        customerName: booking.customer_name ?? null,
        oldRoomId: booking.room_id,
        newRoomId: updated.room_id,
        oldStartAt: booking.start_at,
        newStartAt: updated.start_at,
        oldEndAt: booking.end_at,
        newEndAt: updated.end_at
      }
    }, supabase);

    return NextResponse.json({ ok: true, booking: updated });
  } catch (error) {
    console.error('[ADMIN BOOKING MOVE] Unexpected error', error);
    return NextResponse.json({ error: 'Unexpected server error.' }, { status: 500 });
  }
}

