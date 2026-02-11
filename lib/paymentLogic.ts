export type PaymentInput = {
  totalPrice: number | string | null | undefined;
  depositEnabled: boolean;
  depositAmount: number | string | null | undefined;
};

export type PaymentDecisionResult = {
  dueNow: number;
  requiresPayment: boolean;
  status: 'PENDING' | 'CONFIRMED';
  depositPaid: boolean;
};

export const normalizeAmount = (value: number | string | null | undefined): number => {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : 0;
  }

  if (typeof value === 'string' && value.trim().length > 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  return 0;
};

export const computeAmountDueNow = ({ totalPrice, depositEnabled, depositAmount }: PaymentInput): number => {
  const total = Math.max(0, normalizeAmount(totalPrice));
  if (!depositEnabled) {
    return 0;
  }

  const deposit = Math.max(0, normalizeAmount(depositAmount));
  return Math.min(deposit, total);
};

export const getPaymentDecision = ({ totalPrice, depositEnabled, depositAmount }: PaymentInput): PaymentDecisionResult => {
  const dueNow = computeAmountDueNow({ totalPrice, depositEnabled, depositAmount });

  return {
    dueNow,
    requiresPayment: dueNow > 0,
    status: dueNow > 0 ? 'PENDING' : 'CONFIRMED',
    depositPaid: dueNow <= 0
  };
};
