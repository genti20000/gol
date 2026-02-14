import { GRID_INTERVAL_MINUTES, GRID_END_HOUR, GRID_START_HOUR, type RoomId } from '@/lib/calendar/time';

export type CalendarBooking = {
  id: string;
  roomId: RoomId;
  startAt: string;
  endAt: string;
  title: string;
  guests?: number;
  status?: string;
};

export type CandidateMove = {
  bookingId: string;
  roomId: RoomId;
  startAt: string;
  endAt: string;
};

const parseMs = (iso: string) => Date.parse(String(iso || ''));

export const rangesOverlap = (aStart: number, aEnd: number, bStart: number, bEnd: number) =>
  aStart < bEnd && aEnd > bStart;

export const hasRoomConflict = (
  bookings: CalendarBooking[],
  candidate: CandidateMove
) => {
  const candidateStart = parseMs(candidate.startAt);
  const candidateEnd = parseMs(candidate.endAt);
  if (!Number.isFinite(candidateStart) || !Number.isFinite(candidateEnd)) return true;

  return bookings.some((booking) => {
    if (booking.id === candidate.bookingId) return false;
    if (booking.roomId !== candidate.roomId) return false;
    const bookingStart = parseMs(booking.startAt);
    const bookingEnd = parseMs(booking.endAt);
    if (!Number.isFinite(bookingStart) || !Number.isFinite(bookingEnd)) return false;
    return rangesOverlap(candidateStart, candidateEnd, bookingStart, bookingEnd);
  });
};

export const snapOffset = (rawOffset: number) => {
  const snapped = Math.round(rawOffset / GRID_INTERVAL_MINUTES) * GRID_INTERVAL_MINUTES;
  const maxOffset = (GRID_END_HOUR - GRID_START_HOUR) * 60;
  return Math.max(0, Math.min(snapped, maxOffset));
};

