import { NextResponse } from 'next/server';
import { ServerAdminAuthError, requireServerAdminAuth } from '@/lib/serverAdminAuth';

export async function GET(request: Request) {
  try {
    const { supabase } = await requireServerAdminAuth(request);

    const { data, error } = await supabase
      .from('services')
      .select('*')
      .order('sort_order', { ascending: true });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ services: data ?? [] });
  } catch (error) {
    if (error instanceof ServerAdminAuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unexpected error' },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const { supabase } = await requireServerAdminAuth(request);
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

    const { data, error } = await supabase
      .from('services')
      .insert([insertPayload])
      .select('*')
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ service: data }, { status: 201 });
  } catch (error) {
    if (error instanceof ServerAdminAuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unexpected error' },
      { status: 500 }
    );
  }
}
