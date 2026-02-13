import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

import { getLiveAvailability } from '@/lib/liveAvailability';

type AvailabilityRequest = {
  date?: string;
  guests?: number | string;
  extraHours?: number | string;
  serviceId?: string | null;
  staffId?: string | null;
};

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const toNumber = (value: number | string | undefined, fallback = 0) => {
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

export async function POST(request: Request) {
  try {
    if (!supabaseUrl || !supabaseServiceKey) {
      return NextResponse.json({ error: 'Supabase credentials are not configured.' }, { status: 500 });
    }

    const payload = (await request.json().catch(() => null)) as AvailabilityRequest | null;
    if (!payload) {
      return NextResponse.json({ error: 'Invalid request payload.' }, { status: 400 });
    }

    const date = String(payload.date || '').trim();
    const guests = toNumber(payload.guests, NaN as unknown as number);
    const extraHours = Math.max(0, toNumber(payload.extraHours, 0));
    const serviceId = String(payload.serviceId || '').trim();
    if (!date || !serviceId || !Number.isFinite(guests)) {
      return NextResponse.json({ error: 'Missing required availability input.' }, { status: 400 });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const validTimes = await getLiveAvailability(supabase, {
      date,
      guests,
      extraHours,
      serviceId
    });

    return NextResponse.json(
      { validTimes },
      {
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0'
        }
      }
    );
  } catch (error) {
    console.error('[AVAILABILITY] Unexpected error', error);
    return NextResponse.json({ error: 'Unable to refresh availability.' }, { status: 500 });
  }
}
