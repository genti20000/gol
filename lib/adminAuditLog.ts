import { createClient } from '@supabase/supabase-js';
import type { SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ??
  process.env.SUPABASE_SERVICE_ROLE ??
  process.env.SUPABASE_SERVICE_KEY;

type SupabaseServiceClient = SupabaseClient<any, 'public', any>;

export type AdminAuditLogInput = {
  adminEmail: string;
  action: string;
  entityType: string;
  entityId: string;
  meta?: Record<string, unknown>;
};

const getSupabase = (client?: SupabaseServiceClient): SupabaseServiceClient => {
  if (client) return client;
  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error('Supabase service credentials are not configured.');
  }
  return createClient(supabaseUrl, supabaseServiceKey);
};

export async function writeAdminAuditLog(
  input: AdminAuditLogInput,
  client?: SupabaseServiceClient
): Promise<void> {
  const supabase = getSupabase(client);
  const payload = {
    admin_email: input.adminEmail,
    action: input.action,
    entity_type: input.entityType,
    entity_id: input.entityId,
    meta: input.meta ?? {}
  };

  const { error } = await supabase.from('admin_audit_log').insert(payload);
  if (error) {
    throw new Error(error.message || 'Failed to write admin audit log.');
  }
}
