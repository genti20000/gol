"use client";

import {
  DndContext,
  DragOverlay,
  PointerSensor,
  TouchSensor,
  closestCenter,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { toast } from "sonner";

import { BookingCard } from "@/components/BookingCard";
import { hasConflict, type Booking } from "@/lib/calendar/conflicts";
import type { Room } from "@/lib/calendar/time";
import { buildSlots, clampToGrid, minutesToLabel, OPEN_MIN, ROOMS, SLOT_MIN } from "@/lib/calendar/time";
import { debounce } from "@/lib/debounce";
import { supabase } from "@/lib/supabase";

type SlotId = `slot:${Room}:${number}`;
type DragId = `booking:${string}`;

function parseSlotId(id: string) {
  const [, room, start] = id.split(":");
  return { room: room as Room, startMin: Number(start) };
}

function slotId(room: Room, startMin: number): SlotId {
  return `slot:${room}:${startMin}`;
}

function dragId(id: string): DragId {
  return `booking:${id}`;
}

function RoomSlotRow({
  id,
  label,
  isOver,
  status,
}: {
  id: SlotId;
  label: string;
  isOver: boolean;
  status: "valid" | "conflict" | "occupied" | "neutral";
}) {
  const { setNodeRef, isOver: droppableOver } = useDroppable({ id });
  const over = isOver || droppableOver;

  const border =
    status === "valid" ? "border-emerald-500/70" :
      status === "conflict" ? "border-red-500/70" :
        "border-white/5";

  const bg =
    status === "valid" ? "bg-emerald-500/10" :
      status === "conflict" ? "bg-red-500/10" :
        status === "occupied" ? "bg-white/0 opacity-60" :
          "bg-white/0";

  const overRing = over ? "ring-2 ring-white/10" : "";

  return (
    <div ref={setNodeRef} className="flex items-stretch border-b border-white/5">
      <div className="w-16 shrink-0 border-r border-white/5 px-2 py-3 text-xs text-zinc-400">
        {label}
      </div>
      <div className={["relative flex-1 h-16 border border-transparent transition-colors", border, bg, overRing].join(" ")} />
    </div>
  );
}

function DraggableBooking({
  booking,
  isDragging,
}: {
  booking: Booking;
  isDragging: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging: dndDragging } = useDraggable({
    id: dragId(booking.id),
  });

  return (
    <div
      ref={setNodeRef}
      style={{
        transform: transform ? `translate3d(${transform.x}px, ${transform.y}px, 0)` : undefined,
      }}
      className="h-full"
    >
      <BookingCard booking={booking} isDragging={isDragging || dndDragging} dragHandleProps={{ ...listeners, ...attributes }} />
    </div>
  );
}

export function AdminBookingCalendar({
  initialBookings,
}: {
  initialBookings: Booking[];
}) {
  const slots = useMemo(() => buildSlots(), []);
  const [bookings, setBookings] = useState<Booking[]>(initialBookings);
  const [activeBookingId, setActiveBookingId] = useState<string | null>(null);
  const [overSlot, setOverSlot] = useState<{ room: Room; startMin: number } | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 220, tolerance: 8 } }),
  );

  const activeBooking = useMemo(
    () => bookings.find((b) => b.id === activeBookingId) ?? null,
    [activeBookingId, bookings]
  );

  const debouncedPersist = useMemo(
    () =>
      debounce(async (payload: { id: string; room: Room; startMin: number; endMin: number }) => {
        const { data } = await supabase.auth.getSession();
        const token = data.session?.access_token;
        if (!token) {
          toast.error("Admin session expired.");
          return;
        }

        const response = await fetch("/api/admin/bookings/move", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(payload),
        });

        if (!response.ok) {
          const msg = (await response.json().catch(() => null))?.error ?? "Failed to update booking";
          toast.error(msg);
        }
      }, 500),
    []
  );

  const candidateStatus = useMemo(() => {
    if (!activeBooking || !overSlot) return null;
    const dur = activeBooking.endMin - activeBooking.startMin;
    const candidate = {
      id: activeBooking.id,
      room: overSlot.room,
      startMin: overSlot.startMin,
      endMin: overSlot.startMin + dur,
    };
    return { candidate, conflict: hasConflict(bookings, candidate) };
  }, [activeBooking, overSlot, bookings]);

  const haptics = () => {
    if (typeof navigator !== "undefined" && "vibrate" in navigator) {
      navigator.vibrate(10);
    }
  };

  const topForStart = (startMin: number) => Math.round((startMin - OPEN_MIN) / SLOT_MIN) * 64;
  const heightForDuration = (mins: number) => Math.max(1, Math.round(mins / SLOT_MIN)) * 64 - 8;

  const onDragStart = (e: DragStartEvent) => {
    const id = String(e.active.id);
    if (!id.startsWith("booking:")) return;
    setActiveBookingId(id.replace("booking:", ""));
    haptics();
  };

  const onDragOver = (e: DragOverEvent) => {
    const id = e.over?.id ? String(e.over.id) : "";
    if (!id.startsWith("slot:")) {
      setOverSlot(null);
      return;
    }
    setOverSlot(parseSlotId(id));
  };

  const onDragEnd = (e: DragEndEvent) => {
    const activeId = String(e.active.id);
    const overId = e.over?.id ? String(e.over.id) : "";
    setActiveBookingId(null);

    if (!activeId.startsWith("booking:") || !overId.startsWith("slot:")) {
      setOverSlot(null);
      return;
    }

    const booking = bookings.find((b) => b.id === activeId.replace("booking:", ""));
    if (!booking) return;

    const parsed = parseSlotId(overId);
    const snappedStart = clampToGrid(parsed.startMin);
    const dur = booking.endMin - booking.startMin;
    const candidate = { id: booking.id, room: parsed.room, startMin: snappedStart, endMin: snappedStart + dur };

    if (hasConflict(bookings, candidate)) {
      toast.error("Conflict: overlapping booking");
      haptics();
      setOverSlot(null);
      return;
    }

    setBookings((prev) =>
      prev.map((b) =>
        b.id === booking.id
          ? { ...b, room: candidate.room, startMin: candidate.startMin, endMin: candidate.endMin }
          : b
      )
    );

    toast.success(`Moved booking to ${minutesToLabel(candidate.startMin)} in ${candidate.room}`);
    debouncedPersist(candidate);
    haptics();
    setOverSlot(null);
  };

  const bookingsByRoom = useMemo(() => {
    const map = new Map<Room, Booking[]>();
    for (const room of ROOMS) map.set(room, []);
    for (const booking of bookings) map.get(booking.room)?.push(booking);
    for (const room of ROOMS) map.get(room)?.sort((a, b) => a.startMin - b.startMin);
    return map;
  }, [bookings]);

  const getSlotStatus = (room: Room, startMin: number): "valid" | "conflict" | "occupied" | "neutral" => {
    if (candidateStatus?.candidate && candidateStatus.candidate.room === room && candidateStatus.candidate.startMin === startMin) {
      return candidateStatus.conflict ? "conflict" : "valid";
    }
    const occupied = bookings.some((b) => b.room === room && startMin >= b.startMin && startMin < b.endMin);
    return occupied ? "occupied" : "neutral";
  };

  return (
    <div className="w-full">
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={onDragStart}
        onDragOver={onDragOver}
        onDragEnd={onDragEnd}
      >
        <div className="mb-3 flex items-center justify-between">
          <div className="text-lg font-semibold text-zinc-100">Bookings</div>
          <div className="text-xs text-zinc-400">30-min grid • Drag handle for mobile</div>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {ROOMS.map((room) => (
            <div key={room} className="rounded-2xl border border-white/10 bg-zinc-950/40 p-3">
              <div className="mb-3 flex items-center justify-between">
                <div className="text-sm font-semibold text-zinc-100">{room}</div>
                <div className="text-xs text-zinc-400">{slots.length} slots</div>
              </div>
              <div className="relative overflow-hidden rounded-xl border border-white/5 bg-zinc-950">
                <div className="relative">
                  {slots.map((slot) => (
                    <RoomSlotRow
                      key={slot}
                      id={slotId(room, slot)}
                      label={minutesToLabel(slot)}
                      isOver={overSlot?.room === room && overSlot?.startMin === slot}
                      status={getSlotStatus(room, slot)}
                    />
                  ))}

                  <div className="pointer-events-none absolute inset-0">
                    {bookingsByRoom.get(room)?.map((booking) => (
                      <div
                        key={booking.id}
                        className="pointer-events-auto absolute left-2 right-2"
                        style={{
                          top: topForStart(booking.startMin) + 4,
                          height: heightForDuration(booking.endMin - booking.startMin),
                        }}
                      >
                        <DraggableBooking booking={booking} isDragging={activeBookingId === booking.id} />
                      </div>
                    ))}

                    {overSlot?.room === room && candidateStatus?.candidate && activeBookingId ? (
                      <div
                        className="absolute left-2 right-2 pointer-events-none"
                        style={{
                          top: topForStart(candidateStatus.candidate.startMin) + 4,
                          height: heightForDuration(candidateStatus.candidate.endMin - candidateStatus.candidate.startMin),
                        }}
                      >
                        <div
                          className={[
                            "h-full rounded-xl border border-dashed",
                            candidateStatus.conflict ? "border-red-500/70 bg-red-500/10" : "border-emerald-500/70 bg-emerald-500/10",
                          ].join(" ")}
                        >
                          <div className="p-2 text-xs text-zinc-200/80">{candidateStatus.conflict ? "Conflict" : "Drop here"}</div>
                        </div>
                      </div>
                    ) : null}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        <DragOverlay>
          {activeBooking ? (
            <motion.div
              className="w-[320px]"
              initial={{ scale: 1 }}
              animate={{ scale: 1.05, opacity: 0.9 }}
              transition={{ duration: 0.25, ease: "easeOut" }}
              style={{ cursor: "grabbing" }}
            >
              <BookingCard booking={activeBooking} isDragging />
            </motion.div>
          ) : null}
        </DragOverlay>
      </DndContext>
    </div>
  );
}
