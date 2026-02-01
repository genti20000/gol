import Stripe from 'stripe';
import { NextResponse } from 'next/server';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

import { BookingStatus } from '@/types';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY ?? '', {
  apiVersion: '2024-04-10'
});

type BookingUpdate = {
  status?: BookingStatus;
  confirmed_at?: string | null;
  deposit_paid?: boolean;
  amount_charged?: number;
  payment_intent_id?: string | null;
  notes?: string;
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
  update: BookingUpdate
) => {
  if (!metadata?.booking_id) {
    console.warn('Stripe webhook metadata missing booking_id.');
    return { ok: false };
  }

  const bookingId = metadata.booking_id;
  console.log('Stripe webhook booking update', { bookingId, update });
  const { error } = await supabase
    .from('bookings')
    .update(update)
    .eq('id', bookingId);

  if (error) {
    console.error('Failed updating booking from Stripe webhook.', error);
    return { ok: false };
  }

  return { ok: true };
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

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as Stripe.Checkout.Session;
    const amountCharged =
      typeof session.amount_total === 'number' ? session.amount_total / 100 : 0;
    const update: BookingUpdate = {
      status: BookingStatus.CONFIRMED,
      confirmed_at: new Date().toISOString(),
      deposit_paid: true,
      amount_charged: amountCharged,
      payment_intent_id: typeof session.payment_intent === 'string' ? session.payment_intent : null
    };
    await updateBookingFromMetadata(supabase, session.metadata, update);
  }

  if (event.type === 'checkout.session.expired') {
    const session = event.data.object as Stripe.Checkout.Session;
    const update: BookingUpdate = {
      status: BookingStatus.CANCELLED,
      notes: 'Session expired without payment.'
    };
    await updateBookingFromMetadata(supabase, session.metadata, update);
  }


  return NextResponse.json({ received: true });
}
