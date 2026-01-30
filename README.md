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

If you want to enable payments, you must wire your app to Stripe’s APIs and manage payment state on the server. The high-level best‑practice flow (aligned with current Stripe guidance for Checkout) is:

- **Create Checkout Sessions server-side**: Provide an API route (e.g. `/api/stripe/create-checkout`) that computes the amount securely on the server, creates a Checkout Session with metadata (booking ID/date), and returns the hosted `url`.
- **Redirect to Stripe Checkout**: After creating the booking, send the user to `checkout.stripe.com` with `window.location.href = url`. Do not call `stripe.confirmPayment` or render Elements when using Checkout.
- **Secure environment variables**: Store `STRIPE_SECRET_KEY` in Vercel Environment Variables. Never hard‑code keys in the repo.
- **Handle webhooks**: Implement `/api/stripe/webhook` to process `checkout.session.completed` so bookings are only confirmed after Stripe reports success.
- **Test in sandbox**: Use Stripe’s test mode keys in development, then switch to live keys after end‑to‑end verification.

### Project-specific setup

This repo already contains Stripe routes you can plug into:

1. **Set required environment variables** (locally in `.env.local` and in Vercel):
   - `STRIPE_SECRET_KEY`
   - `STRIPE_WEBHOOK_SECRET` (required for webhook verification)
   - `NEXT_PUBLIC_SITE_URL` (or `SITE_URL`) for Stripe success/cancel redirects
2. **Create Checkout Sessions server-side** via `POST /api/stripe/create-checkout` (already implemented in `app/api/stripe/create-checkout/route.ts`). Ensure you pass booking metadata so webhooks can reconcile bookings.
3. **Redirect to Stripe Checkout** from the client after booking creation. The current `views/Checkout.tsx` uses the hosted `url` returned from `/api/stripe/create-checkout`.
4. **Handle webhooks** at `/api/stripe/webhook` (already implemented). Stripe will send `checkout.session.completed`; the handler updates booking status from metadata.
5. **Verify end‑to‑end** using Stripe test keys before switching to live mode.
