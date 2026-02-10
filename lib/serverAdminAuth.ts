import { createClient } from '@supabase/supabase-js';
import type { SupabaseClient, User } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

export class ServerAdminAuthError extends Error {
  status: 401 | 403 | 500;

  constructor(status: 401 | 403 | 500, message: string) {
    super(message);
    this.name = 'ServerAdminAuthError';
    this.status = status;
  }
}

type SupabaseServiceClient = SupabaseClient<any, 'public', any>;

export type ServerAdminAuthContext = {
  supabase: SupabaseServiceClient;
  token: string;
  user: User;
  adminEmail: string;
};

const getSupabaseServiceClient = (): SupabaseServiceClient => {
  if (!supabaseUrl || !supabaseServiceKey) {
    throw new ServerAdminAuthError(500, 'Supabase credentials are not configured.');
  }

  return createClient(supabaseUrl, supabaseServiceKey);
};

const getBearerToken = (request: Request): string => {
  const authHeader = request.headers.get('authorization');

  if (!authHeader?.startsWith('Bearer ')) {
    throw new ServerAdminAuthError(401, 'Unauthorized');
  }

  const token = authHeader.slice(7).trim();
  if (!token) {
    throw new ServerAdminAuthError(401, 'Unauthorized');
  }

  return token;
};

const getAdminEmailAllowlist = (): string[] => {
  const raw = process.env.ADMIN_EMAILS ?? '';
  return raw
    .split(',')
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
};

const isAdminUser = (user: User): boolean => {
  const role = user.app_metadata?.role;
  if (role === 'admin') {
    return true;
  }

  const userEmail = user.email?.toLowerCase();
  if (!userEmail) {
    return false;
  }

  const allowlist = getAdminEmailAllowlist();
  return allowlist.includes(userEmail);
};

export const requireServerAdminAuth = async (
  request: Request
): Promise<ServerAdminAuthContext> => {
  const token = getBearerToken(request);
  const supabase = getSupabaseServiceClient();

  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data?.user) {
    throw new ServerAdminAuthError(401, 'Unauthorized');
  }

  if (!isAdminUser(data.user)) {
    throw new ServerAdminAuthError(403, 'Forbidden');
  }

  return {
    supabase,
    token,
    user: data.user,
    adminEmail: data.user.email ?? 'unknown'
  };
};
