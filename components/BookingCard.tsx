"use client";

import React, { useMemo } from 'react';
import type { CalendarBooking } from '@/lib/calendar/conflicts';

type BookingCardProps = {
  booking: CalendarBooking;
  isDragging: boolean;
  onDragStart: (bookingId: string) => void;
  onDragEnd: () => void;
  onKeyboardNudge: (bookingId: string, direction: 'up' | 'down') => void;
  onTouchHoldStart: (bookingId: string) => void;
  onTouchHoldEnd: () => void;
};

export default function BookingCard({
  booking,
  isDragging,
  onDragStart,
  onDragEnd,
  onKeyboardNudge,
  onTouchHoldStart,
  onTouchHoldEnd
}: BookingCardProps) {
  const statusColor = useMemo(() => {
    if (booking.status === 'CONFIRMED') return 'border-emerald-500/40';
    if (booking.status === 'PENDING') return 'border-amber-500/40';
    return 'border-zinc-700';
  }, [booking.status]);

  return (
    <article
      draggable
      role="button"
      tabIndex={0}
      aria-label={`${booking.title} in ${booking.roomId}, draggable booking card`}
      aria-grabbed={isDragging}
      onDragStart={() => onDragStart(booking.id)}
      onDragEnd={onDragEnd}
      onKeyDown={(event) => {
        if (event.key === 'ArrowUp') {
          event.preventDefault();
          onKeyboardNudge(booking.id, 'up');
        } else if (event.key === 'ArrowDown') {
          event.preventDefault();
          onKeyboardNudge(booking.id, 'down');
        }
      }}
      className={`absolute left-1.5 right-1.5 rounded-xl border bg-zinc-900/95 p-2 text-left shadow-lg transition-all duration-200 ${statusColor} ${isDragging ? 'opacity-80 scale-105 shadow-2xl z-30 cursor-grabbing' : 'opacity-100 scale-100 cursor-grab z-20'}`}
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-100">{booking.title}</p>
          {booking.guests ? (
            <p className="text-[9px] font-bold uppercase tracking-widest text-zinc-400">{booking.guests} guests</p>
          ) : null}
        </div>
        <button
          type="button"
          aria-label="Drag booking"
          onTouchStart={() => onTouchHoldStart(booking.id)}
          onTouchEnd={onTouchHoldEnd}
          onTouchCancel={onTouchHoldEnd}
          className="rounded-md border border-zinc-700 px-2 py-1 text-[9px] font-bold uppercase tracking-widest text-zinc-300 touch-pan-y"
        >
          Drag
        </button>
      </div>
    </article>
  );
}

