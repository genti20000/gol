const parseTimeToMinutes = (time) => {
  if (typeof time !== 'string') return null;
  const match = /^(\d{2}):(\d{2})$/.exec(time.trim());
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return null;
  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return null;
  return hours * 60 + minutes;
};

const computeEarlyBirdDiscount = ({
  baseTotal = 0,
  guests = 0,
  startTime = '',
  targetPricePerPerson = 15,
  lastStartTime = '19:00'
}) => {
  const normalizedBaseTotal = Number(baseTotal) || 0;
  const normalizedGuests = Math.max(0, Number(guests) || 0);
  const slotMinutes = parseTimeToMinutes(startTime);
  const cutoffMinutes = parseTimeToMinutes(lastStartTime);

  if (!slotMinutes && slotMinutes !== 0) {
    return { eligible: false, discountAmount: 0, discountPercent: 0, effectivePp: null };
  }
  if (!cutoffMinutes && cutoffMinutes !== 0) {
    return { eligible: false, discountAmount: 0, discountPercent: 0, effectivePp: null };
  }
  if (normalizedGuests <= 0 || normalizedBaseTotal <= 0 || slotMinutes > cutoffMinutes) {
    return { eligible: false, discountAmount: 0, discountPercent: 0, effectivePp: null };
  }

  const targetBaseTotal = Number((targetPricePerPerson * normalizedGuests).toFixed(2));
  const discountAmount = Math.max(0, Number((normalizedBaseTotal - targetBaseTotal).toFixed(2)));
  const discountPercent = normalizedBaseTotal > 0
    ? Math.round((discountAmount / normalizedBaseTotal) * 100)
    : 0;

  return {
    eligible: discountAmount > 0,
    discountAmount,
    discountPercent,
    effectivePp: Number((Math.max(0, normalizedBaseTotal - discountAmount) / normalizedGuests).toFixed(2))
  };
};

module.exports = {
  parseTimeToMinutes,
  computeEarlyBirdDiscount
};
