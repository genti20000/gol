const assert = require('node:assert/strict');
const { computeAmountDueNow, getPaymentDecision } = require('../lib/paymentLogic.js');

assert.equal(
  computeAmountDueNow({ totalPrice: 120, depositEnabled: false, depositAmount: 50 }),
  0,
  'Deposit disabled should result in £0 due now.'
);

const zeroDepositDecision = getPaymentDecision({ totalPrice: 120, depositEnabled: true, depositAmount: 0 });
assert.equal(zeroDepositDecision.requiresPayment, false, 'Zero deposit should skip payment.');
assert.equal(zeroDepositDecision.status, 'CONFIRMED', 'Zero deposit should confirm booking.');
assert.equal(zeroDepositDecision.depositPaid, true, 'Zero deposit should mark deposit as paid.');

const paidDecision = getPaymentDecision({ totalPrice: 120, depositEnabled: true, depositAmount: 40 });
assert.equal(paidDecision.requiresPayment, true, 'Positive deposit should require payment.');
assert.equal(paidDecision.status, 'PENDING', 'Positive deposit should keep booking pending.');

console.log('payment-logic.test.js passed');
