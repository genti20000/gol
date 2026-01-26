"use client";

import React, { useState, useMemo } from 'react';
import { useRouterShim } from '@/app/page';
import { useStore } from '@/store';
import { BookingStatus, Booking } from '@/types';

export default function ManageBooking() {
  const { route, navigate } = useRouterShim();
  // Simplified path handling for single-page shim
  const token = route.path.split('/').pop() || '';
  const store = useStore();
  const [isProcessing, setIsProcessing] = useState(false);

  const booking = useMemo(() => store.getBookingByMagicToken(token || ''), [token, store]);

  const canCancel = useMemo(() => booking ? store.canRescheduleOrCancel(booking, 'cancel') : false, [booking, store]);
  const canReschedule = useMemo(() => booking ? store.canRescheduleOrCancel(booking, 'reschedule') : false, [booking, store]);

  const handleCancel = async () => {
    if (!booking) return;
    if (!confirm("Are you sure you want to cancel your session? This action is irreversible.")) return;

    setIsProcessing(true);
    store.updateBooking(booking.id, { status: BookingStatus.CANCELLED });
    setIsProcessing(false);
    alert("Your booking has been cancelled.");
    navigate('/');
  };

  if (!booking) {
    return (
      <div className="p-20 text-center animate-in fade-in duration-500">
         <i className="fa-solid fa-ghost text-4xl text-zinc-800 mb-6"></i>
         <h2 className="text-xl font-bold uppercase tracking-tighter mb-2">Booking Not Found</h2>
         <p className="text-zinc-600 text-[10px] uppercase tracking-widest mb-10">The link may be invalid or expired.</p>
         <button onClick={() => navigate('/')} className="gold-gradient px-8 py-3 rounded-xl text-black font-bold uppercase tracking-widest text-[10px] border-none cursor-pointer">Back Home</button>
      </div>
    );
  }

  const isCancelled = booking.status === BookingStatus.CANCELLED;

  return (
    <div className="w-full px-4 py-16 md:max-w-xl md:mx-auto animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="mb-12">
        <h1 className="text-4xl font-bold uppercase tracking-tighter mb-2">Manage <span className="text-amber-500">Booking</span></h1>
        <p className="text-zinc-500 text-[10px] font-bold uppercase tracking-widest">Update your reservation details</p>
      </div>

      <div className="glass-panel p-8 sm:p-10 rounded-[2.5rem] border-zinc-800 space-y-8 shadow-2xl">
         {/* ... Details remain unchanged ... */}

         {!isCancelled && (
            <div className="pt-8 space-y-4">
               {canReschedule ? (
                  <button 
                     onClick={() => navigate(`/?reschedule=${booking.id}`)}
                     className="w-full bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 py-4 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all cursor-pointer text-white"
                  >
                     Reschedule Booking
                  </button>
               ) : (
                  <p className="text-[9px] text-zinc-600 text-center uppercase tracking-widest">Rescheduling is disabled within {store.settings.rescheduleCutoffHours}h of start.</p>
               )}

               {canCancel ? (
                  <button 
                     disabled={isProcessing}
                     onClick={handleCancel}
                     className="w-full bg-red-500/10 border border-red-500/20 hover:bg-red-500 text-red-500 hover:text-white py-4 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all cursor-pointer"
                  >
                     Cancel Booking
                  </button>
               ) : (
                  <p className="text-[9px] text-zinc-600 text-center uppercase tracking-widest">Cancellations are disabled within {store.settings.cancelCutoffHours}h of start.</p>
               )}
            </div>
         )}
      </div>

      <div className="mt-12 text-center">
         <button onClick={() => navigate('/')} className="bg-transparent border-none cursor-pointer text-zinc-500 hover:text-white text-[10px] uppercase font-bold tracking-widest transition-colors">Return to Homepage</button>
      </div>
    </div>
  );
}