const { computeOfferDiscounts } = require('../lib/offerUtils');

function runTest() {
  const baseTotal = 100;
  const extraPrice = 20;
  const dateMidweek = '2026-02-03'; // Tuesday
  const dateWeekend = '2026-02-07'; // Saturday

  // midweek offer via settings
  let res = computeOfferDiscounts([], 15, dateMidweek, baseTotal, extraPrice);
  if (res.effectiveMidweekPercent !== 15) throw new Error('midweek percent from settings');

  // midweek offer via offer list (overrides if higher)
  res = computeOfferDiscounts([{ enabled: true, woptions: { kind: 'midweek', value: 25 } }], 15, dateMidweek, baseTotal, extraPrice);
  if (res.effectiveMidweekPercent !== 25) throw new Error('midweek percent from offer override');

  // percent + fixed offers
  res = computeOfferDiscounts([
    { enabled: true, woptions: { kind: 'percent', value: 10 } },
    { enabled: true, woptions: { kind: 'fixed', value: 5 } }
  ], 0, dateWeekend, baseTotal, extraPrice);
  if (res.offerPercent !== 10) throw new Error('offer percent present');
  if (res.offerFixed !== 5) throw new Error('offer fixed present');

  // totalOfferDiscount calculation sanity
  const totals = computeOfferDiscounts([
    { enabled: true, woptions: { kind: 'percent', value: 10 } },
    { enabled: true, woptions: { kind: 'fixed', value: 5 } }
  ], 0, dateWeekend, baseTotal, extraPrice);
  const afterMid = baseTotal + extraPrice - totals.midweekDiscountAmount;
  const percentAmt = Math.round(afterMid * (totals.offerPercent / 100));
  if (totals.totalOfferDiscount !== percentAmt + totals.offerFixed) throw new Error('totalOfferDiscount mismatch');

  console.log('offer-utils.test.js passed');
}

runTest();
