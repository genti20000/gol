import { NextResponse } from "next/server";
import { z } from "zod";

import { requireAdmin } from "@/lib/requireAdmin";
import { writeAdminAuditLog } from "@/lib/adminAuditLog";

const MoveSchema = z.object({
  id: z.string().min(1),
  room: z.enum(["TERRACE", "VOX", "ATTIC"]),
  startMin: z.number().int(),
  endMin: z.number().int(),
});

const OPEN_MIN = 17 * 60;

const minutesToIso = (baseDateIso: string, minutes: number) => {
  const base = new Date(baseDateIso);
  if (!Number.isFinite(base.getTime())) return null;
  const dayStart = new Date(base.getFullYear(), base.getMonth(), base.getDate(), 0, 0, 0, 0);
  const dayOffset = Math.floor(minutes / (24 * 60));
  const normalized = ((minutes % (24 * 60)) + 24 * 60) % (24 * 60);
  const hour = Math.floor(normalized / 60);
  const minute = normalized % 60;
  return new Date(dayStart.getFullYear(), dayStart.getMonth(), dayStart.getDate() + dayOffset, hour, minute, 0, 0).toISOString();
};

export async function POST(request: Request) {
  try {
    const admin = await requireAdmin(request);
    if (admin instanceof NextResponse) return admin;
    const { supabase, adminEmail } = admin;

    const parsed = MoveSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid request" }, { status: 400 });
    }

    const { id, room, startMin, endMin } = parsed.data;
    if (endMin <= startMin || startMin < OPEN_MIN) {
      return NextResponse.json({ error: "Invalid time range." }, { status: 400 });
    }

    const { data: booking, error: bookingError } = await supabase
      .from("bookings")
      .select("id,room_id,room_name,start_at,end_at,status,booking_ref,customer_name")
      .eq("id", id)
      .maybeSingle();

    if (bookingError || !booking) {
      return NextResponse.json({ error: "Booking not found." }, { status: 404 });
    }

    const { data: roomRow, error: roomError } = await supabase
      .from("rooms")
      .select("id,name")
      .ilike("name", room)
      .eq("is_active", true)
      .maybeSingle();

    if (roomError || !roomRow) {
      return NextResponse.json({ error: "Target room not found." }, { status: 400 });
    }

    const nextStartAt = minutesToIso(String(booking.start_at), startMin);
    const nextEndAt = minutesToIso(String(booking.start_at), endMin);
    if (!nextStartAt || !nextEndAt) {
      return NextResponse.json({ error: "Unable to compute move timestamps." }, { status: 400 });
    }

    const { data: overlapping } = await supabase
      .from("bookings")
      .select("id,status,start_at,end_at")
      .eq("room_id", roomRow.id)
      .neq("id", id)
      .lt("start_at", nextEndAt)
      .gt("end_at", nextStartAt);

    const hasConflict = (overlapping || []).some((item: any) =>
      ["CONFIRMED", "PENDING", "DRAFT"].includes(String(item.status || "").toUpperCase())
    );
    if (hasConflict) {
      return NextResponse.json({ error: "Conflict: overlapping booking in target room." }, { status: 409 });
    }

    const { data: updated, error: updateError } = await supabase
      .from("bookings")
      .update({
        room_id: roomRow.id,
        room_name: roomRow.name,
        start_at: nextStartAt,
        end_at: nextEndAt,
        booking_date: nextStartAt.slice(0, 10),
        start_time: nextStartAt.slice(11, 19),
      })
      .eq("id", id)
      .select("id,room_id,room_name,start_at,end_at,status,booking_ref,customer_name")
      .maybeSingle();

    if (updateError || !updated) {
      return NextResponse.json({ error: "Failed to move booking." }, { status: 500 });
    }

    await writeAdminAuditLog({
      adminEmail,
      action: "BOOKING_MOVE",
      entityType: "booking",
      entityId: id,
      meta: {
        bookingRef: booking.booking_ref ?? null,
        customerName: booking.customer_name ?? null,
        oldRoomName: booking.room_name ?? null,
        newRoomName: updated.room_name ?? null,
        oldStartAt: booking.start_at,
        oldEndAt: booking.end_at,
        newStartAt: updated.start_at,
        newEndAt: updated.end_at,
      },
    }, supabase);

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[ADMIN BOOKING MOVE] Unexpected error", error);
    return NextResponse.json({ error: "Unexpected server error." }, { status: 500 });
  }
}
