"use client";

import React from 'react';
import { useRouterShim } from '@/lib/routerShim';

export default function Cancelled() {
  const { route, navigate } = useRouterShim();
  const bookingId = route.params.get('id');

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="glass-panel p-8 md:p-10 rounded-[2rem] border-red-500/30 max-w-xl w-full text-center space-y-5">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-red-500/10 border border-red-500/30 mx-auto">
          <i className="fa-solid fa-circle-xmark text-2xl text-red-400"></i>
        </div>
        <h1 className="text-3xl md:text-4xl font-bold uppercase tracking-tighter">Payment Cancelled</h1>
        <p className="text-zinc-500 text-xs uppercase tracking-widest">
          Your payment was cancelled or failed. You can return to the booking flow to try again.
        </p>
        {bookingId && (
          <p className="text-[10px] uppercase tracking-widest text-zinc-600">
            Booking ID: <span className="text-zinc-400">{bookingId}</span>
          </p>
        )}
        <button
          onClick={() => navigate('/')}
          className="gold-gradient px-6 py-3 rounded-xl md:rounded-2xl font-bold uppercase tracking-[0.2em] text-black shadow-xl shadow-amber-500/10 text-[10px] min-h-[44px] cursor-pointer"
        >
          Back to Booking
        </button>
      </div>
    </div>
  );
}
