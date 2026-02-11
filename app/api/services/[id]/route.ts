import { NextResponse } from 'next/server';
import { parseServicePatchPayload } from '@/lib/serviceValidation';
import { ServerAdminAuthError, requireServerAdminAuth } from '@/lib/serverAdminAuth';

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  try {
    const { supabase } = await requireServerAdminAuth(request);
    const payload = await request.json();
    const parsed = parseServicePatchPayload(payload);
    if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });
    const patch = parsed.value as unknown as Record<string, unknown>;

    const { data, error } = await supabase.from('services').update(patch).eq('id', params.id).select('*').single();
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ service: data });
  } catch (e) {
    if (e instanceof ServerAdminAuthError) {
      return NextResponse.json({ error: e.message }, { status: e.status });
    }
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Unexpected error' }, { status: 500 });
  }
}

export async function DELETE(request: Request, { params }: { params: { id: string } }) {
  try {
    const { supabase } = await requireServerAdminAuth(request);
    const { error } = await supabase.from('services').update({ is_active: false }).eq('id', params.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof ServerAdminAuthError) {
      return NextResponse.json({ error: e.message }, { status: e.status });
    }
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Unexpected error' }, { status: 500 });
  }
}
