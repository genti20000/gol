import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
const supabaseAnonKey =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY ??
  '';

export const supabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);
const missingConfigMessage =
  'Supabase is not configured. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY (or NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY).';

// Prevent duplicate Supabase clients during Next.js hot reloads.
let cachedClient: ReturnType<typeof createClient> | null = null;

export const getSupabaseClient = () => {
  if (!supabaseConfigured) {
    throw new Error(missingConfigMessage);
  }

  if (cachedClient) {
    return cachedClient;
  }

  cachedClient = createClient(supabaseUrl, supabaseAnonKey);
  return cachedClient;
};

// Lazy proxy avoids module-load crashes when env vars are missing.
// The client is intentionally exported as `any` until generated DB types are wired in.
export const supabase: any = new Proxy({} as ReturnType<typeof createClient>, {
  get(_target, property, receiver) {
    const client = getSupabaseClient();
    const value = Reflect.get(client as unknown as object, property, receiver);
    return typeof value === 'function' ? value.bind(client) : value;
  },
});
