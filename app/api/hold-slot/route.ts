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

const DEV = process.env.NODE_ENV !== 'production';

const normalizeTime = (raw: string) => {
  const value = raw.trim();
  const match = value.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
  if (!match) return null;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  const second = Number(match[3] ?? '0');
  if (!Number.isFinite(hour) || !Number.isFinite(minute) || !Number.isFinite(second)) return null;
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59 || second < 0 || second > 59) return null;
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:${String(second).padStart(2, '0')}`;
};

const jsonError = (status: number, code: string, detail: string) =>
  NextResponse.json(
    {
      ok: false,
      code,
      detail
    },
    { status }
  );

export async function POST(request: Request) {
  try {
    if (!supabaseUrl || !supabaseServiceKey) {
      return jsonError(500, 'SUPABASE_NOT_CONFIGURED', 'Supabase credentials are not configured.');
    }

    const payload = (await request.json().catch(() => null)) as HoldSlotRequest | null;
    if (!payload) {
      return jsonError(400, 'INVALID_PAYLOAD', 'Invalid request payload.');
    }

    const serviceId = String(payload.service_id || '').trim();
    const date = String(payload.date || '').trim();
    const startTimeRaw = String(payload.start_time || '').trim();
    const sessionId = String(payload.session_id || '').trim();
    const normalizedStartTime = normalizeTime(startTimeRaw);

    if (!serviceId || !date || !sessionId || !normalizedStartTime) {
      return jsonError(400, 'INVALID_INPUT', 'Missing or invalid hold input.');
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    if (DEV) {
      console.info('[HOLD_SLOT] request', {
        serviceId,
        date,
        startTime: normalizedStartTime,
        sessionIdSuffix: sessionId.slice(-6)
      });
    }

    const { data, error: rpcError } = await supabase.rpc('create_slot_hold_atomic', {
      p_service_id: serviceId,
      p_date: date,
      p_start_time: normalizedStartTime,
      p_session_id: sessionId
    });

    const row = Array.isArray(data) ? data[0] : data;
    if (rpcError || !row) {
      const rpcCode = String((rpcError as any)?.code || '');
      const rpcDetail = String((rpcError as any)?.message || '');

      if (DEV) {
        console.warn('[HOLD_SLOT] RPC failed', { rpcCode, rpcDetail });
      }

      // Fallback path if function migration has not been applied yet or RPC errors unexpectedly.
      await supabase.from('slot_holds').delete().lte('expires_at', new Date().toISOString());

      const { data: bookedRow, error: bookedError } = await supabase
        .from('bookings')
        .select('id')
        .eq('service_id', serviceId)
        .eq('booking_date', date)
        .eq('start_time', normalizedStartTime)
        .in('status', ['CONFIRMED', 'PENDING'])
        .limit(1)
        .maybeSingle();
      if (bookedError) {
        if (DEV) {
          console.warn('[HOLD_SLOT] fallback bookings check failed', bookedError);
        }
        return jsonError(500, 'HOLD_FALLBACK_FAILED', 'Unable to reserve slot right now.');
      }
      if (bookedRow) {
        return jsonError(409, 'SLOT_TAKEN', 'That time is no longer available.');
      }

      const { data: heldByOther, error: heldError } = await supabase
        .from('slot_holds')
        .select('id')
        .eq('service_id', serviceId)
        .eq('date', date)
        .eq('start_time', normalizedStartTime)
        .gt('expires_at', new Date().toISOString())
        .neq('session_id', sessionId)
        .limit(1)
        .maybeSingle();
      if (heldError) {
        if (DEV) {
          console.warn('[HOLD_SLOT] fallback hold conflict check failed', heldError);
        }
        return jsonError(500, 'HOLD_FALLBACK_FAILED', 'Unable to reserve slot right now.');
      }
      if (heldByOther) {
        return jsonError(409, 'SLOT_TAKEN', 'That time is no longer available.');
      }

      const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString();
      const { error: upsertError } = await supabase.from('slot_holds').upsert(
        {
          service_id: serviceId,
          date,
          start_time: normalizedStartTime,
          session_id: sessionId,
          expires_at: expiresAt,
          created_at: new Date().toISOString()
        },
        { onConflict: 'service_id,date,start_time,session_id' }
      );
      if (upsertError) {
        if (DEV) {
          console.warn('[HOLD_SLOT] fallback upsert failed', upsertError);
        }
        return jsonError(500, 'HOLD_FALLBACK_FAILED', 'Unable to reserve slot right now.');
      }

      await supabase.from('slot_holds').delete().eq('session_id', sessionId).neq('start_time', normalizedStartTime);

      return NextResponse.json(
        { ok: true, expires_at: expiresAt },
        {
          headers: {
            'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0'
          }
        }
      );
    }

    if (row.conflict) {
      return jsonError(409, 'SLOT_TAKEN', 'That time is no longer available.');
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
    return jsonError(500, 'HOLD_UNEXPECTED', 'Unable to reserve slot right now.');
  }
}
