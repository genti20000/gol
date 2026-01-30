import Stripe from "stripe";
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
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
      .select("total_price,status")
      .eq("id", bookingId)
      .single();

    if (error) {
      console.error("Failed to load booking for checkout session.", error);
      return NextResponse.json({ error: "Unable to load booking." }, { status: 500 });
    }

    if (!booking || typeof booking.total_price !== "number") {
      return NextResponse.json({ error: "Booking total is unavailable." }, { status: 400 });
    }

    const { data: settings, error: settingsError } = await supabase
      .from("venue_settings")
      .select("deposit_enabled,deposit_amount")
      .single();

    if (settingsError || !settings) {
      console.error("Failed to load venue settings for checkout session.", settingsError);
      return NextResponse.json({ error: "Unable to load venue settings." }, { status: 500 });
    }

    const total = booking.total_price;
    const dueNow = settings.deposit_enabled
      ? Math.min(Math.max(settings.deposit_amount ?? 0, 0), total)
      : total;
    const unitAmount = Math.round(dueNow * 100);

    console.log("Stripe checkout request", {
      bookingId,
      dueNow,
      unitAmount,
      bookingStatus: booking.status
    });

    if (!Number.isFinite(unitAmount) || unitAmount < 0) {
      return NextResponse.json({ error: "Booking total is invalid." }, { status: 400 });
    }

    if (unitAmount <= 0) {
      const { error: updateError } = await supabase
        .from("bookings")
        .update({
          status: "CONFIRMED",
          deposit_paid: true,
          deposit_forfeited: false,
          amount_paid: dueNow
        })
        .eq("id", bookingId);

      if (updateError) {
        console.error("Failed to confirm booking with zero due now.", updateError);
        return NextResponse.json({ error: "Unable to confirm booking." }, { status: 500 });
      }

      console.log("Booking confirmed without payment.", { bookingId, dueNow });
      return NextResponse.json({
        skipPayment: true,
        redirectUrl: `/booking/confirmed?id=${bookingId}`,
        dueNow
      });
    }

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      ui_mode: "embedded",
      redirect_on_completion: "never",
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
      payment_intent_data: {
        metadata: {
          bookingId
        }
      },
      allow_promotion_codes: true,
    });

    return NextResponse.json({ clientSecret: session.client_secret, dueNow });
  } catch (error) {
    console.error("Failed to create Stripe Checkout session.", error);
    return NextResponse.json({ error: "Unable to start checkout." }, { status: 500 });
  }
}
