"use client";

import React from 'react';
import { useRouterShim } from '@/lib/routerShim';
import { useStore } from '@/store';

const Confirmation: React.FC = () => {
  const { route } = useRouterShim();
  const store = useStore();
  const id = route.params.get('id');
  const booking = store.bookings.find(b => b.id === id);

  if (store.loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center uppercase font-bold tracking-widest text-zinc-600 animate-pulse text-sm">
          Loading...
        </div>
      </div>
    );
  }

  if (store.loadError) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="text-center uppercase font-bold tracking-widest text-red-400 text-sm">
          Failed to load booking. Please refresh and try again.
        </div>
      </div>
    );
  }

  if (!booking) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center uppercase font-bold tracking-widest text-zinc-600 text-sm">
          Booking not found
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="text-center space-y-8 animate-in fade-in zoom-in duration-700">
        <div className="space-y-4">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-green-500/10 border-2 border-green-500/30 mb-4">
            <i className="fa-solid fa-check text-3xl text-green-500"></i>
          </div>
          <h1 className="text-4xl md:text-6xl font-bold uppercase tracking-tighter text-white">
            Confirmed
          </h1>
        </div>

        <div className="glass-panel p-8 md:p-10 rounded-[2rem] border-amber-500/20 inline-block">
          <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-zinc-500 mb-3">Booking Reference</p>
          <p className="text-3xl md:text-4xl font-bold font-mono tracking-wider text-amber-500">
            {booking.booking_ref || booking.id.substring(0, 8).toUpperCase()}
          </p>
        </div>

        <p className="text-zinc-500 text-xs uppercase tracking-widest max-w-md mx-auto">
          A confirmation email has been sent to <span className="text-white">{booking.customer_email}</span>
        </p>
      </div>
    </div>
  );
};

export default Confirmation;
