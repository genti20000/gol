import { randomUUID } from 'crypto';

import { isBookingTokenValid } from '@/lib/bookingAccessToken';
import { isDraftExpired } from '@/lib/draftExpiry';
import { parseBookingId } from '@/lib/adminBookingValidation';

export const maskToken = (value: string): string => {
  const token = String(value || '').trim();
  if (!token) return '[empty]';
  if (token.length <= 8) return `${token.slice(0, 2)}***`;
  return `${token.slice(0, 4)}...${token.slice(-4)}`;
};

export type PaymentBookingRecord = {
  id: string;
  status: string;
  booking_ref: string | null;
  total_price: number | null;
  deposit_amount: number | null;
  deposit_paid: boolean | null;
  amount_paid: number | null;
  payment_state: string | null;
  booking_access_token: string | null;
  expires_at: string | null;
};

type ResolveContext = {
  requestId?: string;
  source: string;
};

type ResolveFail = {
  ok: false;
  httpStatus: 400 | 404 | 410;
  code: 'INVALID_PARAMS' | 'BOOKING_NOT_FOUND' | 'BOOKING_EXPIRED';
  message: string;
};

type ResolveSuccess = {
  ok: true;
  booking: PaymentBookingRecord;
  dueNow: number;
  alreadyPaid: boolean;
};

export type ResolvePaymentBookingResult = ResolveFail | ResolveSuccess;

const normalizeAmount = (value: unknown): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const computeDueNow = (booking: PaymentBookingRecord): number => {
  const depositPaid = Boolean(booking.deposit_paid);
  const depositAmount = normalizeAmount(booking.deposit_amount);
  const amountPaid = normalizeAmount(booking.amount_paid);

  if (depositPaid) return 0;
  return Math.max(0, depositAmount - amountPaid);
};

const isTerminalStatus = (status: string): boolean => {
  return status === 'CANCELLED' || status === 'FAILED' || status === 'EXPIRED';
};

const safeRequestId = (requestId?: string): string => {
  return requestId || randomUUID();
};

const selectFields =
  'id,status,booking_ref,total_price,deposit_amount,deposit_paid,amount_paid,payment_state,booking_access_token,expires_at';

export async function resolvePaymentBooking(
  supabase: any,
  bookingIdRaw: string,
  bookingTokenRaw: string,
  context: ResolveContext
): Promise<ResolvePaymentBookingResult> {
  const requestId = safeRequestId(context.requestId);
  const bookingId = String(bookingIdRaw || '').trim();
  const bookingToken = String(bookingTokenRaw || '').trim();

  const bookingIdResult = parseBookingId(bookingId);
  if (!bookingIdResult.ok || !bookingToken) {
    console.warn('[PAYMENT_RESOLVE] Invalid params.', {
      requestId,
      source: context.source,
      bookingId,
      tokenMasked: maskToken(bookingToken)
    });
    return {
      ok: false,
      httpStatus: 400,
      code: 'INVALID_PARAMS',
      message: 'Invalid booking link.'
    };
  }

  const { data: bookingData, error } = await supabase
    .from('bookings')
    .select(selectFields)
    .eq('id', bookingId)
    .maybeSingle();
  let booking = (bookingData || null) as PaymentBookingRecord | null;

  if (error) {
    console.error('[PAYMENT_RESOLVE] Booking lookup failed.', {
      requestId,
      source: context.source,
      bookingId,
      tokenMasked: maskToken(bookingToken),
      error
    });
  }

  const tokenMismatch = Boolean(booking && !isBookingTokenValid(bookingToken, booking.booking_access_token));
  if (!booking || tokenMismatch) {
    const { data: byTokenData, error: byTokenError } = await supabase
      .from('bookings')
      .select(selectFields)
      .eq('booking_access_token', bookingToken)
      .maybeSingle();

    if (byTokenError) {
      console.error('[PAYMENT_RESOLVE] Token lookup failed.', {
        requestId,
        source: context.source,
        bookingId,
        tokenMasked: maskToken(bookingToken),
        error: byTokenError
      });
    }

    const byToken = (byTokenData || null) as PaymentBookingRecord | null;
    if (byToken) {
      booking = byToken;
      if (byToken.id !== bookingId) {
        console.info('[PAYMENT_RESOLVE] Recovered canonical booking id from token.', {
          requestId,
          source: context.source,
          requestedBookingId: bookingId,
          resolvedBookingId: byToken.id
        });
      }
    }
  }

  if (!booking || !isBookingTokenValid(bookingToken, booking.booking_access_token)) {
    console.warn('[PAYMENT_RESOLVE] Booking missing or token mismatch.', {
      requestId,
      source: context.source,
      bookingId,
      tokenMasked: maskToken(bookingToken)
    });
    return {
      ok: false,
      httpStatus: 404,
      code: 'BOOKING_NOT_FOUND',
      message: 'Booking not found.'
    };
  }

  if (isDraftExpired(booking) || isTerminalStatus(String(booking.status || ''))) {
    if (String(booking.status || '') === 'DRAFT' && isDraftExpired(booking)) {
      await supabase
        .from('bookings')
        .update({ status: 'EXPIRED' })
        .eq('id', booking.id)
        .eq('status', 'DRAFT');
    }

    console.info('[PAYMENT_RESOLVE] Booking expired/invalid for payment.', {
      requestId,
      source: context.source,
      bookingId: booking.id,
      status: booking.status
    });
    return {
      ok: false,
      httpStatus: 410,
      code: 'BOOKING_EXPIRED',
      message: 'Booking link expired.'
    };
  }

  const dueNow = computeDueNow(booking);
  const alreadyPaid = dueNow <= 0 || String(booking.payment_state || '').toUpperCase() === 'PAID';

  return {
    ok: true,
    booking,
    dueNow,
    alreadyPaid
  };
}
