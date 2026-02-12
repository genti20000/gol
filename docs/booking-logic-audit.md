# Booking Logic Audit

## Scope Reviewed
- Availability: `/app/api/bookings/availability/route.ts`
- Draft/init: `/app/api/bookings/init/route.ts`, `/app/api/bookings/create-draft/route.ts`
- Checkout updates: `/app/api/bookings/[id]/update/route.ts`
- Finalize: `/app/api/bookings/[id]/confirm/route.ts`
- Totals engine: `/lib/bookingTotals.js`
- Client pricing mirror: `/store.tsx`
- DB constraints/migrations under `/supabase/migrations`

## Findings and Actions

### 1) Availability blocking rule needed a single source of truth
- Risk: drift between status/expires handling in different availability paths.
- Action: added shared helper `/lib/availabilityRules.js` and wired API availability route to use it.
- Rule now explicit:
  - `CONFIRMED`, `PENDING` block.
  - `DRAFT` blocks only while `expires_at > now`.
  - `CANCELLED`/`EXPIRED` do not block.

### 2) Overlap protection at DB layer exists
- Verified migration includes exclusion constraint `bookings_no_overlap_per_room`.
- Constraint protects against double booking even under concurrency.

### 3) Draft expiry lifecycle exists
- Verified cron migration auto-expires stale drafts and deletes old expired rows.
- API init/create-draft also attempt stale-draft expiry before allocation.

### 4) Totals are server-calculated
- `update` route recalculates totals from persisted booking/session fields + extras snapshot.
- Checkout confirmation does not trust client total payload.

### 5) Finalization idempotency behavior
- Confirm endpoint returns success-like response when booking is already confirmed.
- This prevents duplicate confirmation side effects from repeated clicks.

## Tests Added
- `/tests/availability-rules.test.js`
  - Blocking statuses
  - DRAFT expiry behavior
  - Non-blocking statuses
  - Time-range overlap helper

## Existing Tests Relevant
- `/tests/booking-totals.test.js`
- `/tests/booking-extras-persistence.test.js`
- `/tests/checkout-draft-summary.test.js`
- `/tests/draft-expiry.test.js`
- `/tests/booking-update-validation.test.js`

## Remaining High-Value Checks (manual/e2e)
- Two-user race on same slot in production-like env:
  - Expect exactly one success, one 409.
- Timezone DST boundary day:
  - Verify display/local conversion and overlap checks.
- Promo/discount matrix:
  - Midweek + early bird + promo + extras snapshot total consistency.

## Behavior Changes Introduced
- No product rule changes to booking outcomes.
- Internal consistency change: availability status logic now centralized.
