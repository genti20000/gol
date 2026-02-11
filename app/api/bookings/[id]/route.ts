import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { extractBookingToken, isBookingTokenValid } from '@/lib/bookingAccessToken';
import { parseBookingId } from '@/lib/adminBookingValidation';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  if (!supabaseUrl || !supabaseServiceKey) {
    return NextResponse.json(
      { error: 'Supabase credentials are not configured.' },
      { status: 500 }
    );
  }

  const bookingIdResult = parseBookingId(params.id);
  if (!bookingIdResult.ok) {
    return NextResponse.json({ error: bookingIdResult.error }, { status: 400 });
  }
  const bookingId = bookingIdResult.value as string;

  const bookingToken = await extractBookingToken(request);
  if (!bookingToken) {
    return NextResponse.json({ error: 'Access denied.' }, { status: 403 });
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);
  const { data, error } = await supabase
    .from('bookings')
    .select('id,status,booking_ref,customer_email,deposit_amount,confirmed_at,booking_date,start_time,service_id,guests,duration_hours,promo_code,base_total,extras_price,discount_amount,promo_discount_amount,total_price,extras_total,extras_snapshot,room_id,room_name,staff_id,extras_hours,booking_access_token')
    .eq('id', bookingId)
    .maybeSingle();

  if (error || !data) {
    if (error) {
      console.error('Failed to load booking by id.', error);
    }
    return NextResponse.json({ error: 'Booking not found.' }, { status: 404 });
  }

  if (!isBookingTokenValid(bookingToken, data.booking_access_token)) {
    return NextResponse.json({ error: 'Access denied.' }, { status: 403 });
  }

  return NextResponse.json({
    id: data.id,
    status: data.status,
    booking: {
      id: data.id,
      status: data.status,
      booking_ref: data.booking_ref,
      customer_email: data.customer_email,
      deposit_amount: data.deposit_amount,
      confirmed_at: data.confirmed_at,
      booking_date: data.booking_date,
      start_time: data.start_time,
      service_id: data.service_id,
      guests: data.guests,
      duration_hours: data.duration_hours,
      promo_code: data.promo_code,
      base_total: data.base_total,
      extras_price: data.extras_price,
      discount_amount: data.discount_amount,
      promo_discount_amount: data.promo_discount_amount,
      total_price: data.total_price,
      extras_total: data.extras_total,
      extras_snapshot: data.extras_snapshot,
      room_id: data.room_id,
      room_name: data.room_name,
      staff_id: data.staff_id,
      extras_hours: data.extras_hours
    }
  });
}
