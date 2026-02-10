import { NextResponse } from 'next/server';
import { ServerAdminAuthError, requireServerAdminAuth } from '@/lib/serverAdminAuth';

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  try {
    const { supabase } = await requireServerAdminAuth(request);
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

    const { data, error } = await supabase
      .from('services')
      .update(patch)
      .eq('id', params.id)
      .select('*')
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ service: data });
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

export async function DELETE(request: Request, { params }: { params: { id: string } }) {
  try {
    const { supabase } = await requireServerAdminAuth(request);

    const { error } = await supabase
      .from('services')
      .update({ is_active: false })
      .eq('id', params.id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ ok: true });
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
