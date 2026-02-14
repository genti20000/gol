"use client";

import React from "react";
import { motion } from "framer-motion";

import type { Booking } from "@/lib/calendar/conflicts";
import { minutesToLabel } from "@/lib/calendar/time";

export function BookingCard({
  booking,
  isDragging,
  dragHandleProps,
}: {
  booking: Booking;
  isDragging: boolean;
  dragHandleProps?: React.HTMLAttributes<HTMLButtonElement>;
}) {
  return (
    <motion.div
      layout
      layoutId={`booking-${booking.id}`}
      aria-label={`Booking ${booking.customerName}, ${booking.guests} guests, ${minutesToLabel(booking.startMin)} to ${minutesToLabel(
        booking.endMin
      )} in ${booking.room}`}
      className={[
        "rounded-xl border border-white/10 bg-zinc-900/70 text-zinc-50 shadow-sm backdrop-blur",
        "transition-shadow",
        isDragging ? "shadow-xl" : "hover:shadow-md",
      ].join(" ")}
      animate={{
        opacity: isDragging ? 0.8 : 1,
        scale: isDragging ? 1.05 : 1,
      }}
      transition={{ duration: 0.12 }}
    >
      <div className="flex items-start gap-3 p-3">
        <button
          {...dragHandleProps}
          type="button"
          className={[
            "mt-0.5 h-10 w-10 shrink-0 rounded-lg",
            "bg-white/5 hover:bg-white/10 active:bg-white/15",
            "flex items-center justify-center",
            "cursor-grab active:cursor-grabbing",
            "touch-manipulation",
          ].join(" ")}
          aria-label="Drag booking"
        >
          <div className="grid gap-1">
            <span className="block h-1 w-4 rounded bg-white/50" />
            <span className="block h-1 w-4 rounded bg-white/50" />
            <span className="block h-1 w-4 rounded bg-white/50" />
          </div>
        </button>

        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <div className="truncate font-semibold">{booking.customerName}</div>
            <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-xs font-semibold text-emerald-300">
              {booking.status}
            </span>
          </div>

          <div className="mt-1 text-xs text-zinc-300">
            {minutesToLabel(booking.startMin)}-{minutesToLabel(booking.endMin)} • {booking.guests} guests
          </div>

          <div className="mt-2 text-xs text-zinc-400">
            Add-ons: £{booking.addOnsTotal ?? 0} • Total: £{booking.grandTotal ?? 0}
          </div>
        </div>
      </div>

      <div className="h-1 w-full rounded-b-xl bg-gradient-to-r from-white/0 via-white/10 to-white/0" />
    </motion.div>
  );
}

