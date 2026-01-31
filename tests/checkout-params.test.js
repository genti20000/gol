const assert = require('node:assert/strict');
const { parseCheckoutParams } = require('../lib/checkoutParams.js');

const validParams = new URLSearchParams(
  'date=2026-02-26&time=18%3A00&guests=8&extraHours=0&serviceId=srv-1&staffId='
);
const validResult = parseCheckoutParams(validParams);
assert.equal(validResult.isValid, true, 'Empty staffId should be allowed.');
assert.equal(validResult.params.staffId, undefined, 'Empty staffId should normalize to undefined.');
assert.equal(validResult.params.time, '18:00', 'URL-encoded time should decode.');

const invalidGuests = parseCheckoutParams(
  new URLSearchParams('date=2026-02-26&time=18:00&guests=abc&serviceId=srv-1')
);
assert.equal(invalidGuests.isValid, false, 'Non-numeric guests should fail.');
assert.ok(invalidGuests.errors.guests, 'Guests error should be present.');

const invalidTime = parseCheckoutParams(
  new URLSearchParams('date=2026-02-26&time=99:99&guests=8&serviceId=srv-1')
);
assert.equal(invalidTime.isValid, false, 'Invalid time should fail.');
assert.ok(invalidTime.errors.time, 'Time error should be present.');

console.log('checkout-params.test.js passed');
