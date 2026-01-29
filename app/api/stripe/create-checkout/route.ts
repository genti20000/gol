import Stripe from "stripe";
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2023-10-16",
});

// initialize supabase client with env vars
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

export async function POST(req: Request) {
  const { bookingId } = await req.json();

  // Fetch booking amount from DB (do NOT trust client)
  const { data: booking } = await supabase
    .from("bookings")
    .select("total_price")
    .eq("id", bookingId)
    .single();

  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    payment_method_types: ["card"],
    line_items: [
      {
        price_data: {
          currency: "gbp",
          unit_amount: Number(booking?.total_price) * 100,
          product_data: {
            name: "London Karaoke Club Booking",
          },
        },
        quantity: 1,
      },
    ],
    metadata: {
      bookingId,
    },
    allow_promotion_codes: true,
    success_url: `${process.env.NEXT_PUBLIC_SITE_URL}/booking/processing?id=${bookingId}`,
    cancel_url: `${process.env.NEXT_PUBLIC_SITE_URL}/booking/cancelled?id=${bookingId}`,
  });

  return NextResponse.json({ url: session.url });
}
