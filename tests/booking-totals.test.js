const assert = require('node:assert/strict');
const { computeBookingTotals } = require('../lib/bookingTotals.js');

{
  const totals = computeBookingTotals({
    baseTotal: 200,
    extrasPrice: 34,
    discountAmount: 10,
    promoDiscountAmount: 4,
    lineItems: []
  });
  assert.equal(totals.extrasTotal, 0, 'No line items should produce zero extras total.');
  assert.equal(totals.grandTotal, 220, 'Grand total should include base/session extras and discounts.');
}

{
  const totals = computeBookingTotals({
    baseTotal: 100,
    extrasPrice: 0,
    discountAmount: 0,
    promoDiscountAmount: 0,
    lineItems: [{ lineTotal: 25 }]
  });
  assert.equal(totals.extrasTotal, 25, 'Single extra line item should be added.');
  assert.equal(totals.grandTotal, 125, 'Grand total should include extras.');
}

{
  const totals = computeBookingTotals({
    baseTotal: 150,
    extrasPrice: 20,
    discountAmount: 15,
    promoDiscountAmount: 0,
    lineItems: [{ lineTotal: 30 }, { lineTotal: 30 }]
  });
  assert.equal(totals.extrasTotal, 60, 'Multiple line items should sum correctly.');
  assert.equal(totals.grandTotal, 215, 'Grand total should use canonical formula.');
}

{
  const totals = computeBookingTotals({
    baseTotal: 10,
    extrasPrice: 0,
    discountAmount: 100,
    promoDiscountAmount: 50,
    lineItems: []
  });
  assert.equal(totals.grandTotal, 0, 'Grand total should never go below zero.');
}

console.log('booking-totals.test.js passed');
