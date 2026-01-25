
"use client";

import React from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { useStore } from '../store';
import { getGuestLabel } from '../constants';

const Confirmation: React.FC = () => {
  const [searchParams] = useSearchParams();
  const store = useStore();

  // Added return statement to fix JSX type error
  return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center px-4 text-center">
      <div className="bg-amber-500/10 text-amber-500 w-20 h-20 rounded-full flex items-center justify-center mb-8">
        <i className="fa-solid fa-check text-4xl"></i>
      </div>
      <h1 className="text-5xl font-bold uppercase tracking-tighter mb-4">Booking Confirmed</h1>
      <p className="text-zinc-400 mb-8 uppercase tracking-widest text-xs font-bold">Check your email for details.</p>
      <Link to="/" className="gold-gradient px-12 py-4 rounded-xl text-black font-bold uppercase tracking-widest text-[10px]">
        Back to Home
      </Link>
    </div>
  );
};

// Added missing default export
export default Confirmation;
