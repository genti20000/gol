import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/requireAdmin';
import { parseServiceCreatePayload } from '@/lib/serviceValidation';
import { writeAdminAuditLog } from '@/lib/adminAuditLog';

export async function GET(request: Request) {
  try {
    const admin = await requireAdmin(request);
    if (admin instanceof NextResponse) return admin;
    const { supabase } = admin;

    const { data, error } = await supabase
      .from('services')
      .select('*')
      .order('sort_order', { ascending: true });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ services: data ?? [] });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unexpected error' },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const admin = await requireAdmin(request);
    if (admin instanceof NextResponse) return admin;
    const { supabase, adminEmail } = admin;
    const payload = await request.json();
    const parsed = parseServiceCreatePayload(payload);
    if (!parsed.ok) {
      return NextResponse.json({ error: parsed.error }, { status: 400 });
    }
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

    const { data, error } = await supabase
      .from('services')
      .insert([insertPayload])
      .select('*')
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    await writeAdminAuditLog({
      adminEmail,
      action: 'SERVICE_CREATE',
      entityType: 'service',
      entityId: String(data.id),
      meta: {
        name: data.name,
        minPeople: data.min_people,
        maxPeople: data.max_people,
        isActive: data.is_active
      }
    }, supabase);

    return NextResponse.json({ service: data }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unexpected error' },
      { status: 500 }
    );
  }
}
