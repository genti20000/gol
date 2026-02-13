import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/requireAdmin';
import { BookingStatus } from '@/types';

const MAX_PAGE_SIZE = 100;
export const dynamic = 'force-dynamic';

const toBool = (value: string | null) => value === '1' || value === 'true';

const toInt = (value: string | null, fallback: number) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(1, Math.floor(parsed));
};

const toIsoStart = (date: string) => new Date(`${date}T00:00:00`).toISOString();
const toIsoEnd = (date: string) => new Date(`${date}T23:59:59`).toISOString();

const applyFilters = (baseQuery: any, params: URLSearchParams) => {
  let query = baseQuery;
  const room = (params.get('room') || '').trim();
  const status = (params.get('status') || 'live').trim().toUpperCase();
  const payment = (params.get('payment') || '').trim().toUpperCase();
  const search = (params.get('search') || '').trim();
  const showExpired = toBool(params.get('showExpired'));
  const missingOnly = toBool(params.get('missingOnly'));
  const highValueOnly = toBool(params.get('highValueOnly'));
  const range = (params.get('range') || 'all').trim().toLowerCase();
  const startDate = (params.get('startDate') || '').trim();
  const endDate = (params.get('endDate') || '').trim();

  query = query.neq('status', BookingStatus.DRAFT);

  if (room) query = query.eq('room_id', room);

  if (status === 'LIVE') {
    query = query.in('status', [BookingStatus.CONFIRMED, BookingStatus.PENDING]);
  } else if (status && status !== 'ALL') {
    query = query.eq('status', status);
  } else if (!showExpired) {
    query = query.neq('status', BookingStatus.EXPIRED);
  }

  if (payment) query = query.eq('payment_state', payment);
  if (highValueOnly) query = query.gte('total_price', 500);
  if (missingOnly) {
    query = query.or(
      'customer_name.is.null,customer_name.eq.,customer_email.is.null,customer_email.eq.'
    );
  }

  if (search) {
    const escaped = search.replace(/[%_]/g, '');
    query = query.or(
      `customer_name.ilike.%${escaped}%,customer_email.ilike.%${escaped}%,booking_ref.ilike.%${escaped}%`
    );
  }

  if (range === 'today') {
    const today = new Date().toISOString().slice(0, 10);
    query = query.gte('start_at', toIsoStart(today)).lte('start_at', toIsoEnd(today));
  } else if (range === 'week') {
    const today = new Date();
    const end = new Date(today);
    end.setDate(today.getDate() + 6);
    query = query
      .gte('start_at', toIsoStart(today.toISOString().slice(0, 10)))
      .lte('start_at', toIsoEnd(end.toISOString().slice(0, 10)));
  } else if (range === 'custom' && startDate) {
    query = query.gte('start_at', toIsoStart(startDate));
    if (endDate) query = query.lte('start_at', toIsoEnd(endDate));
  }

  return query;
};

export async function GET(request: Request) {
  try {
    const admin = await requireAdmin(request);
    if (admin instanceof NextResponse) return admin;
    const { supabase } = admin;
    const url = new URL(request.url);
    const params = url.searchParams;
    const page = toInt(params.get('page'), 1);
    const pageSize = Math.min(toInt(params.get('pageSize'), 25), MAX_PAGE_SIZE);
    const exportAll = toBool(params.get('exportAll'));
    const offset = (page - 1) * pageSize;

    const countQuery = applyFilters(
      supabase.from('bookings').select('id', { count: 'exact', head: true }),
      params
    );
    const { count, error: countError } = await countQuery;
    if (countError) {
      return NextResponse.json({ error: 'Failed to count bookings.' }, { status: 500 });
    }

    let rowsQuery = applyFilters(
      supabase.from('bookings').select('*').order('start_at', { ascending: true }),
      params
    );
    if (!exportAll) {
      rowsQuery = rowsQuery.range(offset, offset + pageSize - 1);
    }

    const { data: rows, error: rowsError } = await rowsQuery;
    if (rowsError) {
      return NextResponse.json({ error: 'Failed to load bookings.' }, { status: 500 });
    }

    return NextResponse.json({
      ok: true,
      page,
      pageSize,
      total: count ?? 0,
      rows: rows ?? []
    });
  } catch (error) {
    console.error('[ADMIN BOOKINGS LIST] Unexpected error', error);
    return NextResponse.json({ error: 'Unexpected error.' }, { status: 500 });
  }
}
