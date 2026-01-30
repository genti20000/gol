const normalizeAmount = (value) => {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : 0;
  }
  if (typeof value === 'string' && value.trim().length > 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
};

const computeAmountDueNow = ({ totalPrice, depositEnabled, depositAmount }) => {
  const total = Math.max(0, normalizeAmount(totalPrice));
  if (!depositEnabled) {
    return 0;
  }
  const deposit = Math.max(0, normalizeAmount(depositAmount));
  return Math.min(deposit, total);
};

const getPaymentDecision = ({ totalPrice, depositEnabled, depositAmount }) => {
  const dueNow = computeAmountDueNow({ totalPrice, depositEnabled, depositAmount });
  return {
    dueNow,
    requiresPayment: dueNow > 0,
    status: dueNow > 0 ? 'PENDING' : 'CONFIRMED',
    depositPaid: dueNow <= 0
  };
};

module.exports = {
  computeAmountDueNow,
  getPaymentDecision,
  normalizeAmount
};
