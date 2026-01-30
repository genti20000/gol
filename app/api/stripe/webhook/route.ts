import Stripe from 'stripe';
import { NextResponse } from 'next/server';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

import { BookingStatus } from '@/types';
import { buildStripeBookingUpdate } from '@/lib/stripeBookingLogic';
import { computeAmountDueNow, normalizeAmount } from '@/lib/paymentLogic';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY ?? '', {
  apiVersion: '2024-04-10'
});

type BookingUpdate = {
  status?: BookingStatus;
  deposit_paid?: boolean;
  deposit_forfeited?: boolean;
  amount_paid?: number;
  stripe_session_id?: string;
  stripe_payment_intent_id?: string;
};

type Database = {
  public: {
    Tables: {
      bookings: {
        Row: Record<string, unknown>;
        Insert: Record<string, unknown>;
        Update: BookingUpdate;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};

const updateBookingFromMetadata = async (
  supabase: SupabaseClient<Database>,
  metadata: Stripe.Metadata | null | undefined,
  update: BookingUpdate,
  amountTotal?: number
) => {
  if (!metadata) {
    console.warn('Stripe webhook missing metadata for booking reconciliation.');
    return { ok: false };
  }

  const bookingId = metadata.bookingId || metadata.booking_id;
  const bookingRef = metadata.bookingRef || metadata.booking_ref;

  if (bookingId) {
    const { data: booking, error: bookingError } = await supabase
      .from('bookings')
      .select('id,status,deposit_paid,total_price,stripe_session_id,stripe_payment_intent_id')
      .eq('id', bookingId)
      .single();

    if (bookingError || !booking) {
      console.error('Failed to load booking for Stripe webhook.', bookingError);
      return { ok: false };
    }

    const { data: settings, error: settingsError } = await supabase
      .from('venue_settings')
      .select('deposit_enabled,deposit_amount')
      .single();

    if (settingsError) {
      console.error('Failed to load venue settings for Stripe webhook.', settingsError);
      return { ok: false };
    }

    const dueNow = computeAmountDueNow({
      totalPrice: normalizeAmount(booking.total_price),
      depositEnabled: Boolean(settings?.deposit_enabled),
      depositAmount: normalizeAmount(settings?.deposit_amount)
    });

    if (typeof amountTotal === 'number' && Math.round(dueNow * 100) !== Math.round(amountTotal * 100)) {
      console.error('Stripe webhook amount mismatch.', { bookingId, dueNow, amountTotal });
      return { ok: false };
    }

    if (
      booking.status === BookingStatus.CONFIRMED &&
      booking.deposit_paid === true &&
      (update.stripe_session_id ? booking.stripe_session_id === update.stripe_session_id : true) &&
      (update.stripe_payment_intent_id
        ? booking.stripe_payment_intent_id === update.stripe_payment_intent_id
        : true)
    ) {
      return { ok: true };
    }

    console.log('Stripe webhook booking update', { bookingId, update });
    const { error } = await supabase
      .from('bookings')
      .update(update)
      .eq('id', bookingId);

    if (error) {
      console.error('Failed updating booking by id from Stripe webhook.', error);
      return { ok: false };
    }

    return { ok: true };
  }

  if (bookingRef) {
    console.log('Stripe webhook booking update', { bookingRef, update });
    const { data: booking, error: bookingError } = await supabase
      .from('bookings')
      .select('id,status,deposit_paid,total_price,stripe_session_id,stripe_payment_intent_id')
      .eq('booking_ref', bookingRef)
      .single();

    if (bookingError || !booking) {
      console.error('Failed to load booking for Stripe webhook.', bookingError);
      return { ok: false };
    }

    const { data: settings, error: settingsError } = await supabase
      .from('venue_settings')
      .select('deposit_enabled,deposit_amount')
      .single();

    if (settingsError) {
      console.error('Failed to load venue settings for Stripe webhook.', settingsError);
      return { ok: false };
    }

    const dueNow = computeAmountDueNow({
      totalPrice: normalizeAmount(booking.total_price),
      depositEnabled: Boolean(settings?.deposit_enabled),
      depositAmount: normalizeAmount(settings?.deposit_amount)
    });

    if (typeof amountTotal === 'number' && Math.round(dueNow * 100) !== Math.round(amountTotal * 100)) {
      console.error('Stripe webhook amount mismatch.', { bookingRef, dueNow, amountTotal });
      return { ok: false };
    }

    if (
      booking.status === BookingStatus.CONFIRMED &&
      booking.deposit_paid === true &&
      (update.stripe_session_id ? booking.stripe_session_id === update.stripe_session_id : true) &&
      (update.stripe_payment_intent_id
        ? booking.stripe_payment_intent_id === update.stripe_payment_intent_id
        : true)
    ) {
      return { ok: true };
    }

    const { error } = await supabase
      .from('bookings')
      .update(update)
      .eq('booking_ref', bookingRef);

    if (error) {
      console.error('Failed updating booking by ref from Stripe webhook.', error);
      return { ok: false };
    }

    return { ok: true };
  }

  console.warn('Stripe webhook metadata missing booking identifiers.');
  return { ok: false };
};

export async function POST(request: Request) {
  const payload = await request.text();
  const signature = request.headers.get('stripe-signature');
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!signature) {
    return NextResponse.json({ error: 'Missing Stripe signature.' }, { status: 400 });
  }

  if (!webhookSecret) {
    console.error('STRIPE_WEBHOOK_SECRET is not set.');
    return NextResponse.json({ error: 'Webhook secret not configured.' }, { status: 500 });
  }

  if (!supabaseUrl || !supabaseServiceKey) {
    console.error('Supabase service credentials are not configured.');
    return NextResponse.json({ error: 'Supabase credentials not configured.' }, { status: 500 });
  }

  const supabase = createClient<Database>(supabaseUrl, supabaseServiceKey);

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(payload, signature, webhookSecret);
  } catch (error) {
    console.error('Stripe webhook signature verification failed.', error);
    return NextResponse.json({ error: 'Invalid Stripe signature.' }, { status: 400 });
  }

  console.log('Stripe webhook event received', { type: event.type });

  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object as Stripe.Checkout.Session;
      const amountPaid = typeof session.amount_total === 'number' ? session.amount_total / 100 : undefined;
      const update = buildStripeBookingUpdate({
        amountPaid,
        stripeSessionId: session.id,
        stripePaymentIntentId: typeof session.payment_intent === 'string' ? session.payment_intent : undefined
      });
      await updateBookingFromMetadata(supabase, session.metadata, update, amountPaid);
      break;
    }
    case 'payment_intent.succeeded': {
      const intent = event.data.object as Stripe.PaymentIntent;
      const amountPaid = typeof intent.amount_received === 'number' ? intent.amount_received / 100 : undefined;
      const update = buildStripeBookingUpdate({
        amountPaid,
        stripePaymentIntentId: intent.id
      });
      await updateBookingFromMetadata(supabase, intent.metadata, update, amountPaid);
      break;
    }
    default:
      break;
  }

  return NextResponse.json({ received: true });
}
