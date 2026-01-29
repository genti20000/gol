import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

export async function GET(
  _request: Request,
  { params }: { params: { id: string } }
) {
  if (!supabaseUrl || !supabaseServiceKey) {
    return NextResponse.json(
      { error: 'Supabase credentials are not configured.' },
      { status: 500 }
    );
  }

  const bookingId = params.id;
  if (!bookingId) {
    return NextResponse.json({ error: 'Missing booking id.' }, { status: 400 });
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);
  const { data, error } = await supabase
    .from('bookings')
    .select('id,status')
    .eq('id', bookingId)
    .single();

  if (error || !data) {
    return NextResponse.json({ error: 'Booking not found.' }, { status: 404 });
  }

  return NextResponse.json({ id: data.id, status: data.status });
}
