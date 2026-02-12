# Performance Audit: Slot Click Responsiveness (`/book/results`)

## Scope
- Route: `/book/results`
- Interaction: clicking an available time slot
- Primary KPI: click -> first UI update/paint (INP-like)

## Reproduction
1. Start app in dev: `npm run dev`
2. Open a search flow and land on `/book/results?...`
3. Open browser console.
4. Click any slot.
5. Read emitted logs with prefix `[perf][slot-interaction]`.
6. Optional: inspect collected history at `window.__LKC_PERF_LOGS__`.

## Baseline Evidence (before fix)
- User trace showed total interaction range around `10,326ms`.
- Main-thread timeline was dominated by repeated animation work (`fa-spin`) and delayed interactive paint.

## Bottlenecks Found
1. Slot cards were rendered inline, with parent-level state changes forcing broad rerenders.
2. Selection and booking init were coupled; network start happened in the same path with no explicit interaction timing instrumentation.
3. No persistent selected-slot info card on the results route, making feedback dependent on changing button text only.

## Fixes Implemented
- Refactored slot cards into memoized `SlotCard` component (`React.memo`).
- Added immediate `selectedTime` state update before booking-init network completion.
- Stabilized click handler and double-click suppression via `processingRef` to reduce render churn.
- Added selected-slot info panel that always renders on customer results page and updates immediately.
- Added performance instrumentation:
  - `click -> commit` mark/measure
  - `click -> next paint` mark/measure
  - `click -> booking init response` mark/measure
- Added long-task observer warnings (`duration > 50ms`) with route-tagged console output.

## Instrumentation Output Format
Each metric logs as:
```json
{
  "id": "19:00-1739351000000",
  "route": "/book/results",
  "slot": "19:00",
  "phase": "commit|paint|booking_init",
  "durationMs": 42.17,
  "mode": "dev|prod",
  "timestamp": "2026-02-12T...Z"
}
```

## Production Measurement Procedure
1. Build/start prod locally:
   - `npm run build`
   - `npm run start`
2. Repeat the click flow on `/book/results`.
3. Export `window.__LKC_PERF_LOGS__` and compare median `paint` duration pre/post.

## Notes
- Automated browser profiling (Playwright) was not runnable in this environment due offline package resolution.
- In-app instrumentation is now present to collect objective metrics in both dev and production builds.
