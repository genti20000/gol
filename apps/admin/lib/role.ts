import { createClient } from "@supabase/supabase-js";
import { supabase } from "./supabase";

export type AppRole = "customer" | "staff" | "admin";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY ?? "";

const roleClient = createClient(supabaseUrl, supabaseAnonKey);

export async function getCurrentRole(accessToken?: string): Promise<AppRole | null> {
  try {
    const token = accessToken || (await supabase.auth.getSession()).data.session?.access_token;
    if (!token) return null;

    const { data: userData, error: userError } = await roleClient.auth.getUser(token);
    if (userError || !userData.user) return null;

    const { data: profile, error: profileError } = await roleClient
      .from("profiles")
      .select("role")
      .eq("id", userData.user.id)
      .maybeSingle();

    if (profileError || !profile?.role) return null;
    const role = String(profile.role) as AppRole;
    if (role !== "customer" && role !== "staff" && role !== "admin") return null;
    return role;
  } catch {
    return null;
  }
}

export async function isStaffOrAdmin(accessToken?: string): Promise<boolean> {
  const role = await getCurrentRole(accessToken);
  return role === "staff" || role === "admin";
}

