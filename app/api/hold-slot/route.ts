import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

type HoldSlotRequest = {
  service_id?: string;
  date?: string;
  start_time?: string;
  session_id?: string;
};

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function POST(request: Request) {
  try {
    if (!supabaseUrl || !supabaseServiceKey) {
      return NextResponse.json({ error: 'Supabase credentials are not configured.' }, { status: 500 });
    }

    const payload = (await request.json().catch(() => null)) as HoldSlotRequest | null;
    if (!payload) {
      return NextResponse.json({ error: 'Invalid request payload.' }, { status: 400 });
    }

    const serviceId = String(payload.service_id || '').trim();
    const date = String(payload.date || '').trim();
    const startTime = String(payload.start_time || '').trim();
    const sessionId = String(payload.session_id || '').trim();

    if (!serviceId || !date || !startTime || !sessionId) {
      return NextResponse.json({ error: 'Missing required hold input.' }, { status: 400 });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { data, error } = await supabase.rpc('create_slot_hold_atomic', {
      p_service_id: serviceId,
      p_date: date,
      p_start_time: startTime,
      p_session_id: sessionId
    });

    const row = Array.isArray(data) ? data[0] : data;
    if (error || !row) {
      return NextResponse.json({ error: 'Unable to reserve slot.' }, { status: 500 });
    }

    if (row.conflict) {
      return NextResponse.json(
        {
          code: 'SLOT_TAKEN',
          message: 'That time is no longer available.'
        },
        { status: 409 }
      );
    }

    return NextResponse.json(
      { ok: true, expires_at: row.expires_at },
      {
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0'
        }
      }
    );
  } catch (error) {
    console.error('[HOLD_SLOT] Unexpected error', error);
    return NextResponse.json({ error: 'Unable to reserve slot.' }, { status: 500 });
  }
}
