const assert = require('node:assert/strict');
const {
  getExtraMaxQuantity,
  normalizeContactField,
  validateBookingUpdateInput
} = require('../lib/bookingUpdateValidation.js');

const malformed = validateBookingUpdateInput(null);
assert.equal(malformed.isValid, false, 'Null payload should be rejected.');
assert.equal(malformed.fieldErrors.payload, 'Payload must be a JSON object.');

const unknownField = validateBookingUpdateInput({ badField: true });
assert.equal(unknownField.isValid, false, 'Unknown top-level fields should be rejected.');
assert.match(unknownField.fieldErrors.payload, /Unknown fields/);

const badExtrasType = validateBookingUpdateInput({ extras: [] });
assert.equal(badExtrasType.isValid, false, 'extras array should be rejected.');
assert.equal(badExtrasType.fieldErrors.extras, 'extras must be an object mapping extra IDs to quantities.');

const invalidQuantity = validateBookingUpdateInput({ extras: { a: 1.2, b: -1, c: Number.POSITIVE_INFINITY } });
assert.equal(invalidQuantity.isValid, false, 'Non-integer, negative and infinite quantities should fail.');
assert.equal(invalidQuantity.fieldErrors['extras.a'], 'Quantity must be a finite integer.');
assert.equal(invalidQuantity.fieldErrors['extras.b'], 'Quantity must be greater than or equal to 0.');
assert.equal(invalidQuantity.fieldErrors['extras.c'], 'Quantity must be a finite integer.');

const valid = validateBookingUpdateInput({
  firstName: '  Jane ',
  surname: ' ',
  email: ' test@example.com ',
  phone: '',
  notes: '  hello ',
  specialRequests: ' ',
  extras: { e1: 0, e2: 3 }
});
assert.equal(valid.isValid, true, 'Valid payload should pass.');
assert.equal(valid.normalized.firstName, 'Jane');
assert.equal(valid.normalized.surname, null, 'Blank surname should normalize to null.');
assert.equal(valid.normalized.email, 'test@example.com');
assert.equal(valid.normalized.phone, null);
assert.equal(valid.normalized.specialRequests, null);
assert.deepEqual(valid.normalized.extras, { e1: 0, e2: 3 });

assert.equal(normalizeContactField('   '), null, 'Empty strings should normalize to null.');
assert.equal(normalizeContactField('  abc  '), 'abc', 'Contact fields should be trimmed.');

assert.equal(getExtraMaxQuantity({ max_quantity: 3 }), 3, 'Should read snake_case cap.');
assert.equal(getExtraMaxQuantity({ maxQuantity: '2' }), 2, 'Should parse camelCase cap.');
assert.equal(getExtraMaxQuantity({ max_qty: -1 }), null, 'Negative cap should be ignored.');
assert.equal(getExtraMaxQuantity({ maximum_quantity: 'abc' }), null, 'Non-numeric cap should be ignored.');

console.log('booking-update-validation.test.js passed');
