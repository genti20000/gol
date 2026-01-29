import Stripe from 'stripe';
import { NextResponse } from 'next/server';

import { supabase } from '@/lib/supabase';
import { BookingStatus } from '@/types';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY ?? '', {
  apiVersion: '2024-04-10'
});

const updateBookingFromMetadata = async (
  metadata: Stripe.Metadata | null | undefined,
  update: { status?: BookingStatus; deposit_paid?: boolean; deposit_forfeited?: boolean }
) => {
  if (!metadata) {
    console.warn('Stripe webhook missing metadata for booking reconciliation.');
    return { ok: false };
  }

  const bookingId = metadata.bookingId || metadata.booking_id;
  const bookingRef = metadata.bookingRef || metadata.booking_ref;

  if (bookingId) {
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

  if (!signature) {
    return NextResponse.json({ error: 'Missing Stripe signature.' }, { status: 400 });
  }

  if (!webhookSecret) {
    console.error('STRIPE_WEBHOOK_SECRET is not set.');
    return NextResponse.json({ error: 'Webhook secret not configured.' }, { status: 500 });
  }

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(payload, signature, webhookSecret);
  } catch (error) {
    console.error('Stripe webhook signature verification failed.', error);
    return NextResponse.json({ error: 'Invalid Stripe signature.' }, { status: 400 });
  }

  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object as Stripe.Checkout.Session;
      await updateBookingFromMetadata(session.metadata, {
        status: BookingStatus.CONFIRMED,
        deposit_paid: true,
        deposit_forfeited: false
      });
      break;
    }
    case 'payment_intent.succeeded': {
      const intent = event.data.object as Stripe.PaymentIntent;
      await updateBookingFromMetadata(intent.metadata, {
        status: BookingStatus.CONFIRMED,
        deposit_paid: true,
        deposit_forfeited: false
      });
      break;
    }
    case 'payment_intent.payment_failed':
    case 'payment_intent.canceled': {
      const intent = event.data.object as Stripe.PaymentIntent;
      await updateBookingFromMetadata(intent.metadata, {
        status: BookingStatus.CANCELLED,
        deposit_paid: false,
        deposit_forfeited: true
      });
      break;
    }
    default:
      break;
  }

  return NextResponse.json({ received: true });
}
