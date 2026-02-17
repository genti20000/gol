import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

import { extractBookingToken } from '@/lib/bookingAccessToken';
import { resolvePaymentBooking } from '@/lib/paymentBooking';
import { buildSumupHostedCheckoutUrl, createSumupCheckout, SumupConfigError, SumupRequestError } from '@/lib/sumup';

const supabaseUrl = (process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '').trim();
const supabaseServiceKey = (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();

const webhookPath = '/api/webhooks/sumup';

const isMissingPaymentColumnError = (error: any): boolean => {
  const message = String(error?.message || '').toLowerCase();
  if (error?.code === '42703' || error?.code === 'PGRST204') return true;
  return (
    message.includes('column') &&
    (message.includes('payment_provider') || message.includes('payment_checkout_id'))
  );
};

export async function POST(request: Request, { params }: { params: { id: string } }) {
  const requestId = request.headers.get('x-vercel-id') || request.headers.get('x-request-id') || undefined;

  try {
    if (!supabaseUrl || !supabaseServiceKey) {
      return NextResponse.json({ error: 'Supabase credentials are not configured.' }, { status: 500 });
    }

    const bookingId = String(params.id || '').trim();
    const bookingToken = await extractBookingToken(request);
    if (!bookingToken) {
      return NextResponse.json({ error: 'Access denied.' }, { status: 403 });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const resolved = await resolvePaymentBooking(supabase, bookingId, bookingToken, {
      requestId,
      source: 'api/bookings/[id]/sumup/checkout'
    });

    if (!resolved.ok) {
      return NextResponse.json({ error: resolved.message, code: resolved.code }, { status: resolved.httpStatus });
    }

    const booking = resolved.booking;
    if (booking.status !== 'DRAFT' && booking.status !== 'PENDING' && booking.status !== 'CONFIRMED') {
      return NextResponse.json({ error: `Booking cannot be paid in status ${booking.status}.` }, { status: 400 });
    }

    const dueNow = resolved.dueNow;
    if (dueNow <= 0) {
      return NextResponse.json({ ok: true, requiresPayment: false, amount: 0, alreadyPaid: true });
    }

    const origin = new URL(request.url).origin;
    const redirect = new URL('/booking/processing', origin);
    redirect.searchParams.set('id', booking.id);
    redirect.searchParams.set('token', bookingToken);

    const returnUrl = new URL(webhookPath, origin).toString();

    let checkout;
    try {
      checkout = await createSumupCheckout({
        bookingId: booking.id,
        amount: dueNow,
        description: `Booking ${booking.booking_ref || booking.id}`,
        redirectUrl: redirect.toString(),
        returnUrl
      });
    } catch (error) {
      if (error instanceof SumupConfigError) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
      if (error instanceof SumupRequestError) {
        return NextResponse.json({ error: error.message }, { status: 502 });
      }
      throw error;
    }

    const { error: persistError } = await supabase
      .from('bookings')
      .update({
        payment_provider: 'sumup',
        payment_checkout_id: checkout.id
      } as any)
      .eq('id', booking.id);

    if (persistError && !isMissingPaymentColumnError(persistError)) {
      console.error('[SUMUP CHECKOUT] Failed to persist checkout id.', {
        requestId,
        bookingId: booking.id,
        checkoutId: checkout.id,
        error: persistError
      });
      return NextResponse.json({ error: 'Unable to persist payment checkout.' }, { status: 500 });
    }

    if (persistError) {
      console.warn('[SUMUP CHECKOUT] Payment checkout columns missing; continuing with legacy schema.', {
        requestId,
        bookingId: booking.id,
        checkoutId: checkout.id
      });
    }

    const paymentLink = checkout.hostedCheckoutUrl || buildSumupHostedCheckoutUrl(checkout.id);

    return NextResponse.json({
      ok: true,
      requiresPayment: true,
      checkoutId: checkout.id,
      paymentLink,
      amount: checkout.amount,
      currency: checkout.currency
    });
  } catch (error) {
    console.error('[SUMUP CHECKOUT] Unexpected error creating checkout.', { requestId, error });
    return NextResponse.json({ error: 'Unable to start payment checkout.' }, { status: 500 });
  }
}
