const assert = require('node:assert/strict');
const {
  parseServiceCreatePayload,
  parseServicePatchPayload
} = require('../lib/serviceValidation.js');
const {
  parseAdminBookingAction,
  parseBookingId,
  parseBulkBookingPayload,
  parseCancelReason
} = require('../lib/adminBookingValidation.js');

const badCreate = parseServiceCreatePayload({
  name: 'A',
  minPeople: 5,
  maxPeople: 4,
  durationMinutes: 60,
  pricePerPersonPence: 2000
});
assert.equal(badCreate.ok, false);
assert.match(badCreate.error, /maxPeople/);

const validCreate = parseServiceCreatePayload({
  name: ' Premium Room ',
  minPeople: 4,
  maxPeople: 10,
  durationMinutes: 120,
  pricePerPersonPence: 2500,
  depositPerPersonPence: null,
  isActive: true,
  sortOrder: 3
});
assert.equal(validCreate.ok, true);
assert.equal(validCreate.value.name, 'Premium Room');

const badPatch = parseServicePatchPayload({ isActive: 'yes' });
assert.equal(badPatch.ok, false);
assert.match(badPatch.error, /isActive/);

const validPatch = parseServicePatchPayload({ pricePerPersonPence: 3000, sortOrder: 1 });
assert.equal(validPatch.ok, true);
assert.equal(validPatch.value.price_per_person_pence, 3000);

const invalidBulk = parseBulkBookingPayload({ action: 'cancel', ids: ['ok', ' ', 123] });
assert.equal(invalidBulk.ok, false);

const validBulk = parseBulkBookingPayload({ action: 'mark_paid', ids: ['a', 'a', 'b'] });
assert.equal(validBulk.ok, true);
assert.deepEqual(validBulk.value.ids, ['a', 'b']);

const invalidId = parseBookingId('   ');
assert.equal(invalidId.ok, false);

const validId = parseBookingId('  booking_123  ');
assert.equal(validId.ok, true);
assert.equal(validId.value, 'booking_123');

assert.equal(parseAdminBookingAction(undefined).value, 'update_notes');
assert.equal(parseAdminBookingAction('cancel').value, 'cancel');
assert.equal(parseAdminBookingAction('nope').ok, false);

assert.equal(parseCancelReason('auto_expired'), 'auto_expired');
assert.equal(parseCancelReason('anything'), 'admin_cancelled');

console.log('api-validation.test.js passed');
