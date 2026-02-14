import type { Room } from "@/lib/calendar/time";

export type Booking = {
  id: string;
  room: Room;
  startMin: number;
  endMin: number;
  customerName: string;
  guests: number;
  status: "CONFIRMED" | "PENDING";
  addOnsTotal?: number;
  grandTotal?: number;
};

export function overlaps(a: { startMin: number; endMin: number }, b: { startMin: number; endMin: number }) {
  return a.startMin < b.endMin && b.startMin < a.endMin;
}

export function hasConflict(
  bookings: Booking[],
  candidate: { id?: string; room: Room; startMin: number; endMin: number }
) {
  return bookings
    .filter((booking) => booking.room === candidate.room && booking.id !== candidate.id)
    .some((booking) => overlaps(booking, candidate));
}
