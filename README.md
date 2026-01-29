<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/drive/1eG_LrBExB3drphL70pqRZ0NPBHsnongl

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Set the `GEMINI_API_KEY` in [.env.local](.env.local) to your Gemini API key
3. Run the app:
   `npm run dev`

## Stripe Payments Integration (Vercel/Next.js)

If you want to enable payments, you must wire your app to Stripe’s APIs and manage payment state on the server. The high-level best‑practice flow (aligned with current Stripe guidance) is:

- **Create PaymentIntents server-side**: Add an API route (e.g. `/api/stripe/create-intent`) that computes the amount securely on the server, creates a `PaymentIntent` with `amount`, `currency`, and metadata (booking ID/date), and returns the `client_secret`.
- **Use Stripe Elements / Payment Element**: Load Stripe.js on the client, mount the Payment Element for multi‑method checkout, and submit with `stripe.confirmPayment({ elements, clientSecret })`.
- **Secure environment variables**: Store `STRIPE_SECRET_KEY` and `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` in Vercel Environment Variables. Never hard‑code keys in the repo.
- **Handle webhooks**: Implement `/api/stripe/webhook` to process `payment_intent.succeeded`, `payment_intent.payment_failed`, and related events so bookings are only confirmed after Stripe reports success.
- **SCA / saved payment methods**: Use `setup_future_usage` on `PaymentIntent`s (or Setup Intents) if you need to save payment methods for off‑session charges.
- **Test in sandbox**: Use Stripe’s test keys and card numbers in development, then switch to live keys after end‑to‑end verification.

### Project-specific setup

This repo already contains Stripe routes you can plug into:

1. **Set required environment variables** (locally in `.env.local` and in Vercel):
   - `STRIPE_SECRET_KEY`
   - `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`
   - `STRIPE_WEBHOOK_SECRET` (required for webhook verification)
2. **Create PaymentIntents server-side** via `POST /api/stripe/create-intent` (already implemented in `app/api/stripe/create-intent/route.ts`). Ensure `amount` is an integer in the smallest currency unit (e.g. pennies) and pass booking metadata so webhooks can reconcile bookings.
3. **Confirm payments client-side** by requesting the `client_secret` from `/api/stripe/create-intent`, then confirming with Stripe.js on the client. The current `views/Checkout.tsx` confirms card payments, but you can replace it with the Payment Element for Apple Pay / Google Pay support.
4. **Handle webhooks** at `/api/stripe/webhook` (already implemented). Stripe will send `payment_intent.succeeded` and `payment_intent.payment_failed` events; the handler updates booking status from metadata.
5. **Verify end‑to‑end** using Stripe test keys before switching to live mode.
