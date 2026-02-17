import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

import { parseBookingId } from '@/lib/adminBookingValidation';
import { isBookingTokenValid } from '@/lib/bookingAccessToken';
import { isDraftExpired } from '@/lib/draftExpiry';
import { getSumupCheckout, SumupConfigError, SumupRequestError } from '@/lib/sumup';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

type ConfirmPayload = {
  token?: string;
  bookingToken?: string;
  checkoutId?: string;
};

const normalizeAmount = (value: unknown): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const PAID_STATUSES = new Set(['PAID', 'SUCCESSFUL', 'SUCCEEDED']);
const FAILED_CHECKOUT_STATUSES = new Set(['FAILED', 'EXPIRED', 'CANCELLED']);

const isMissingPaymentColumnError = (error: any): boolean => {
  const message = String(error?.message || '').toLowerCase();
  if (error?.code === '42703' || error?.code === 'PGRST204') return true;
  return message.includes('column') && message.includes('payment_checkout_id');
};

export async function POST(request: Request, { params }: { params: { id: string } }) {
  try {
    if (!supabaseUrl || !supabaseServiceKey) {
      return NextResponse.json({ error: 'Supabase credentials are not configured.' }, { status: 500 });
    }

    const bookingIdResult = parseBookingId(params.id);
    if (!bookingIdResult.ok) {
      return NextResponse.json({ error: bookingIdResult.error }, { status: 400 });
    }
    const bookingId = bookingIdResult.value as string;

    const payload = (await request.json().catch(() => null)) as ConfirmPayload | null;
    const payloadCheckoutId = String(payload?.checkoutId || '').trim();
    const payloadToken = String(payload?.bookingToken || payload?.token || '').trim();
    const url = new URL(request.url);
    const bookingToken =
      String(request.headers.get('x-booking-token') || '').trim() ||
      String(url.searchParams.get('bookingToken') || url.searchParams.get('token') || '').trim() ||
      payloadToken;
    if (!bookingToken) {
      return NextResponse.json({ error: 'Access denied.' }, { status: 403 });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    let bookingResult = await supabase
      .from('bookings')
      .select('id,status,booking_ref,deposit_amount,deposit_paid,amount_paid,payment_state,payment_checkout_id,booking_access_token,expires_at')
      .eq('id', bookingId)
      .maybeSingle();

    if (bookingResult.error && isMissingPaymentColumnError(bookingResult.error)) {
      bookingResult = await supabase
        .from('bookings')
        .select('id,status,booking_ref,deposit_amount,deposit_paid,amount_paid,payment_state,booking_access_token,expires_at')
        .eq('id', bookingId)
        .maybeSingle();
    }

    const booking = bookingResult.data as any;
    const bookingError = bookingResult.error;

    if (bookingError || !booking) {
      return NextResponse.json({ error: 'Booking not found.' }, { status: 404 });
    }

    if (!isBookingTokenValid(bookingToken, booking.booking_access_token)) {
      return NextResponse.json({ error: 'Access denied.' }, { status: 403 });
    }

    if (isDraftExpired(booking)) {
      await supabase
        .from('bookings')
        .update({ status: 'EXPIRED' })
        .eq('id', bookingId)
        .eq('status', 'DRAFT');
      return NextResponse.json({ error: 'Booking session expired. Please choose another slot.' }, { status: 410 });
    }

    if (booking.status !== 'DRAFT' && booking.status !== 'PENDING' && booking.status !== 'CONFIRMED') {
      return NextResponse.json({ error: `Booking cannot be confirmed in status ${booking.status}.` }, { status: 400 });
    }

    const checkoutId = payloadCheckoutId || String(booking.payment_checkout_id || '').trim();
    if (!checkoutId) {
      return NextResponse.json({ error: 'checkoutId is required.' }, { status: 400 });
    }

    let checkout;
    try {
      checkout = await getSumupCheckout(checkoutId);
    } catch (error) {
      if (error instanceof SumupConfigError) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
      if (error instanceof SumupRequestError) {
        return NextResponse.json({ error: error.message }, { status: 502 });
      }
      throw error;
    }

    if (checkout.checkoutReference && !checkout.checkoutReference.startsWith(`booking-${bookingId}-`)) {
      return NextResponse.json({ error: 'Checkout does not match booking.' }, { status: 400 });
    }

    const checkoutStatus = String(checkout.status || '').toUpperCase();
    if (FAILED_CHECKOUT_STATUSES.has(checkoutStatus)) {
      if (booking.status === 'DRAFT' || booking.status === 'PENDING') {
        await supabase
          .from('bookings')
          .update({ status: 'FAILED' })
          .eq('id', bookingId)
          .in('status', ['DRAFT', 'PENDING']);
      }
      return NextResponse.json({ error: `Payment ${checkoutStatus.toLowerCase()}.` }, { status: 402 });
    }

    if (!PAID_STATUSES.has(checkoutStatus)) {
      return NextResponse.json({ error: `Payment not completed yet (${checkoutStatus || 'UNKNOWN'}).` }, { status: 409 });
    }

    const alreadyPaid = String(booking.payment_state || '').toUpperCase() === 'PAID' || Boolean(booking.deposit_paid);
    if (booking.status === 'CONFIRMED' && alreadyPaid) {
      return NextResponse.json({ ok: true, alreadyConfirmed: true, alreadyPaid: true });
    }

    const depositAmount = normalizeAmount(booking.deposit_amount);
    const amountPaid = normalizeAmount(booking.amount_paid);
    const dueNow = Boolean(booking.deposit_paid)
      ? 0
      : Math.max(0, depositAmount - amountPaid);

    if (checkout.amount + 0.009 < dueNow) {
      return NextResponse.json({ error: 'Paid amount is lower than expected.' }, { status: 409 });
    }

    return NextResponse.json(
      {
        ok: true,
        message: 'Payment captured. Waiting for webhook confirmation.',
        bookingId,
        checkoutStatus
      },
      { status: 202 }
    );
  } catch (error) {
    console.error('Unexpected error confirming SumUp payment.', error);
    return NextResponse.json({ error: 'Unable to verify payment.' }, { status: 500 });
  }
}
