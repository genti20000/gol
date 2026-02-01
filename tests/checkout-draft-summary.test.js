const assert = require('node:assert/strict');
const { getCheckoutSummaryFields } = require('../lib/checkoutSummary');

const draftBooking = {
  booking_date: '2026-02-26',
  start_time: '18:00:00',
  service_id: 'srv-1',
  guests: 8,
  duration_hours: 2
};

const summary = getCheckoutSummaryFields({
  booking: draftBooking,
  fallback: {
    date: '',
    time: '',
    guests: 0,
    extraHours: 0
  },
  baseDurationHours: 2
});

assert.equal(summary.date, '2026-02-26', 'Draft booking should supply booking_date.');
assert.equal(summary.time, '18:00', 'Draft booking time should be formatted to HH:mm.');
assert.equal(summary.hasValidDateTime, true, 'Draft booking should be treated as valid date/time.');
assert.equal(summary.errors.date, undefined, 'Draft booking should not show date error.');
assert.equal(summary.errors.time, undefined, 'Draft booking should not show time error.');

console.log('checkout-draft-summary.test.js passed');
