const toMoney = (value) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 0;
  return Number(parsed.toFixed(2));
};

const sumLineItems = (lineItems) => {
  if (!Array.isArray(lineItems)) return 0;
  return toMoney(
    lineItems.reduce((acc, item) => {
      const lineTotal = Number(item?.lineTotal);
      return acc + (Number.isFinite(lineTotal) ? lineTotal : 0);
    }, 0)
  );
};

/**
 * @param {{
 *  baseTotal?: number,
 *  extrasPrice?: number,
 *  discountAmount?: number,
 *  promoDiscountAmount?: number,
 *  lineItems?: Array<{ lineTotal?: number }>
 * }} input
 */
const computeBookingTotals = ({
  baseTotal = 0,
  extrasPrice = 0,
  discountAmount = 0,
  promoDiscountAmount = 0,
  lineItems = []
}) => {
  const normalizedBaseTotal = toMoney(baseTotal);
  const normalizedExtrasPrice = toMoney(extrasPrice);
  const normalizedDiscountAmount = toMoney(discountAmount);
  const normalizedPromoDiscountAmount = toMoney(promoDiscountAmount);
  const extrasTotal = sumLineItems(lineItems);

  const grandTotal = toMoney(
    Math.max(
      0,
      normalizedBaseTotal +
        normalizedExtrasPrice +
        extrasTotal -
        normalizedDiscountAmount -
        normalizedPromoDiscountAmount
    )
  );

  return {
    baseTotal: normalizedBaseTotal,
    extrasPrice: normalizedExtrasPrice,
    discountAmount: normalizedDiscountAmount,
    promoDiscountAmount: normalizedPromoDiscountAmount,
    extrasTotal,
    grandTotal
  };
};

module.exports = {
  computeBookingTotals
};
