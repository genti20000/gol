"use client";

import React, { useMemo } from 'react';
import AdminBookingCalendar from '@/components/AdminBookingCalendar';
import type { CalendarBooking } from '@/lib/calendar/conflicts';
import { dateAndOffsetToIso } from '@/lib/calendar/time';

const buildBooking = (
  id: string,
  roomId: 'terrace' | 'vox' | 'attic',
  startOffset: number,
  durationMinutes: number,
  title: string,
  guests: number,
  date: string
): CalendarBooking => ({
  id,
  roomId,
  startAt: dateAndOffsetToIso(date, startOffset),
  endAt: dateAndOffsetToIso(date, startOffset + durationMinutes),
  title,
  guests,
  status: 'CONFIRMED'
});

export default function AdminCalendarDemo() {
  const date = new Date().toISOString().slice(0, 10);

  const initialBookings = useMemo<CalendarBooking[]>(() => [
    buildBooking('demo-1', 'terrace', 0, 120, 'Genti / Birthday', 14, date),
    buildBooking('demo-2', 'vox', 30, 120, 'Team Social', 10, date),
    buildBooking('demo-3', 'attic', 120, 90, 'Corporate Night', 18, date),
    buildBooking('demo-4', 'terrace', 180, 120, 'Hen Party', 20, date)
  ], [date]);

  return (
    <div className="w-full px-4 py-8 md:max-w-7xl md:mx-auto space-y-6">
      <div className="glass-panel rounded-2xl p-4 border border-zinc-800">
        <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-400">
          Demo route: /admin/calendar. Drag a card or long-press the Drag handle on mobile.
        </p>
      </div>
      <AdminBookingCalendar date={date} initialBookings={initialBookings} />
    </div>
  );
}

