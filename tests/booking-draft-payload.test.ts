import assert from 'node:assert/strict';

import { buildDraftBookingPayload } from '../lib/bookingPayload';

const payload = buildDraftBookingPayload({
  roomId: 'room-1',
  roomName: 'Room 1',
  date: '2026-02-26',
  time: '19:30',
  extraHours: 0,
  baseDurationHours: 2,
  baseTotal: 100,
  extrasPrice: 0,
  discountAmount: 0,
  promoCode: null,
  totalPrice: 100,
  expiresAt: new Date(Date.now() + 20 * 60 * 1000).toISOString(),
  firstName: 'Test',
  surname: 'User',
  email: 'test@example.com'
});

assert.equal(typeof payload.booking_date, 'string', 'booking_date should be a string');
assert.equal(payload.booking_date, '2026-02-26', 'booking_date should match input date in YYYY-MM-DD');
assert.equal(typeof payload.start_time, 'string', 'start_time should be set');
assert.equal(payload.start_time, '19:30', 'start_time should match input time');
assert.ok(payload.start_at && payload.end_at, 'start_at and end_at should be present');

console.log('booking-draft-payload.test.ts passed');
