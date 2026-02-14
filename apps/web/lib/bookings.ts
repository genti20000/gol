import { supabase } from "./supabase";

export async function getMyBookings() {
  const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
  if (sessionError) throw sessionError;
  const userId = sessionData.session?.user.id;
  if (!userId) return [];

  const { data, error } = await supabase
    .from("bookings")
    .select("id,booking_date,start_time,end_at,status,total_price,room_name,guests")
    .eq("auth_user_id", userId)
    .order("start_at", { ascending: false });

  if (error) throw error;
  return data ?? [];
}

export async function createMyBooking(input: {
  room_id: string;
  service_id: string;
  booking_date: string;
  start_time: string;
  start_at: string;
  end_at: string;
  guests: number;
  total_price: number;
}) {
  const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
  if (sessionError) throw sessionError;
  const userId = sessionData.session?.user.id;
  if (!userId) throw new Error("Not signed in.");

  const { data, error } = await supabase
    .from("bookings")
    .insert([
      {
        ...input,
        auth_user_id: userId,
        status: "PENDING"
      }
    ])
    .select("id,booking_date,start_time,status")
    .single();

  if (error) throw error;
  return data;
}

