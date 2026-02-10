export type OfferKind = 'midweek' | 'percent' | 'fixed';

export type OfferInput = {
  enabled?: boolean | null;
  woptions?: {
    kind?: OfferKind | null;
    value?: number | string | null;
  } | null;
} | null;

export type OfferDiscountResult = {
  isMidweek: boolean;
  effectiveMidweekPercent: number;
  midweekDiscountAmount: number;
  offerPercent: number;
  offerFixed: number;
  offerPercentDiscountAmount: number;
  totalOfferDiscount: number;
};

export function computeOfferDiscounts(
  offers: OfferInput[] | null | undefined,
  settingsMidweekPercent: number | null | undefined,
  date: string,
  baseTotal: number,
  extraPrice: number
): OfferDiscountResult {
  const day = new Date(`${date}T00:00:00`).getDay();
  const isMidweek = day >= 1 && day <= 3;
  const midweekSetting = settingsMidweekPercent ?? 0;

  let midweekOfferPercent = 0;
  let offerPercent = 0;
  let offerFixed = 0;

  (offers || []).forEach((offer) => {
    if (!offer || !offer.enabled) return;
    const kind = offer.woptions?.kind;
    const value = Number(offer.woptions?.value ?? 0);

    if (kind === 'midweek' && value > 0) {
      midweekOfferPercent = Math.max(midweekOfferPercent, value);
    } else if (kind === 'percent' && value > 0) {
      offerPercent = Math.max(offerPercent, value);
    } else if (kind === 'fixed' && value > 0) {
      offerFixed += value;
    }
  });

  const effectiveMidweekPercent = isMidweek ? Math.max(midweekSetting, midweekOfferPercent) : 0;
  const midweekDiscountAmount = Math.round((baseTotal + extraPrice) * (effectiveMidweekPercent / 100));

  const afterMidweek = Math.max(0, baseTotal + extraPrice - midweekDiscountAmount);
  const offerPercentDiscountAmount = Math.round(afterMidweek * (offerPercent / 100));

  return {
    isMidweek,
    effectiveMidweekPercent,
    midweekDiscountAmount,
    offerPercent,
    offerFixed,
    offerPercentDiscountAmount,
    totalOfferDiscount: offerPercentDiscountAmount + offerFixed
  };
}
