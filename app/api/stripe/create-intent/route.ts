import { NextResponse } from 'next/server';
import Stripe from 'stripe';

const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
const stripe = stripeSecretKey
  ? new Stripe(stripeSecretKey, {
      apiVersion: '2024-04-10',
    })
  : null;

export async function POST(request: Request) {
  try {
    if (!stripe) {
      return NextResponse.json(
        { error: 'Stripe is not configured on the server.' },
        { status: 500 },
      );
    }

    const body = await request.json();
    const { amount, currency, bookingMetadata } = body ?? {};

    if (typeof amount !== 'number' || !Number.isInteger(amount) || amount <= 0) {
      return NextResponse.json(
        { error: 'Amount must be a positive integer in the smallest currency unit.' },
        { status: 400 },
      );
    }

    if (typeof currency !== 'string' || currency.trim().length === 0) {
      return NextResponse.json(
        { error: 'Currency is required as a non-empty string.' },
        { status: 400 },
      );
    }

    if (
      bookingMetadata !== undefined &&
      (bookingMetadata === null ||
        typeof bookingMetadata !== 'object' ||
        Array.isArray(bookingMetadata))
    ) {
      return NextResponse.json(
        { error: 'Booking metadata must be an object when provided.' },
        { status: 400 },
      );
    }

    const paymentIntent = await stripe.paymentIntents.create({
      amount,
      currency: currency.toLowerCase(),
      metadata: bookingMetadata ?? undefined,
    });

    return NextResponse.json({ 
      clientSecret: paymentIntent.client_secret,
      id: paymentIntent.id,
    });
  } catch (error: unknown) {
    if (error instanceof Stripe.errors.StripeError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.statusCode ?? 400 },
      );
    }

    const message = error instanceof Error ? error.message : 'Unexpected error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
