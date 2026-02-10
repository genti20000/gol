import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const getSupabase = () => {
  if (!supabaseUrl || !supabaseServiceKey) throw new Error('Supabase credentials are not configured.');
  return createClient(supabaseUrl, supabaseServiceKey);
};

const requireAdmin = async (request: Request) => {
  const authHeader = request.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) return null;
  const token = authHeader.slice(7);
  const supabase = getSupabase();
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data?.user?.email) return null;
  return { supabase, email: data.user.email };
};

export async function GET(request: Request) {
  try {
    const auth = await requireAdmin(request);
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const { data, error } = await auth.supabase.from('services').select('*').order('sort_order', { ascending: true });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ services: data ?? [] });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Unexpected error' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const auth = await requireAdmin(request);
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const payload = await request.json();
    const insertPayload = {
      name: payload.name,
      min_people: payload.minPeople,
      max_people: payload.maxPeople,
      duration_minutes: payload.durationMinutes,
      price_per_person_pence: payload.pricePerPersonPence,
      deposit_per_person_pence: payload.depositPerPersonPence ?? null,
      is_active: payload.isActive ?? true,
      sort_order: payload.sortOrder ?? 1
    };
    const { data, error } = await auth.supabase.from('services').insert([insertPayload]).select('*').single();
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ service: data }, { status: 201 });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Unexpected error' }, { status: 500 });
  }
}
