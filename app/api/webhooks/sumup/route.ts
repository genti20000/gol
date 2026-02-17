import { createHmac, randomUUID, timingSafeEqual } from 'crypto';
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const webhookSecret = String(process.env.WEBHOOK_SECRET || '').trim();

const PAID_STATUSES = new Set(['PAID', 'SUCCESSFUL', 'SUCCEEDED']);

const normalizeAmount = (value: unknown): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const parseSignatureCandidates = (headerValue: string): string[] => {
  if (!headerValue) return [];
  return headerValue
    .split(/[,\s]/g)
    .map((part) => {
      const value = part.includes('=') ? part.split('=').pop() || '' : part;
      return value.trim().toLowerCase();
    })
    .filter((value) => /^[a-f0-9]{64}$/.test(value));
};

const isValidSignature = (rawBody: string, signatureHeader: string): boolean => {
  const candidates = parseSignatureCandidates(signatureHeader);
  if (candidates.length === 0) return false;
  const expected = createHmac('sha256', webhookSecret).update(rawBody, 'utf8').digest('hex');
  const expectedBuffer = Buffer.from(expected, 'hex');
  return candidates.some((candidate) => {
    const candidateBuffer = Buffer.from(candidate, 'hex');
    if (candidateBuffer.length !== expectedBuffer.length) return false;
    return timingSafeEqual(candidateBuffer, expectedBuffer);
  });
};

const isMissingColumnError = (error: any, column: string): boolean => {
  const message = String(error?.message || '').toLowerCase();
  if (error?.code === '42703' || error?.code === 'PGRST204') return true;
  return message.includes('column') && message.includes(column.toLowerCase());
};

const getEventId = (payload: any, request: Request): string => {
  const fromBody = payload?.event_id || payload?.eventId || payload?.id;
  const fromHeader = request.headers.get('x-event-id') || request.headers.get('x-sumup-event-id');
  const value = String(fromBody || fromHeader || '').trim();
  return value || `sumup-${randomUUID()}`;
};

const getCheckoutId = (payload: any): string => {
  const value =
    payload?.checkout_id ||
    payload?.checkoutId ||
    payload?.payload?.checkout_id ||
    payload?.payload?.checkoutId ||
    payload?.payload?.id ||
    payload?.data?.checkout_id ||
    payload?.data?.checkoutId ||
    payload?.data?.id ||
    payload?.id;
  return String(value || '').trim();
};

const getCheckoutReference = (payload: any): string => {
  const value =
    payload?.checkout_reference ||
    payload?.checkoutReference ||
    payload?.payload?.checkout_reference ||
    payload?.payload?.checkoutReference ||
    payload?.data?.checkout_reference ||
    payload?.data?.checkoutReference;
  return String(value || '').trim();
};

const getStatus = (payload: any): string => {
  const value =
    payload?.status ||
    payload?.payload?.status ||
    payload?.data?.status ||
    payload?.data?.checkout_status;
  return String(value || '').trim().toUpperCase();
};

const getPaidAmount = (payload: any): number => {
  const amountValue =
    payload?.amount ??
    payload?.payload?.amount ??
    payload?.data?.amount ??
    payload?.data?.checkout?.amount ??
    payload?.transaction?.amount;
  return normalizeAmount(amountValue);
};

const deriveBookingIdFromReference = (reference: string): string | null => {
  const value = String(reference || '').trim();
  if (!value.startsWith('booking-')) return null;
  const remainder = value.slice('booking-'.length);
  const suffixIndex = remainder.lastIndexOf('-');
  if (suffixIndex <= 0) return null;
  const bookingId = remainder.slice(0, suffixIndex).trim();
  return bookingId || null;
};

export async function POST(request: Request) {
  const requestId = request.headers.get('x-request-id') || randomUUID();

  try {
    if (!supabaseUrl || !supabaseServiceKey) {
      return NextResponse.json({ ok: false, error: 'Supabase credentials are not configured.' }, { status: 500 });
    }

    const rawBody = await request.text();
    const signatureHeader =
      request.headers.get('x-sumup-signature') ||
      request.headers.get('sumup-signature') ||
      request.headers.get('x-signature') ||
      request.headers.get('signature') ||
      '';

    if (webhookSecret) {
      if (!isValidSignature(rawBody, signatureHeader)) {
        console.error('[SUMUP WEBHOOK] Signature validation failed.', { requestId });
        return NextResponse.json({ ok: false, error: 'Invalid signature.' }, { status: 401 });
      }
    } else {
      console.warn('[SUMUP WEBHOOK] WEBHOOK_SECRET is not configured. Signature validation skipped.');
    }

    const payload = JSON.parse(rawBody || '{}');
    const eventId = getEventId(payload, request);
    const checkoutId = getCheckoutId(payload);
    const checkoutReference = getCheckoutReference(payload);
    const status = getStatus(payload);
    const paidAmount = getPaidAmount(payload);

    if (!checkoutId) {
      return NextResponse.json({ ok: false, error: 'Missing checkout id.' }, { status: 400 });
    }

    if (!PAID_STATUSES.has(status)) {
      return NextResponse.json({ ok: true, ignored: true, reason: `Unsupported status ${status || 'UNKNOWN'}.` });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    let booking: any = null;
    let lookupError: any = null;
    const byCheckout = await supabase
      .from('bookings')
      .select('id,status,payment_state,payment_event_id,payment_checkout_id,deposit_amount,amount_paid,confirmed_at')
      .eq('payment_checkout_id', checkoutId)
      .maybeSingle();

    if (byCheckout.error && !isMissingColumnError(byCheckout.error, 'payment_checkout_id')) {
      lookupError = byCheckout.error;
    }

    if (byCheckout.data) {
      booking = byCheckout.data;
    }

    if (!booking) {
      const bookingIdFromReference = deriveBookingIdFromReference(checkoutReference);
      if (bookingIdFromReference) {
        const byId = await supabase
          .from('bookings')
          .select('id,status,payment_state,payment_event_id,payment_checkout_id,deposit_amount,amount_paid,confirmed_at')
          .eq('id', bookingIdFromReference)
          .maybeSingle();
        if (!byId.error && byId.data) {
          booking = byId.data;
        } else if (byId.error && !lookupError) {
          lookupError = byId.error;
        }
      }
    }

    if (!booking) {
      if (lookupError) {
        console.error('[SUMUP WEBHOOK] Booking lookup failed.', { requestId, checkoutId, eventId, error: lookupError });
      }
      return NextResponse.json({ ok: false, error: 'Booking not found for checkout id.' }, { status: 404 });
    }

    const alreadyPaid = String(booking.payment_state || '').toUpperCase() === 'PAID';
    const alreadyProcessedEvent = Boolean(booking.payment_event_id && booking.payment_event_id === eventId);
    if (alreadyPaid || alreadyProcessedEvent) {
      return NextResponse.json({ ok: true, duplicate: true, bookingId: booking.id });
    }

    const nowIso = new Date().toISOString();
    const amountPaid = Math.max(
      normalizeAmount(booking.amount_paid),
      paidAmount,
      normalizeAmount(booking.deposit_amount)
    );

    const baseUpdate = {
      payment_state: 'PAID',
      status: 'CONFIRMED',
      deposit_paid: true,
      amount_paid: amountPaid,
      confirmed_at: booking.confirmed_at || nowIso
    } as Record<string, any>;

    const extendedUpdate = {
      ...baseUpdate,
      payment_provider: 'sumup',
      payment_checkout_id: checkoutId,
      payment_event_id: eventId
    } as Record<string, any>;

    let updateResult = await supabase
      .from('bookings')
      .update(extendedUpdate as any)
      .eq('id', booking.id)
      .select('id,payment_state,status,payment_event_id')
      .maybeSingle();

    if (updateResult.error) {
      const missingPaymentMetadata =
        isMissingColumnError(updateResult.error, 'payment_provider') ||
        isMissingColumnError(updateResult.error, 'payment_event_id') ||
        isMissingColumnError(updateResult.error, 'payment_checkout_id');

      if (missingPaymentMetadata) {
        updateResult = await supabase
          .from('bookings')
          .update(baseUpdate as any)
          .eq('id', booking.id)
          .select('id,payment_state,status')
          .maybeSingle();
      }
    }

    if (updateResult.error || !updateResult.data) {
      console.error('[SUMUP WEBHOOK] Failed to update booking.', {
        requestId,
        checkoutId,
        eventId,
        bookingId: booking.id,
        error: updateResult.error
      });
      return NextResponse.json({ ok: false, error: 'Failed to update booking payment state.' }, { status: 500 });
    }

    return NextResponse.json({
      ok: true,
      bookingId: booking.id,
      paymentState: updateResult.data.payment_state
    });
  } catch (error) {
    console.error('[SUMUP WEBHOOK] Unexpected error.', { requestId, error });
    return NextResponse.json({ ok: false, error: 'Webhook processing failed.' }, { status: 500 });
  }
}
