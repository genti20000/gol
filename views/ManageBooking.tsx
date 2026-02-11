"use client";

import React, { useState, useMemo } from 'react';
import { useRouterShim } from '@/lib/routerShim';
import { useStore } from '@/store';
import { BookingStatus, Booking } from '@/types';

export default function ManageBooking() {
   const { route, navigate } = useRouterShim();
   // Simplified path handling for single-page shim
   const token = route.path.split('/').pop() || '';
   const store = useStore();
   const [isProcessing, setIsProcessing] = useState(false);
   const [errorMessage, setErrorMessage] = useState<string | null>(null);

   const booking = useMemo(() => store.getBookingByMagicToken(token || ''), [token, store]);

   const canCancel = useMemo(() => booking ? store.canRescheduleOrCancel(booking, 'cancel') : false, [booking, store]);
   const canReschedule = useMemo(() => booking ? store.canRescheduleOrCancel(booking, 'reschedule') : false, [booking, store]);

   const handleCancel = async () => {
      if (!booking) return;
      if (!confirm("Are you sure you want to cancel your session? This action is irreversible.")) return;

      setIsProcessing(true);
      setErrorMessage(null);
      const result = await store.updateBooking(booking.id, { status: BookingStatus.CANCELLED });
      setIsProcessing(false);
      if (!result.ok) {
         setErrorMessage(result.error ?? "We couldn't cancel your booking. Please try again.");
         return;
      }
      alert("Your booking has been cancelled.");
      navigate('/');
   };

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
               {store.loadError || 'Failed to load booking details. Please refresh and try again.'}
            </div>
         </div>
      );
   }

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

   const formatDate = (isoString: string) => {
      try {
         const date = new Date(isoString);
         return date.toLocaleDateString('en-GB', { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' });
      } catch {
         return isoString;
      }
   };

   const formatTime = (isoString: string) => {
      try {
         const date = new Date(isoString);
         return date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
      } catch {
         return isoString;
      }
   };

   return (
      <div className="w-full px-4 py-16 md:max-w-xl md:mx-auto animate-in fade-in slide-in-from-bottom-4 duration-700">
         <div className="mb-12">
            <h1 className="text-4xl font-bold uppercase tracking-tighter mb-2">Manage <span className="text-amber-500">Booking</span></h1>
            <p className="text-zinc-500 text-[10px] font-bold uppercase tracking-widest">Your reservation details</p>
         </div>

         <div className="glass-panel p-8 sm:p-10 rounded-[2.5rem] border-zinc-800 space-y-8 shadow-2xl">
            {errorMessage && (
               <div className="rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-red-200 text-center">
                  {errorMessage}
               </div>
            )}

            {/* Status Badge */}
            <div className="flex items-center justify-between">
               <span className="text-[9px] font-bold uppercase tracking-widest text-zinc-500">Status</span>
               <span className={`text-[9px] font-bold uppercase tracking-widest px-3 py-1.5 rounded-lg ${
                  booking.status === BookingStatus.CONFIRMED ? 'bg-green-500/20 text-green-400' :
                  booking.status === BookingStatus.PENDING ? 'bg-amber-500/20 text-amber-400' :
                  booking.status === BookingStatus.CANCELLED ? 'bg-red-500/20 text-red-400' :
                  'bg-zinc-800 text-zinc-400'
               }`}>
                  {booking.status}
               </span>
            </div>

            {/* Booking Reference */}
            {booking.booking_ref && (
               <div>
                  <span className="text-[9px] font-bold uppercase tracking-widest text-zinc-500">Booking Reference</span>
                  <p className="text-sm font-mono font-bold text-amber-500 mt-1">{booking.booking_ref.toUpperCase()}</p>
               </div>
            )}

            {/* Date & Time */}
            <div className="grid grid-cols-2 gap-6">
               <div>
                  <span className="text-[9px] font-bold uppercase tracking-widest text-zinc-500">Date</span>
                  <p className="text-sm font-bold text-white mt-1">{formatDate(booking.start_at)}</p>
               </div>
               <div>
                  <span className="text-[9px] font-bold uppercase tracking-widest text-zinc-500">Time</span>
                  <p className="text-sm font-bold text-white mt-1">{formatTime(booking.start_at)}</p>
               </div>
            </div>

            {/* Room & Guests */}
            <div className="grid grid-cols-2 gap-6">
               <div>
                  <span className="text-[9px] font-bold uppercase tracking-widest text-zinc-500">Room</span>
                  <p className="text-sm font-bold text-white mt-1">{booking.room_name}</p>
               </div>
               <div>
                  <span className="text-[9px] font-bold uppercase tracking-widest text-zinc-500">Guests</span>
                  <p className="text-sm font-bold text-white mt-1">{booking.guests} People</p>
               </div>
            </div>

            {/* Guest Details */}
            <div className="border-t border-zinc-700 pt-6">
               <span className="text-[9px] font-bold uppercase tracking-widest text-zinc-500 block mb-4">Guest Information</span>
               <div className="grid grid-cols-1 gap-4">
                  <div>
                     <span className="text-[8px] font-bold uppercase tracking-widest text-zinc-600">Name</span>
                     <p className="text-sm text-white mt-1">{booking.customer_name} {booking.customer_surname || ''}</p>
                  </div>
                  <div>
                     <span className="text-[8px] font-bold uppercase tracking-widest text-zinc-600">Email</span>
                     <p className="text-sm text-white mt-1 break-all">{booking.customer_email}</p>
                  </div>
                  {booking.customer_phone && (
                     <div>
                        <span className="text-[8px] font-bold uppercase tracking-widest text-zinc-600">Phone</span>
                        <p className="text-sm text-white mt-1">{booking.customer_phone}</p>
                     </div>
                  )}
               </div>
            </div>

            {/* Special Requests */}
            {(booking.special_requests || booking.notes) && (
               <div className="border-t border-zinc-700 pt-6">
                  <span className="text-[9px] font-bold uppercase tracking-widest text-zinc-500 block mb-3">Special Requests</span>
                  <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-4">
                     <p className="text-sm text-zinc-300 whitespace-pre-wrap break-words">
                        {booking.special_requests || booking.notes}
                     </p>
                  </div>
               </div>
            )}

            {/* Pricing */}
            <div className="border-t border-zinc-700 pt-6">
               <span className="text-[9px] font-bold uppercase tracking-widest text-zinc-500 block mb-4">Pricing</span>
               <div className="space-y-2 text-[10px]">
                  <div className="flex justify-between">
                     <span className="text-zinc-500">Base Total</span>
                     <span className="text-white">£{booking.base_total.toFixed(2)}</span>
                  </div>
                  {booking.extras_price > 0 && (
                     <div className="flex justify-between">
                        <span className="text-zinc-500">Extras</span>
                        <span className="text-white">£{booking.extras_price.toFixed(2)}</span>
                     </div>
                  )}
                  {booking.extras_total && booking.extras_total > 0 && (
                     <div className="flex justify-between">
                        <span className="text-zinc-500">Additional Items</span>
                        <span className="text-white">£{booking.extras_total.toFixed(2)}</span>
                     </div>
                  )}
                  {booking.discount_amount > 0 && (
                     <div className="flex justify-between">
                        <span className="text-green-400">Discount</span>
                        <span className="text-green-400">-£{booking.discount_amount.toFixed(2)}</span>
                     </div>
                  )}
                  {booking.promo_discount_amount && booking.promo_discount_amount > 0 && (
                     <div className="flex justify-between">
                        <span className="text-green-400">Promo ({booking.promo_code})</span>
                        <span className="text-green-400">-£{booking.promo_discount_amount.toFixed(2)}</span>
                     </div>
                  )}
                  <div className="flex justify-between border-t border-zinc-700 pt-2 mt-2">
                     <span className="text-amber-500 font-bold">Total</span>
                     <span className="text-amber-500 font-bold">£{booking.total_price.toFixed(2)}</span>
                  </div>
               </div>
            </div>

            {/* Action Buttons */}
            {!isCancelled && (
               <div className="pt-8 space-y-4 border-t border-zinc-700">
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
                        className="w-full bg-red-500/10 border border-red-500/20 hover:bg-red-500 text-red-500 hover:text-white py-4 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all cursor-pointer disabled:opacity-50"
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
