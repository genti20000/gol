const assert = require('node:assert/strict');
const { computeBookingTotals } = require('../lib/bookingTotals.js');

const lineItems = [
  { extraId: 'ext-1', nameSnapshot: 'Bottle', quantity: 2, lineTotal: 70 },
  { extraId: 'ext-2', nameSnapshot: 'Snacks', quantity: 1, lineTotal: 15 }
];

const totals = computeBookingTotals({
  baseTotal: 238,
  extrasPrice: 0,
  discountAmount: 0,
  promoDiscountAmount: 0,
  lineItems
});

const payload = {
  room_id: 'room-a',
  room_name: 'Terrace',
  booking_date: '2026-02-12',
  start_time: '19:00',
  base_total: totals.baseTotal,
  extras_price: totals.extrasPrice,
  discount_amount: totals.discountAmount,
  promo_discount_amount: totals.promoDiscountAmount
};

payload.extras_snapshot = lineItems;
payload.extras_total = totals.extrasTotal;
payload.total_price = totals.grandTotal;

assert.equal(payload.extras_total, 85, 'Payload should persist computed extras total.');
assert.equal(payload.total_price, 323, 'Payload grand total should include extras.');
assert.equal(payload.extras_snapshot.length, 2, 'Payload should persist extras line items.');

console.log('booking-extras-persistence.test.js passed');
