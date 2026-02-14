"use client";

import React, { useMemo } from "react";

import { AdminBookingCalendar } from "@/components/AdminBookingCalendar";
import type { Booking } from "@/lib/calendar/conflicts";

function mk(
  id: string,
  room: Booking["room"],
  startMin: number,
  endMin: number,
  customerName: string,
  guests: number,
  status: Booking["status"] = "CONFIRMED"
): Booking {
  return {
    id,
    room,
    startMin,
    endMin,
    customerName,
    guests,
    status,
    addOnsTotal: 0,
    grandTotal: 0,
  };
}

export default function AdminCalendarDemo() {
  const initialBookings = useMemo<Booking[]>(
    () => [
      mk("b1", "TERRACE", 17 * 60, 19 * 60, "Genti K", 14, "CONFIRMED"),
      mk("b2", "VOX", 18 * 60, 20 * 60, "Amelia R", 10, "PENDING"),
      mk("b3", "ATTIC", 19 * 60 + 30, 21 * 60 + 30, "Noah P", 16, "CONFIRMED"),
      mk("b4", "TERRACE", 21 * 60, 22 * 60 + 30, "Sophia M", 8, "CONFIRMED"),
    ],
    []
  );

  return (
    <div className="w-full px-4 py-8 md:py-12 md:max-w-7xl md:mx-auto">
      <AdminBookingCalendar initialBookings={initialBookings} />
    </div>
  );
}

