import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const requireAdmin = async (request: Request) => {
  if (!supabaseUrl || !supabaseServiceKey) return null;
  const authHeader = request.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) return null;
  const token = authHeader.slice(7);
  const supabase = createClient(supabaseUrl, supabaseServiceKey);
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data?.user?.email) return null;
  return supabase;
};

export async function GET() {
  if (!supabaseUrl || !supabaseAnonKey) return NextResponse.json({ error: 'Supabase credentials are not configured.' }, { status: 500 });
  const supabase = createClient(supabaseUrl, supabaseAnonKey);
  const { data, error } = await supabase
    .from('services')
    .select('id,name,min_people,max_people,duration_minutes,price_per_person_pence,is_active,sort_order')
    .eq('is_active', true)
    .order('sort_order', { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ services: data ?? [] });
}


export async function POST(request: Request) {
  const supabase = await requireAdmin(request);
  if (!supabase) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
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
  const { data, error } = await supabase.from('services').insert([insertPayload]).select('*').single();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ service: data }, { status: 201 });
}
