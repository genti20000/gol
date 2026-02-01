"use client";

import React, { useEffect, useState } from 'react';
import { useRouterShim } from '@/lib/routerShim';
import { BookingStatus } from '@/types';

type ConfirmationBooking = {
  id: string;
  status: BookingStatus;
  booking_ref?: string | null;
  customer_email?: string | null;
  deposit_amount?: number | null;
  confirmed_at?: string | null;
};

const Confirmation: React.FC = () => {
  const { route } = useRouterShim();
  const id = route.params.get('id');
  const [booking, setBooking] = useState<ConfirmationBooking | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) {
      setLoadError('Missing booking id.');
      setLoading(false);
      return;
    }

    let isMounted = true;

    const loadBooking = async () => {
      try {
        setLoading(true);
        setLoadError(null);
        const response = await fetch(`/api/bookings/${id}`);
        const payload = await response.json().catch(() => ({}));

        if (!isMounted) return;

        if (!response.ok) {
          setLoadError(payload?.error || 'Failed to load booking. Please refresh and try again.');
          return;
        }

        setBooking(payload?.booking ?? null);
      } catch (error) {
        if (!isMounted) return;
        setLoadError('Failed to load booking. Please refresh and try again.');
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    loadBooking();

    return () => {
      isMounted = false;
    };
  }, [id]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center uppercase font-bold tracking-widest text-zinc-600 animate-pulse text-sm">
          Loading...
        </div>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="text-center uppercase font-bold tracking-widest text-red-400 text-sm">
          {loadError}
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

  if (booking.status !== BookingStatus.CONFIRMED) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="glass-panel p-8 md:p-10 rounded-[2rem] border-zinc-800 max-w-md w-full text-center space-y-4">
          <h1 className="text-2xl md:text-3xl font-bold uppercase tracking-tighter text-white">
            Booking pending confirmation
          </h1>
          <p className="text-zinc-500 text-xs uppercase tracking-widest">
            We are still confirming your booking. Please wait a moment and refresh this page.
          </p>
        </div>
      </div>
    );
  }

  const bookingRef = booking.booking_ref || booking.id.substring(0, 8).toUpperCase();
  const customerEmail = booking.customer_email || '';
  const depositAmount = booking.deposit_amount ?? 0;

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
            {bookingRef}
          </p>
        </div>

        <p className="text-zinc-500 text-xs uppercase tracking-widest max-w-md mx-auto">
          A confirmation email has been sent to <span className="text-white">{customerEmail}</span>
        </p>
        {depositAmount <= 0 && (
          <p className="text-[10px] uppercase tracking-widest text-amber-400">
            No payment required today.
          </p>
        )}
      </div>
    </div>
  );
};

export default Confirmation;
