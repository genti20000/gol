"use client";

import React, { useCallback, useMemo, useRef, useState } from 'react';
import BookingCard from '@/components/BookingCard';
import { supabase } from '@/lib/supabase';
import { type CalendarBooking, hasRoomConflict, snapOffset, type CandidateMove } from '@/lib/calendar/conflicts';
import {
  addMinutesToIso,
  dateAndOffsetToIso,
  getGridOffsets,
  GRID_INTERVAL_MINUTES,
  offsetToTimeLabel,
  ROOMS,
  toOffsetMinutes,
  type RoomId
} from '@/lib/calendar/time';

const ROW_HEIGHT = 56;

type AdminBookingCalendarProps = {
  date: string;
  initialBookings: CalendarBooking[];
};

type DropZoneState = {
  roomId: RoomId;
  offset: number;
  valid: boolean;
} | null;

const durationMinutes = (booking: CalendarBooking) => {
  const start = Date.parse(booking.startAt);
  const end = Date.parse(booking.endAt);
  if (!Number.isFinite(start) || !Number.isFinite(end)) return GRID_INTERVAL_MINUTES;
  return Math.max(GRID_INTERVAL_MINUTES, Math.round((end - start) / 60000));
};

export default function AdminBookingCalendar({ date, initialBookings }: AdminBookingCalendarProps) {
  const [bookings, setBookings] = useState<CalendarBooking[]>(initialBookings);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dropZone, setDropZone] = useState<DropZoneState>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [touchDragBookingId, setTouchDragBookingId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const saveTimersRef = useRef<Record<string, number>>({});
  const touchHoldTimerRef = useRef<number | null>(null);

  const gridOffsets = useMemo(() => getGridOffsets(), []);
  const gridHeight = gridOffsets.length * ROW_HEIGHT;

  const clearToastSoon = useCallback((message: string) => {
    setToast(message);
    window.clearTimeout((clearToastSoon as any)._timer);
    (clearToastSoon as any)._timer = window.setTimeout(() => setToast(null), 2200);
  }, []);

  const persistMove = useCallback(async (candidate: CandidateMove, previous: CalendarBooking) => {
    setIsSaving(true);
    try {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (!token) throw new Error('Admin session expired. Please sign in again.');

      const response = await fetch('/api/admin/bookings/move', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          bookingId: candidate.bookingId,
          roomId: candidate.roomId,
          startAt: candidate.startAt,
          endAt: candidate.endAt
        })
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        throw new Error(payload?.error || 'Unable to move booking.');
      }
    } catch (error) {
      setBookings((prev) => prev.map((item) => (item.id === previous.id ? previous : item)));
      clearToastSoon(error instanceof Error ? error.message : 'Move failed. Booking reverted.');
    } finally {
      setIsSaving(false);
    }
  }, [clearToastSoon]);

  const schedulePersist = useCallback((candidate: CandidateMove, previous: CalendarBooking) => {
    const existing = saveTimersRef.current[candidate.bookingId];
    if (existing) window.clearTimeout(existing);
    saveTimersRef.current[candidate.bookingId] = window.setTimeout(() => {
      persistMove(candidate, previous);
      delete saveTimersRef.current[candidate.bookingId];
    }, 500);
  }, [persistMove]);

  const applyDrop = useCallback((bookingId: string, roomId: RoomId, rawOffset: number) => {
    const booking = bookings.find((item) => item.id === bookingId);
    if (!booking) return;

    const snappedOffset = snapOffset(rawOffset);
    const nextStartAt = dateAndOffsetToIso(date, snappedOffset);
    const nextEndAt = addMinutesToIso(nextStartAt, durationMinutes(booking));
    if (!nextStartAt || !nextEndAt) return;

    const candidate: CandidateMove = {
      bookingId,
      roomId,
      startAt: nextStartAt,
      endAt: nextEndAt
    };

    const valid = !hasRoomConflict(bookings, candidate);
    if (!valid) {
      clearToastSoon('Drop blocked: overlapping booking in that room.');
      return;
    }

    const previous = booking;
    setBookings((prev) =>
      prev.map((item) =>
        item.id === bookingId
          ? { ...item, roomId: candidate.roomId, startAt: candidate.startAt, endAt: candidate.endAt }
          : item
      )
    );

    clearToastSoon(`Moved booking to ${offsetToTimeLabel(snappedOffset)} in ${roomId.toUpperCase()}`);
    schedulePersist(candidate, previous);
  }, [bookings, clearToastSoon, date, schedulePersist]);

  const handleDragStart = useCallback((bookingId: string) => {
    setDraggingId(bookingId);
  }, []);

  const handleDragEnd = useCallback(() => {
    setDraggingId(null);
    setDropZone(null);
  }, []);

  const handleDropZoneHover = useCallback((roomId: RoomId, offset: number) => {
    if (!draggingId) return;
    const booking = bookings.find((item) => item.id === draggingId);
    if (!booking) return;
    const startAt = dateAndOffsetToIso(date, offset);
    const endAt = addMinutesToIso(startAt, durationMinutes(booking));
    const valid = !hasRoomConflict(bookings, {
      bookingId: draggingId,
      roomId,
      startAt,
      endAt
    });
    setDropZone({ roomId, offset, valid });
  }, [bookings, date, draggingId]);

  const onDrop = useCallback((roomId: RoomId, offset: number) => {
    if (!draggingId) return;
    applyDrop(draggingId, roomId, offset);
    setDropZone(null);
    setDraggingId(null);
  }, [applyDrop, draggingId]);

  const handleKeyboardNudge = useCallback((bookingId: string, direction: 'up' | 'down') => {
    const booking = bookings.find((item) => item.id === bookingId);
    if (!booking) return;
    const currentOffset = toOffsetMinutes(new Date(booking.startAt).toTimeString().slice(0, 5));
    if (!Number.isFinite(currentOffset)) return;
    const delta = direction === 'up' ? -GRID_INTERVAL_MINUTES : GRID_INTERVAL_MINUTES;
    applyDrop(bookingId, booking.roomId, currentOffset + delta);
  }, [applyDrop, bookings]);

  const handleTouchHoldStart = useCallback((bookingId: string) => {
    if (touchHoldTimerRef.current) {
      clearTimeout(touchHoldTimerRef.current);
    }
    touchHoldTimerRef.current = window.setTimeout(() => {
      setTouchDragBookingId(bookingId);
      if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
        navigator.vibrate(10);
      }
      clearToastSoon('Tap a time slot to drop this booking.');
    }, 260);
  }, [clearToastSoon]);

  const handleTouchHoldEnd = useCallback(() => {
    if (touchHoldTimerRef.current) {
      clearTimeout(touchHoldTimerRef.current);
      touchHoldTimerRef.current = null;
    }
  }, []);

  return (
    <section className="space-y-4">
      <header className="flex items-center justify-between">
        <h2 className="text-xl font-bold uppercase tracking-wider">Drag & Drop Booking Calendar</h2>
        <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">
          {date} {isSaving ? '• saving…' : ''}
        </p>
      </header>

      {toast ? (
        <div className="fixed left-1/2 top-24 z-50 -translate-x-1/2 rounded-xl border border-emerald-500/40 bg-zinc-900/95 px-4 py-2 text-[10px] font-bold uppercase tracking-widest text-emerald-200">
          {toast}
        </div>
      ) : null}

      <div className="grid grid-cols-[80px_repeat(3,minmax(0,1fr))] gap-3">
        <div className="space-y-0.5">
          <div className="h-10" />
          {gridOffsets.map((offset) => (
            <div key={offset} className="h-14 text-[10px] font-bold uppercase tracking-widest text-zinc-500">
              {offsetToTimeLabel(offset)}
            </div>
          ))}
        </div>

        {ROOMS.map((room) => (
          <div key={room.id} className="min-w-0">
            <div className="mb-2 rounded-xl border border-zinc-800 bg-zinc-900/70 px-3 py-2 text-center text-[11px] font-bold uppercase tracking-widest">
              {room.name}
            </div>
            <div className="relative rounded-xl border border-zinc-800 bg-zinc-950/70" style={{ height: gridHeight }}>
              {gridOffsets.map((offset) => {
                const isDropTarget = dropZone?.roomId === room.id && dropZone?.offset === offset;
                const dropClass = isDropTarget
                  ? dropZone?.valid
                    ? 'border-emerald-500/70 bg-emerald-500/10'
                    : 'border-red-500/70 bg-red-500/10'
                  : draggingId || touchDragBookingId
                    ? 'border-zinc-700/50 bg-zinc-900/40'
                    : 'border-zinc-800/60';

                return (
                  <button
                    key={`${room.id}-${offset}`}
                    type="button"
                    aria-label={`Drop at ${offsetToTimeLabel(offset)} in ${room.name}`}
                    className={`absolute left-0 right-0 border-b ${dropClass} transition-colors`}
                    style={{ top: offset / GRID_INTERVAL_MINUTES * ROW_HEIGHT, height: ROW_HEIGHT }}
                    onDragOver={(event) => {
                      event.preventDefault();
                      handleDropZoneHover(room.id, offset);
                    }}
                    onDrop={(event) => {
                      event.preventDefault();
                      onDrop(room.id, offset);
                    }}
                    onClick={() => {
                      if (!touchDragBookingId) return;
                      applyDrop(touchDragBookingId, room.id, offset);
                      setTouchDragBookingId(null);
                    }}
                  >
                    {isDropTarget && draggingId ? (
                      <div className="mx-2 mt-1 rounded-lg border border-white/25 bg-white/10 px-2 py-1 text-left text-[9px] font-bold uppercase tracking-widest text-zinc-300">
                        Preview
                      </div>
                    ) : null}
                  </button>
                );
              })}

              {bookings
                .filter((booking) => booking.roomId === room.id)
                .map((booking) => {
                  const startOffset = toOffsetMinutes(new Date(booking.startAt).toTimeString().slice(0, 5));
                  const height = Math.max(
                    ROW_HEIGHT,
                    (durationMinutes(booking) / GRID_INTERVAL_MINUTES) * ROW_HEIGHT
                  );
                  if (!Number.isFinite(startOffset)) return null;

                  return (
                    <div
                      key={booking.id}
                      style={{
                        top: (startOffset / GRID_INTERVAL_MINUTES) * ROW_HEIGHT,
                        height
                      }}
                      className="absolute left-0 right-0 transition-all duration-200 ease-out"
                    >
                      <BookingCard
                        booking={booking}
                        isDragging={draggingId === booking.id || touchDragBookingId === booking.id}
                        onDragStart={handleDragStart}
                        onDragEnd={handleDragEnd}
                        onKeyboardNudge={handleKeyboardNudge}
                        onTouchHoldStart={handleTouchHoldStart}
                        onTouchHoldEnd={handleTouchHoldEnd}
                      />
                    </div>
                  );
                })}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
