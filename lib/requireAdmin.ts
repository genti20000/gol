import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import type { SupabaseClient, User } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ??
  process.env.SUPABASE_SERVICE_ROLE ??
  process.env.SUPABASE_SERVICE_KEY;

type SupabaseServiceClient = SupabaseClient<any, 'public', any>;

export type RequireAdminContext = {
  supabase: SupabaseServiceClient;
  user: User;
  adminEmail: string;
  token: string;
};

const unauthorized = () =>
  NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });

const forbidden = () =>
  NextResponse.json({ ok: false, error: 'Forbidden' }, { status: 403 });

const misconfigured = () =>
  NextResponse.json({ ok: false, error: 'Server misconfigured' }, { status: 500 });

const parseAllowlist = () => {
  const sources = [
    process.env.ADMIN_EMAIL_ALLOWLIST,
    process.env.ADMIN_EMAILS,
    process.env.NEXT_PUBLIC_ADMIN_EMAILS
  ];
  const all = sources
    .map((value) => String(value || ''))
    .join(',')
    .split(',')
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
  return Array.from(new Set(all));
};

const getBearerToken = (request: Request): string | null => {
  const authHeader = request.headers.get('authorization') || '';
  if (!authHeader.startsWith('Bearer ')) return null;
  const token = authHeader.slice(7).trim();
  return token || null;
};

export async function requireAdmin(
  request: Request
): Promise<RequireAdminContext | NextResponse> {
  if (!supabaseUrl || !supabaseServiceKey) {
    return misconfigured();
  }

  const token = getBearerToken(request);
  if (!token) return unauthorized();

  const supabase = createClient(supabaseUrl, supabaseServiceKey);
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data?.user) return unauthorized();

  const email = String(data.user.email || '').trim().toLowerCase();
  const allowlist = parseAllowlist();
  if (process.env.NODE_ENV !== 'production') {
    console.info('[ADMIN AUTH]', {
      email: email || null,
      allowlistCount: allowlist.length
    });
  }
  if (!email || allowlist.length === 0 || !allowlist.includes(email)) {
    if (process.env.NODE_ENV !== 'production') {
      console.warn('[ADMIN AUTH] Forbidden', { email: email || null });
    }
    return forbidden();
  }

  return {
    supabase,
    user: data.user,
    adminEmail: data.user.email || 'unknown',
    token
  };
}
