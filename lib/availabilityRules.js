const BLOCKING_STATUSES = new Set(['CONFIRMED', 'PENDING']);

const parseIsoTimestamp = (value) => {
  if (!value) return null;
  const ts = Date.parse(String(value));
  return Number.isFinite(ts) ? ts : null;
};

const isBlockingBookingForAvailability = (booking, nowMs = Date.now()) => {
  const status = String(booking?.status || '');
  if (BLOCKING_STATUSES.has(status)) return true;
  if (status === 'DRAFT') {
    const expiresAtMs = parseIsoTimestamp(booking?.expires_at);
    return expiresAtMs !== null && expiresAtMs > nowMs;
  }
  return false;
};

const overlapsRange = (aStartMs, aEndMs, bStartMs, bEndMs) => {
  return aStartMs < bEndMs && aEndMs > bStartMs;
};

module.exports = {
  BLOCKING_STATUSES,
  isBlockingBookingForAvailability,
  overlapsRange
};
