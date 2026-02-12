import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/requireAdmin';
import { parseServicePatchPayload } from '@/lib/serviceValidation';
import { writeAdminAuditLog } from '@/lib/adminAuditLog';

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  try {
    const admin = await requireAdmin(request);
    if (admin instanceof NextResponse) return admin;
    const { supabase, adminEmail } = admin;
    const payload = await request.json();
    const parsed = parseServicePatchPayload(payload);
    if (!parsed.ok) {
      return NextResponse.json({ error: parsed.error }, { status: 400 });
    }
    const patch = parsed.value as unknown as Record<string, unknown>;

    const { data, error } = await supabase
      .from('services')
      .update(patch)
      .eq('id', params.id)
      .select('*')
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    await writeAdminAuditLog({
      adminEmail,
      action: 'SERVICE_UPDATE',
      entityType: 'service',
      entityId: String(data.id),
      meta: {
        name: data.name,
        isActive: data.is_active
      }
    }, supabase);

    return NextResponse.json({ service: data });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unexpected error' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: Request, { params }: { params: { id: string } }) {
  try {
    const admin = await requireAdmin(request);
    if (admin instanceof NextResponse) return admin;
    const { supabase, adminEmail } = admin;

    const { error } = await supabase
      .from('services')
      .update({ is_active: false })
      .eq('id', params.id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    await writeAdminAuditLog({
      adminEmail,
      action: 'SERVICE_DEACTIVATE',
      entityType: 'service',
      entityId: params.id,
      meta: {}
    }, supabase);

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unexpected error' },
      { status: 500 }
    );
  }
}
