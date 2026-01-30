const assert = require('node:assert/strict');
const { buildStripeBookingUpdate } = require('../lib/stripeBookingLogic.js');

const update = buildStripeBookingUpdate({
  amountPaid: 50,
  stripeSessionId: 'cs_test_123',
  stripePaymentIntentId: 'pi_test_456'
});

assert.equal(update.status, 'CONFIRMED', 'Webhook update should confirm the booking.');
assert.equal(update.deposit_paid, true, 'Webhook update should mark deposit paid.');
assert.equal(update.deposit_forfeited, false, 'Webhook update should clear deposit forfeiture.');
assert.equal(update.amount_paid, 50, 'Webhook update should record amount paid.');
assert.equal(update.stripe_session_id, 'cs_test_123', 'Webhook update should store session id.');
assert.equal(update.stripe_payment_intent_id, 'pi_test_456', 'Webhook update should store payment intent id.');

console.log('stripe-webhook.test.js passed');
