import { supabase } from './supabase';

export async function signIn(email: string, password: string) {
  return supabase.auth.signInWithPassword({ email, password });
}

export async function signOut() {
  return supabase.auth.signOut();
}

export async function getSession() {
  return supabase.auth.getSession();
}

export async function checkAdminStatus(allowedEmails: string[] = []) {
  const { data } = await supabase.auth.getSession();
  const email = data.session?.user?.email?.toLowerCase();
  if (!email) return false;
  if (allowedEmails.length === 0) return true;
  return allowedEmails.map(item => item.toLowerCase()).includes(email);
}

export function onAuthChange(callback: () => void) {
  const { data } = supabase.auth.onAuthStateChange(() => callback());
  return () => data.subscription.unsubscribe();
}
