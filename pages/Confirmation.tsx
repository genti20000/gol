"use client";

import React from 'react';
import { useRouterShim } from '@/app/page';
import { useStore } from '@/store';
import { getGuestLabel } from '@/constants';

const Confirmation: React.FC = () => {
  const { route, navigate } = useRouterShim();
  const store = useStore();
  const id = route.params.get('id');
  const booking = store.bookings.find(b => b.id === id);

  if (!booking) return <div className="p-20 text-center uppercase font-bold tracking-widest text-zinc-600">Booking record not found.</div>;

  return (
    <div className="w-full px-4 py-12 sm:py-20 md:max-w-xl md:mx-auto text-center animate-in fade-in duration-1000">
      {/* ... UI remains unchanged ... */}
      {booking.magicToken && (
         <div className="mb-8 md:mb-10">
            <button 
               onClick={() => navigate(`/m/${booking.magicToken}`)} 
               className="bg-transparent border-none cursor-pointer text-amber-500 font-bold uppercase tracking-widest text-[9px] md:text-[10px] border-b border-amber-500/20 pb-1 hover:text-white transition-all"
            >
               Manage Booking Online
            </button>
         </div>
      )}
      {/* ... UI remains unchanged ... */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4 px-4 sm:px-0">
        <button onClick={() => navigate('/')} className="bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 transition-all py-3.5 md:py-5 rounded-xl md:rounded-2xl font-bold uppercase text-[9px] md:text-[10px] tracking-widest active:scale-95 min-h-[44px] flex items-center justify-center cursor-pointer text-white">
          Return Home
        </button>
        <button 
          onClick={() => window.print()}
          className="gold-gradient text-black py-3.5 md:py-5 rounded-xl md:rounded-2xl font-bold uppercase text-[9px] md:text-[10px] tracking-widest shadow-xl shadow-amber-500/10 transition-transform active:scale-95 min-h-[44px] cursor-pointer"
        >
          Download Pass
        </button>
      </div>
    </div>
  );
};

export default Confirmation;