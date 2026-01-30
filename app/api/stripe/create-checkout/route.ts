import Stripe from "stripe";
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

import { BookingStatus } from "@/types";
import { computeAmountDueNow, normalizeAmount } from "@/lib/paymentLogic";

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
      .select("total_price,status,deposit_paid,stripe_session_id")
      .eq("id", bookingId)
      .single();

    if (error) {
      console.error("Failed to load booking for checkout session.", error);
      return NextResponse.json({ error: "Unable to load booking." }, { status: 500 });
    }

    if (!booking) {
      return NextResponse.json({ error: "Booking total is unavailable." }, { status: 400 });
    }

    const totalPrice = normalizeAmount(booking.total_price);

    if (booking.status === BookingStatus.CANCELLED) {
      return NextResponse.json({ error: "Booking has been cancelled." }, { status: 400 });
    }

    if (booking.status === BookingStatus.CONFIRMED || booking.deposit_paid === true) {
      return NextResponse.json(
        { error: "Booking is already paid or confirmed." },
        { status: 400 },
      );
    }

    const { data: settings, error: settingsError } = await supabase
      .from("venue_settings")
      .select("deposit_enabled,deposit_amount")
      .single();

    if (settingsError) {
      console.error("Failed to load venue settings for checkout session.", settingsError);
      return NextResponse.json({ error: "Unable to load payment settings." }, { status: 500 });
    }

    const depositEnabled = Boolean(settings?.deposit_enabled);
    const depositAmount = normalizeAmount(settings?.deposit_amount);
    const dueNow = computeAmountDueNow({ totalPrice, depositEnabled, depositAmount });
    const unitAmount = Math.round(dueNow * 100);
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
          amount_paid: dueNow,
          deposit_amount: 0
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

    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || process.env.SITE_URL;
    if (!siteUrl) {
      return NextResponse.json({ error: "Site URL is not configured." }, { status: 500 });
    }

    if (booking.stripe_session_id) {
      const existingSession = await stripe.checkout.sessions.retrieve(booking.stripe_session_id);
      if (existingSession.url) {
        return NextResponse.json({ redirectUrl: existingSession.url, dueNow });
      }
    }

    const session = await stripe.checkout.sessions.create(
      {
        mode: "payment",
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
        success_url: `${siteUrl}/booking/confirmed?id=${bookingId}&session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${siteUrl}/booking/failed?id=${bookingId}`,
        allow_promotion_codes: true,
      },
      { idempotencyKey: bookingId }
    );

    if (!session.url) {
      return NextResponse.json({ error: "Unable to start checkout." }, { status: 500 });
    }

    const { error: stripeUpdateError } = await supabase
      .from("bookings")
      .update({
        stripe_session_id: session.id,
        stripe_payment_intent_id: typeof session.payment_intent === "string" ? session.payment_intent : undefined,
        deposit_amount: dueNow,
        status: BookingStatus.PENDING,
        deposit_paid: false
      })
      .eq("id", bookingId);

    if (stripeUpdateError) {
      console.error("Failed to store Stripe session for booking.", stripeUpdateError);
    }

    return NextResponse.json({ redirectUrl: session.url, dueNow });
  } catch (error) {
    console.error("Failed to create Stripe Checkout session.", error);
    return NextResponse.json({ error: "Unable to start checkout." }, { status: 500 });
  }
}
