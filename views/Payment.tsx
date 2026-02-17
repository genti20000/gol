"use client";

import React, { useEffect, useState } from 'react';

import Spinner from '@/components/Spinner';
import { useRouterShim } from '@/lib/routerShim';

const PENDING_PAYMENT_KEY = 'lkc_pending_payment';

const normalizePaymentLink = (rawLink: string, checkoutId: string): string => {
  const link = String(rawLink || '').trim();
  if (/^https?:\/\//i.test(link)) return link;
  if (link.startsWith('/') && typeof window !== 'undefined') {
    return new URL(link, window.location.origin).toString();
  }
  if (checkoutId) {
    return `https://checkout.sumup.com/pay/c-${encodeURIComponent(checkoutId)}`;
  }
  return '';
};

export default function Payment() {
  const { route, navigate, back } = useRouterShim();
  const bookingId = route.params.get('id') || route.params.get('bookingId') || '';
  const token = route.params.get('token') || '';

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState('Preparing secure payment...');
  const [amountLabel, setAmountLabel] = useState<string | null>(null);

  useEffect(() => {
    if (!bookingId || !token) {
      setLoading(false);
      setError('Missing payment session. Please return and try again.');
      return;
    }

    let alive = true;

    const startHostedCheckout = async () => {
      try {
        setLoading(true);
        setError(null);
        setStatusMessage('Preparing secure payment...');

        const resolveResponse = await fetch('/api/bookings/resolve', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: bookingId, token })
        });
        const resolvePayload = await resolveResponse.json().catch(() => ({}));
        if (!alive) return;

        if (!resolveResponse.ok) {
          if (resolveResponse.status === 410) {
            throw new Error('Booking link expired. Please choose another time.');
          }
          if (resolveResponse.status === 400) {
            throw new Error('Invalid booking link.');
          }
          throw new Error(resolvePayload?.error || 'Booking not found.');
        }

        if (resolvePayload?.alreadyPaid) {
          const resolvedBookingId = String(resolvePayload?.bookingId || bookingId);
          navigate(`/booking/confirmed?id=${resolvedBookingId}&token=${encodeURIComponent(token)}`);
          return;
        }

        const resolvedBookingId = String(resolvePayload?.bookingId || bookingId);
        if (typeof window !== 'undefined' && resolvedBookingId && resolvedBookingId !== bookingId) {
          const qs = new URLSearchParams({ id: resolvedBookingId, token });
          window.history.replaceState({}, '', `/booking/payment?${qs.toString()}`);
        }

        const checkoutResponse = await fetch(`/api/bookings/${resolvedBookingId}/sumup/checkout`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token })
        });
        const checkoutPayload = await checkoutResponse.json().catch(() => ({}));
        if (!alive) return;

        if (!checkoutResponse.ok) {
          throw new Error(checkoutPayload?.error || 'Unable to initialize payment.');
        }

        if (!checkoutPayload?.requiresPayment) {
          navigate(`/booking/confirmed?id=${resolvedBookingId}&token=${encodeURIComponent(token)}`);
          return;
        }

        const checkoutId = String(checkoutPayload?.checkoutId || '').trim();
        if (!checkoutId) {
          throw new Error('Payment session could not be created.');
        }

        const amount = Number(checkoutPayload?.amount);
        const currency = String(checkoutPayload?.currency || 'GBP');
        if (Number.isFinite(amount) && amount > 0) {
          setAmountLabel(`${currency} ${amount.toFixed(2)}`);
        }

        const paymentLink = normalizePaymentLink(String(checkoutPayload?.paymentLink || ''), checkoutId);
        if (!paymentLink) {
          throw new Error('Hosted payment link was not returned.');
        }

        setStatusMessage('Redirecting to SumUp secure checkout...');

        if (typeof window !== 'undefined') {
          window.localStorage.setItem(
            PENDING_PAYMENT_KEY,
            JSON.stringify({
              bookingId,
              resolvedBookingId,
              token,
              checkoutId,
              paymentLink,
              createdAt: Date.now()
            })
          );
        }

        if (typeof window !== 'undefined') {
          window.location.assign(paymentLink);
        }
      } catch (startError) {
        if (!alive) return;
        const message = startError instanceof Error ? startError.message : 'Unable to load payment.';
        setError(message);
        setStatusMessage('Unable to start hosted payment.');
      } finally {
        if (alive) setLoading(false);
      }
    };

    startHostedCheckout();
    return () => {
      alive = false;
    };
  }, [bookingId, token, navigate]);

  return (
    <div className="w-full px-4 py-8 md:py-12 md:max-w-2xl md:mx-auto">
      <div className="mb-6">
        <button
          onClick={back}
          className="bg-transparent border-none cursor-pointer text-zinc-500 hover:text-white transition-colors flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest"
        >
          <i className="fa-solid fa-arrow-left"></i> Back
        </button>
      </div>

      <div className="glass-panel p-6 md:p-8 rounded-[1.5rem] md:rounded-[2rem] border-zinc-800 space-y-6">
        <div className="space-y-2 text-center">
          <h1 className="text-2xl md:text-3xl font-bold uppercase tracking-tighter text-white">Secure Payment</h1>
          {amountLabel && (
            <p className="text-[11px] font-bold uppercase tracking-widest text-amber-500">Amount due: {amountLabel}</p>
          )}
          <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-400">{statusMessage}</p>
        </div>

        {error && (
          <div className="rounded-2xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-red-200 text-center">
            {error}
          </div>
        )}

        {loading && (
          <div className="inline-flex items-center justify-center w-full gap-2 text-[10px] font-bold uppercase tracking-widest text-zinc-400">
            <Spinner className="w-4 h-4 border-zinc-600/40 border-t-zinc-100" />
            Redirecting to SumUp...
          </div>
        )}

        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 px-4 py-4 space-y-2 text-center">
          <div className="flex items-center justify-center gap-2 text-[10px] font-bold uppercase tracking-widest text-zinc-200">
            <i className="fa-solid fa-shield-halved text-amber-400"></i>
            Safe & Secure Payment
          </div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">
            You will be redirected to SumUp to complete payment.
          </p>
        </div>
      </div>
    </div>
  );
}
