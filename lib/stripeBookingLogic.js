const normalizeAmount = (value) => {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : undefined;
  }
  if (typeof value === 'string' && value.trim().length > 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  return undefined;
};

const buildStripeBookingUpdate = ({ amountPaid, stripeSessionId, stripePaymentIntentId }) => {
  const update = {
    status: 'CONFIRMED',
    deposit_paid: true,
    deposit_forfeited: false
  };

  const normalizedAmount = normalizeAmount(amountPaid);
  if (typeof normalizedAmount === 'number') {
    update.amount_paid = normalizedAmount;
  }

  if (stripeSessionId) {
    update.stripe_session_id = stripeSessionId;
  }

  if (stripePaymentIntentId) {
    update.stripe_payment_intent_id = stripePaymentIntentId;
  }

  return update;
};

module.exports = {
  buildStripeBookingUpdate
};
