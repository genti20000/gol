import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  const payload = await request.text();
  const signature = request.headers.get('stripe-signature');

  // TODO: Implement Stripe Webhook signature verification and logic
  // const event = stripe.webhooks.constructEvent(payload, signature, endpointSecret);

  return NextResponse.json({ received: true });
}