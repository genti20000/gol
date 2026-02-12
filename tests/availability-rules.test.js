const test = require('node:test');
const assert = require('node:assert/strict');

const { isBlockingBookingForAvailability, overlapsRange } = require('../lib/availabilityRules');

test('CONFIRMED and PENDING are blocking', () => {
  assert.equal(isBlockingBookingForAvailability({ status: 'CONFIRMED' }, Date.now()), true);
  assert.equal(isBlockingBookingForAvailability({ status: 'PENDING' }, Date.now()), true);
});

test('DRAFT only blocks when expires_at is in the future', () => {
  const now = Date.now();
  assert.equal(
    isBlockingBookingForAvailability({ status: 'DRAFT', expires_at: new Date(now + 5 * 60 * 1000).toISOString() }, now),
    true
  );
  assert.equal(
    isBlockingBookingForAvailability({ status: 'DRAFT', expires_at: new Date(now - 5 * 60 * 1000).toISOString() }, now),
    false
  );
});

test('DRAFT without parseable expires_at does not block', () => {
  assert.equal(isBlockingBookingForAvailability({ status: 'DRAFT', expires_at: null }, Date.now()), false);
  assert.equal(isBlockingBookingForAvailability({ status: 'DRAFT', expires_at: 'not-a-date' }, Date.now()), false);
});

test('CANCELLED and EXPIRED never block', () => {
  assert.equal(isBlockingBookingForAvailability({ status: 'CANCELLED' }, Date.now()), false);
  assert.equal(isBlockingBookingForAvailability({ status: 'EXPIRED' }, Date.now()), false);
});

test('overlapsRange returns true only for overlapping ranges', () => {
  assert.equal(overlapsRange(100, 200, 150, 250), true);
  assert.equal(overlapsRange(100, 200, 200, 300), false);
  assert.equal(overlapsRange(100, 200, 50, 100), false);
});

console.log('availability-rules.test.js passed');
