import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { parseServiceCreatePayload } from '@/lib/serviceValidation';
import { ServerAdminAuthError, requireServerAdminAuth } from '@/lib/serverAdminAuth';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY;

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
  try {
    const { supabase } = await requireServerAdminAuth(request);
    const payload = await request.json();
    const parsed = parseServiceCreatePayload(payload);
    if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });
    const value = parsed.value as {
      name: string;
      minPeople: number;
      maxPeople: number;
      durationMinutes: number;
      pricePerPersonPence: number;
      depositPerPersonPence: number | null;
      isActive: boolean;
      sortOrder: number;
    };
    const insertPayload = {
      name: value.name,
      min_people: value.minPeople,
      max_people: value.maxPeople,
      duration_minutes: value.durationMinutes,
      price_per_person_pence: value.pricePerPersonPence,
      deposit_per_person_pence: value.depositPerPersonPence,
      is_active: value.isActive,
      sort_order: value.sortOrder
    };
    const { data, error } = await supabase.from('services').insert([insertPayload]).select('*').single();
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ service: data }, { status: 201 });
  } catch (error) {
    if (error instanceof ServerAdminAuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: 'Unexpected error.' }, { status: 500 });
  }
}
