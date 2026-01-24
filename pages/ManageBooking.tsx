import React, { useState, useMemo } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useStore } from '../store';
import { BookingStatus, Booking } from '../types';

export default function ManageBooking() {
  const { token } = useParams();
  const navigate = useNavigate();
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
         <Link to="/" className="gold-gradient px-8 py-3 rounded-xl text-black font-bold uppercase tracking-widest text-[10px]">Back Home</Link>
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
         <div className="flex justify-between items-start">
            <div>
               <p className="text-[10px] uppercase font-bold text-zinc-500 tracking-widest mb-1">Reference</p>
               <p className="text-2xl font-mono font-bold text-white">#{booking.id.toUpperCase()}</p>
            </div>
            <div className="text-right">
               <span className={`text-[10px] font-bold px-3 py-1 rounded-full uppercase tracking-widest border ${
                  isCancelled ? 'bg-red-500/10 text-red-500 border-red-500/20' : 'bg-green-500/10 text-green-500 border-green-500/20'
               }`}>
                  {booking.status}
               </span>
            </div>
         </div>

         <div className="space-y-6 pt-6 border-t border-zinc-800">
            <div className="flex justify-between items-center">
               <span className="text-zinc-500 text-[10px] uppercase font-bold tracking-widest">Date</span>
               <span className="font-bold">{new Date(booking.start_at).toLocaleDateString('en-GB', { dateStyle: 'long' })}</span>
            </div>
            <div className="flex justify-between items-center">
               <span className="text-zinc-500 text-[10px] uppercase font-bold tracking-widest">Time</span>
               <span className="font-bold font-mono">
                  {new Date(booking.start_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
               </span>
            </div>
            <div className="flex justify-between items-center">
               <span className="text-zinc-500 text-[10px] uppercase font-bold tracking-widest">Guests</span>
               <span className="font-bold">{booking.guests}</span>
            </div>
         </div>

         {!isCancelled && (
            <div className="pt-8 space-y-4">
               {canReschedule ? (
                  <button 
                     onClick={() => navigate(`/?reschedule=${booking.id}`)}
                     className="w-full bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 py-4 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all"
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
                     className="w-full bg-red-500/10 border border-red-500/20 hover:bg-red-500 text-red-500 hover:text-white py-4 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all"
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
         <Link to="/" className="text-zinc-500 hover:text-white text-[10px] uppercase font-bold tracking-widest transition-colors">Return to Homepage</Link>
      </div>
    </div>
  );
}
