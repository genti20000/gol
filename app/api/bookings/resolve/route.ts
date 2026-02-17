import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

import { resolvePaymentBooking } from '@/lib/paymentBooking';

const supabaseUrl = (process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '').trim();
const supabaseServiceKey = (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();

type ResolvePayload = {
  id?: string;
  token?: string;
};

export async function POST(request: Request) {
  const requestId = request.headers.get('x-vercel-id') || request.headers.get('x-request-id') || undefined;

  try {
    if (!supabaseUrl || !supabaseServiceKey) {
      return NextResponse.json({ error: 'Supabase credentials are not configured.' }, { status: 500 });
    }

    const payload = (await request.json().catch(() => null)) as ResolvePayload | null;
    const bookingId = String(payload?.id || '').trim();
    const bookingToken = String(payload?.token || '').trim();

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const resolved = await resolvePaymentBooking(supabase, bookingId, bookingToken, {
      requestId,
      source: 'api/bookings/resolve'
    });

    if (!resolved.ok) {
      return NextResponse.json({ error: resolved.message, code: resolved.code }, { status: resolved.httpStatus });
    }

    return NextResponse.json({
      ok: true,
      bookingId: resolved.booking.id,
      status: resolved.booking.status,
      paymentState: resolved.booking.payment_state,
      alreadyPaid: resolved.alreadyPaid,
      dueNow: resolved.dueNow,
      requiresPayment: resolved.dueNow > 0
    });
  } catch (error) {
    console.error('[PAYMENT_RESOLVE] Unexpected resolve error.', { requestId, error });
    return NextResponse.json({ error: 'Unable to resolve booking for payment.' }, { status: 500 });
  }
}
