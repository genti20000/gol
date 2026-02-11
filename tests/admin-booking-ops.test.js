const test = require('node:test');
const assert = require('node:assert/strict');

const {
  hasMissingCustomerDetails,
  validateNotesInput,
  hasConflict,
  shouldAutoExpirePendingBooking,
  deriveStatusFromPaymentState,
  PAYMENT_STATES
} = require('../lib/adminBookingOps');

test('notes validation blocks garbage and long strings', () => {
  assert.equal(validateNotesInput('aaaaaaa').ok, false);
  assert.equal(validateNotesInput('ok note').ok, true);
  assert.equal(validateNotesInput('x'.repeat(301)).ok, false);
});

test('missing customer details detection', () => {
  assert.equal(hasMissingCustomerDetails({ customer_name: '', customer_email: 'x@y.com' }), true);
  assert.equal(hasMissingCustomerDetails({ customer_name: 'Jane Doe', customer_email: '' }), true);
  assert.equal(hasMissingCustomerDetails({ customer_name: 'Jane Doe', customer_email: 'x@y.com' }), false);
});

test('status derived from payment state', () => {
  assert.equal(deriveStatusFromPaymentState({ status: 'PENDING', payment_state: PAYMENT_STATES.NONE }), 'PENDING');
  assert.equal(deriveStatusFromPaymentState({ status: 'PENDING', payment_state: PAYMENT_STATES.PAID }), 'CONFIRMED');
  assert.equal(deriveStatusFromPaymentState({ status: 'CANCELLED', payment_state: PAYMENT_STATES.PAID }), 'CANCELLED');
});

test('detects overlaps by room and time range', () => {
  const records = [
    { id: '1', room_id: 'r1', status: 'PENDING', start_at: '2026-01-01T10:00:00.000Z', end_at: '2026-01-01T12:00:00.000Z' },
    { id: '2', room_id: 'r1', status: 'CONFIRMED', start_at: '2026-01-01T11:00:00.000Z', end_at: '2026-01-01T13:00:00.000Z' },
    { id: '3', room_id: 'r2', status: 'CONFIRMED', start_at: '2026-01-01T11:00:00.000Z', end_at: '2026-01-01T13:00:00.000Z' }
  ];

  assert.equal(hasConflict(records[0], records), true);
  assert.equal(hasConflict(records[2], records), false);
});

test('auto-expire only pending unpaid bookings older than threshold', () => {
  const now = new Date('2026-01-02T12:00:00.000Z');
  assert.equal(shouldAutoExpirePendingBooking({ status: 'PENDING', payment_state: 'NONE', created_at: '2026-01-01T11:00:00.000Z' }, 24, now), true);
  assert.equal(shouldAutoExpirePendingBooking({ status: 'PENDING', payment_state: 'PAID', created_at: '2026-01-01T11:00:00.000Z' }, 24, now), false);
  assert.equal(shouldAutoExpirePendingBooking({ status: 'CONFIRMED', payment_state: 'NONE', created_at: '2026-01-01T11:00:00.000Z' }, 24, now), false);
});
