import Stripe from "stripe";
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const siteUrl = process.env.NEXT_PUBLIC_SITE_URL;

export async function POST(req: Request) {
  try {
    if (!stripeSecretKey) {
      return NextResponse.json({ error: "STRIPE_SECRET_KEY is not set." }, { status: 500 });
    }

    if (!supabaseUrl || !supabaseServiceKey) {
      return NextResponse.json(
        { error: "Supabase credentials are not configured." },
        { status: 500 },
      );
    }

    if (!siteUrl) {
      return NextResponse.json(
        { error: "NEXT_PUBLIC_SITE_URL is not set." },
        { status: 500 },
      );
    }

    const stripe = new Stripe(stripeSecretKey, {
      apiVersion: "2024-04-10",
    });

    // initialize supabase client with env vars
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { bookingId } = await req.json();

    if (!bookingId || typeof bookingId !== "string") {
      return NextResponse.json({ error: "Missing bookingId." }, { status: 400 });
    }

    // Fetch booking amount from DB (do NOT trust client)
    const { data: booking, error } = await supabase
      .from("bookings")
      .select("total_price")
      .eq("id", bookingId)
      .single();

    if (error) {
      console.error("Failed to load booking for checkout session.", error);
      return NextResponse.json({ error: "Unable to load booking." }, { status: 500 });
    }

    if (!booking || typeof booking.total_price !== "number") {
      return NextResponse.json({ error: "Booking total is unavailable." }, { status: 400 });
    }

    const unitAmount = Math.round(booking.total_price * 100);
    if (!Number.isFinite(unitAmount) || unitAmount <= 0) {
      return NextResponse.json({ error: "Booking total is invalid." }, { status: 400 });
    }

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card"],
      line_items: [
        {
          price_data: {
            currency: "gbp",
            unit_amount: unitAmount,
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
      success_url: `${siteUrl}/booking/processing?id=${bookingId}`,
      cancel_url: `${siteUrl}/booking/cancelled?id=${bookingId}`,
    });

    return NextResponse.json({ url: session.url });
  } catch (error) {
    console.error("Failed to create Stripe Checkout session.", error);
    return NextResponse.json({ error: "Unable to start checkout." }, { status: 500 });
  }
}
