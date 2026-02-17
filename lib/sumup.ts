import SumUp from '@sumup/sdk';

type SumupCreateCheckoutInput = {
  bookingId: string;
  amount: number;
  description: string;
  redirectUrl?: string | null;
  returnUrl?: string | null;
};

export type SumupCheckout = {
  id: string;
  checkoutReference: string | null;
  amount: number;
  currency: string;
  status: string | null;
  hostedCheckoutUrl: string | null;
};

const SUMUP_API_KEY = (process.env.SUMUP_API_KEY ?? '').trim();
const SUMUP_MERCHANT_CODE = (process.env.SUMUP_MERCHANT_CODE ?? '').trim();
const SUMUP_CURRENCY = (process.env.SUMUP_CURRENCY ?? 'GBP').trim().toUpperCase();
const SUMUP_API_BASE_URL = (process.env.SUMUP_API_BASE_URL ?? 'https://api.sumup.com').replace(/\/+$/, '');

export class SumupConfigError extends Error {}
export class SumupRequestError extends Error {}

const normalizeAmount = (value: number): number => {
  if (!Number.isFinite(value)) return 0;
  return Math.round(Math.max(0, value) * 100) / 100;
};

const assertConfigured = (): void => {
  if (!SUMUP_API_KEY || !SUMUP_MERCHANT_CODE) {
    throw new SumupConfigError('SumUp is not configured. Set SUMUP_API_KEY and SUMUP_MERCHANT_CODE.');
  }
};

const getClient = (): SumUp => {
  assertConfigured();
  return new SumUp({
    apiKey: SUMUP_API_KEY,
    host: SUMUP_API_BASE_URL
  });
};

const toCheckout = (body: any): SumupCheckout => ({
  id: String(body?.id || '').trim(),
  checkoutReference: body?.checkout_reference
    ? String(body.checkout_reference)
    : body?.checkoutReference
      ? String(body.checkoutReference)
      : null,
  amount: normalizeAmount(Number(body?.amount ?? 0)),
  currency: String(body?.currency || SUMUP_CURRENCY),
  status: body?.status ? String(body.status) : null,
  hostedCheckoutUrl: body?.hosted_checkout_url
    ? String(body.hosted_checkout_url)
    : body?.hostedCheckoutUrl
      ? String(body.hostedCheckoutUrl)
      : null
});

export async function createSumupCheckout(input: SumupCreateCheckoutInput): Promise<SumupCheckout> {
  const amount = normalizeAmount(input.amount);
  if (amount <= 0) {
    throw new SumupRequestError('Payment amount must be greater than zero.');
  }

  const payload: any = {
    checkout_reference: `booking-${input.bookingId}-${Date.now()}`.slice(0, 90),
    amount,
    currency: SUMUP_CURRENCY,
    merchant_code: SUMUP_MERCHANT_CODE,
    description: input.description,
    hosted_checkout: { enabled: true }
  };

  if (input.redirectUrl) {
    payload.redirect_url = input.redirectUrl;
  }
  if (input.returnUrl) {
    payload.return_url = input.returnUrl;
  }

  try {
    const body = await getClient().checkouts.create(payload);
    const checkout = toCheckout(body);
    if (!checkout.id) {
      throw new SumupRequestError('SumUp response did not include checkout id.');
    }
    return checkout;
  } catch (error: any) {
    const reason =
      error?.body?.message ||
      error?.body?.error ||
      error?.message ||
      'Unknown SumUp error';
    throw new SumupRequestError(`SumUp checkout creation failed: ${reason}`);
  }
}

export async function getSumupCheckout(checkoutId: string): Promise<SumupCheckout> {
  const normalizedCheckoutId = String(checkoutId || '').trim();
  if (!normalizedCheckoutId) {
    throw new SumupRequestError('Checkout ID is required.');
  }

  try {
    const body = await getClient().checkouts.get(normalizedCheckoutId);
    const checkout = toCheckout(body);
    if (!checkout.id) {
      throw new SumupRequestError('SumUp checkout response did not include id.');
    }
    return checkout;
  } catch (error: any) {
    const reason =
      error?.body?.message ||
      error?.body?.error ||
      error?.message ||
      'Unknown SumUp error';
    throw new SumupRequestError(`SumUp checkout lookup failed: ${reason}`);
  }
}

export function buildSumupHostedCheckoutUrl(checkoutId: string): string {
  const normalizedCheckoutId = String(checkoutId || '').trim();
  if (!normalizedCheckoutId) {
    throw new SumupRequestError('SumUp response did not include checkout id or hosted checkout URL.');
  }
  return `https://gateway.sumup.com/checkouts/${encodeURIComponent(normalizedCheckoutId)}`;
}
