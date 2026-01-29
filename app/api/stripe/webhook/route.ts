import Stripe from 'stripe';
import { NextResponse } from 'next/server';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

import { BookingStatus } from '@/types';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY ?? '', {
  apiVersion: '2024-04-10'
});

type BookingUpdate = {
  status?: BookingStatus;
  deposit_paid?: boolean;
  deposit_forfeited?: boolean;
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

  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object as Stripe.Checkout.Session;
      await updateBookingFromMetadata(supabase, session.metadata, {
        status: BookingStatus.CONFIRMED,
        deposit_paid: true,
        deposit_forfeited: false
      });
      break;
    }
    default:
      break;
  }

  return NextResponse.json({ received: true });
}
