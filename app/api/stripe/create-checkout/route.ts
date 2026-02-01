import Stripe from "stripe";
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

import { BookingStatus } from "@/types";
import { normalizeAmount } from "@/lib/paymentLogic";

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

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { bookingId } = await req.json();

    if (!bookingId || typeof bookingId !== "string") {
      return NextResponse.json({ error: "Missing bookingId." }, { status: 400 });
    }

    const { data: booking, error } = await supabase
      .from("bookings")
      .select("total_price,deposit_amount,status,deposit_paid,stripe_session_id")
      .eq("id", bookingId)
      .maybeSingle();

    if (error) {
      console.error("Failed to load booking for checkout session.", error);
      return NextResponse.json({ error: "Unable to load booking." }, { status: 500 });
    }

    if (!booking) {
      return NextResponse.json({ error: "Booking total is unavailable." }, { status: 400 });
    }

    const totalPrice = normalizeAmount(booking.total_price);
    const bookingDepositAmount = normalizeAmount(booking.deposit_amount);

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
      .maybeSingle();

    if (settingsError) {
      console.warn("Failed to load venue settings for checkout session, using defaults.", settingsError);
    } else if (!settings) {
      console.warn("Venue settings row is missing for checkout session, using defaults.");
    }

    const depositEnabled = Boolean(settings?.deposit_enabled);
    const settingsDepositAmount = normalizeAmount(settings?.deposit_amount);
    const amountToCharge = depositEnabled ? bookingDepositAmount || settingsDepositAmount : totalPrice;
    const unitAmount = Math.round(amountToCharge * 100);
    if (!Number.isFinite(unitAmount) || unitAmount < 0) {
      return NextResponse.json({ error: "Booking total is invalid." }, { status: 400 });
    }

    if (unitAmount === 0) {
      const { error: updateError } = await supabase
        .from("bookings")
        .update({
          status: "CONFIRMED",
          confirmed_at: new Date().toISOString(),
          deposit_paid: true,
          amount_charged: 0,
          payment_intent_id: null
        })
        .eq("id", bookingId);

      if (updateError) {
        console.error("Failed to confirm booking with zero due now.", updateError);
        return NextResponse.json({ error: "Unable to confirm booking." }, { status: 500 });
      }

      console.log("Booking confirmed without payment.", { bookingId, amountToCharge });
      return NextResponse.json({ confirmed: true });
    }

    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || process.env.SITE_URL;
    if (!siteUrl) {
      return NextResponse.json({ error: "Site URL is not configured." }, { status: 500 });
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
                name: "Karaoke booking – deposit/payment",
              },
            },
            quantity: 1,
          },
        ],
        metadata: {
          booking_id: bookingId,
        },
        payment_intent_data: {
          description: "Karaoke booking – deposit/payment",
          metadata: {
            booking_id: bookingId
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
        payment_intent_id: typeof session.payment_intent === "string" ? session.payment_intent : undefined,
        amount_charged: 0,
        status: BookingStatus.PENDING,
        deposit_paid: false
      })
      .eq("id", bookingId);

    if (stripeUpdateError) {
      console.error("Failed to store Stripe session for booking.", stripeUpdateError);
    }

    return NextResponse.json({ url: session.url });
  } catch (error) {
    console.error("Failed to create Stripe Checkout session.", error);
    return NextResponse.json({ error: "Unable to start checkout." }, { status: 500 });
  }
}
