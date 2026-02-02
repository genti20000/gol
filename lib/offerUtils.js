function computeOfferDiscounts(offers, settingsMidweekPercent, date, baseTotal, extraPrice) {
  const day = new Date(date + 'T00:00:00').getDay();
  const isMidweek = day >= 1 && day <= 3;
  const midweekSetting = settingsMidweekPercent ?? 0;

  let midweekOfferPercent = 0;
  let offerPercent = 0;
  let offerFixed = 0;

  (offers || []).forEach((o) => {
    if (!o || !o.enabled) return;
    const kind = o.woptions?.kind;
    const val = Number(o.woptions?.value ?? 0);
    if (kind === 'midweek' && val > 0) {
      midweekOfferPercent = Math.max(midweekOfferPercent, val);
    } else if (kind === 'percent' && val > 0) {
      offerPercent = Math.max(offerPercent, val);
    } else if (kind === 'fixed' && val > 0) {
      offerFixed += val;
    }
  });

  const effectiveMidweekPercent = isMidweek ? Math.max(midweekSetting, midweekOfferPercent) : 0;
  const midweekDiscountAmount = Math.round((baseTotal + extraPrice) * (effectiveMidweekPercent / 100));

  const afterMidweek = Math.max(0, baseTotal + extraPrice - midweekDiscountAmount);
  const offerPercentDiscountAmount = Math.round(afterMidweek * (offerPercent / 100));

  const totalOfferDiscount = offerPercentDiscountAmount + offerFixed;

  return {
    isMidweek,
    effectiveMidweekPercent,
    midweekDiscountAmount,
    offerPercent,
    offerFixed,
    offerPercentDiscountAmount,
    totalOfferDiscount
  };
}

module.exports = { computeOfferDiscounts };
