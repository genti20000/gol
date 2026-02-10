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
  return supabase;
};

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  try {
    const supabase = await requireAdmin(request);
    if (!supabase) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const payload = await request.json();
    const patch: Record<string, unknown> = {};
    if (payload.name !== undefined) patch.name = payload.name;
    if (payload.minPeople !== undefined) patch.min_people = payload.minPeople;
    if (payload.maxPeople !== undefined) patch.max_people = payload.maxPeople;
    if (payload.durationMinutes !== undefined) patch.duration_minutes = payload.durationMinutes;
    if (payload.pricePerPersonPence !== undefined) patch.price_per_person_pence = payload.pricePerPersonPence;
    if (payload.depositPerPersonPence !== undefined) patch.deposit_per_person_pence = payload.depositPerPersonPence;
    if (payload.isActive !== undefined) patch.is_active = payload.isActive;
    if (payload.sortOrder !== undefined) patch.sort_order = payload.sortOrder;

    const { data, error } = await supabase.from('services').update(patch).eq('id', params.id).select('*').single();
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ service: data });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Unexpected error' }, { status: 500 });
  }
}

export async function DELETE(request: Request, { params }: { params: { id: string } }) {
  try {
    const supabase = await requireAdmin(request);
    if (!supabase) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const { error } = await supabase.from('services').update({ is_active: false }).eq('id', params.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Unexpected error' }, { status: 500 });
  }
}
