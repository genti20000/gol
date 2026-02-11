const test = require('node:test');
const assert = require('node:assert/strict');

const { computeEarlyBirdDiscount } = require('../lib/earlyBird');

test('applies early bird discount before 19:00', () => {
  const result = computeEarlyBirdDiscount({
    baseTotal: 238,
    guests: 14,
    startTime: '18:30',
    targetPricePerPerson: 15,
    lastStartTime: '19:00'
  });

  assert.equal(result.eligible, true);
  assert.equal(result.discountAmount, 28);
  assert.equal(result.discountPercent, 12);
  assert.equal(result.effectivePp, 15);
});

test('does not apply early bird discount after 19:00', () => {
  const result = computeEarlyBirdDiscount({
    baseTotal: 238,
    guests: 14,
    startTime: '19:30',
    targetPricePerPerson: 15,
    lastStartTime: '19:00'
  });

  assert.equal(result.eligible, false);
  assert.equal(result.discountAmount, 0);
});
