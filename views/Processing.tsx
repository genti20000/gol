"use client";

import React, { useEffect, useState } from 'react';
import { useRouterShim } from '@/lib/routerShim';
import { BookingStatus } from '@/types';

const POLL_INTERVAL_MS = 2000;
const MAX_POLLS = 60;

export default function Processing() {
  const { route, navigate } = useRouterShim();
  const bookingId = route.params.get('id') || '';
  const [message, setMessage] = useState('Processing payment…');
  const [status, setStatus] = useState<BookingStatus | null>(null);

  useEffect(() => {
    if (!bookingId) return;

    let alive = true;
    let tries = 0;

    const tick = async () => {
      tries += 1;

      try {
        const response = await fetch(`/api/bookings/${bookingId}`);
        const payload = await response.json();

        if (!alive) return;

        if (!response.ok) {
          throw new Error(payload?.error || 'Unable to check booking status.');
        }

        const nextStatus = payload?.status as BookingStatus | undefined;
        if (nextStatus) {
          setStatus(nextStatus);
        }

        if (nextStatus === BookingStatus.CONFIRMED) {
          navigate(`/booking/confirmed?id=${bookingId}`);
          return;
        }

        if (nextStatus === BookingStatus.FAILED || nextStatus === BookingStatus.CANCELLED || nextStatus === BookingStatus.NO_SHOW) {
          navigate(`/booking/failed?id=${bookingId}`);
          return;
        }

        if (tries % 5 === 0) {
          setMessage('Still confirming… this usually takes a few seconds.');
        }
      } catch (error) {
        if (tries % 5 === 0) {
          setMessage('Still working on your payment…');
        }
      }

      if (tries >= MAX_POLLS) {
        setMessage('Taking longer than usual. Please contact support with your booking ID.');
        return;
      }

      setTimeout(tick, POLL_INTERVAL_MS);
    };

    tick();
    return () => {
      alive = false;
    };
  }, [bookingId, navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="glass-panel p-8 md:p-10 rounded-[2rem] border-zinc-800 max-w-xl w-full text-center space-y-4">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-amber-500/10 border border-amber-500/30 mx-auto">
          <i className="fa-solid fa-spinner fa-spin text-2xl text-amber-500"></i>
        </div>
        <h1 className="text-3xl md:text-4xl font-bold uppercase tracking-tighter">Processing</h1>
        <p className="text-zinc-500 text-xs uppercase tracking-widest">{message}</p>
        <div className="text-[10px] uppercase tracking-widest text-zinc-600 space-y-1">
          <p><span className="text-zinc-400">Booking ID:</span> {bookingId || 'Missing'}</p>
          {status && <p><span className="text-zinc-400">Status:</span> {status}</p>}
        </div>
      </div>
    </div>
  );
}
