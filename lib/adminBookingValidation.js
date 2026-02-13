const isObject = (value) =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const isSafeBookingId = (value) =>
  typeof value === 'string' && value.trim().length > 0 && value.trim().length <= 128;

function parseBookingId(value) {
  if (!isSafeBookingId(value)) {
    return { ok: false, error: 'Invalid booking id.' };
  }
  return { ok: true, value: value.trim() };
}

function parseBulkBookingPayload(payload) {
  if (!isObject(payload)) {
    return { ok: false, error: 'Invalid request body.' };
  }

  const action = payload.action;
  if (action !== 'cancel' && action !== 'mark_paid' && action !== 'delete') {
    return { ok: false, error: 'Unsupported bulk action.' };
  }

  const rawIds = payload.ids;
  if (!Array.isArray(rawIds) || rawIds.length === 0) {
    return { ok: false, error: 'At least one booking id is required.' };
  }

  const deduped = [];
  const seen = new Set();

  for (const candidate of rawIds) {
    if (!isSafeBookingId(candidate)) {
      return { ok: false, error: 'Invalid booking id in ids.' };
    }
    const normalized = candidate.trim();
    if (!seen.has(normalized)) {
      seen.add(normalized);
      deduped.push(normalized);
    }
  }

  if (deduped.length > 200) {
    return { ok: false, error: 'Too many booking ids. Maximum is 200 per request.' };
  }

  const includeExpired = payload.includeExpired === true;
  return { ok: true, value: { action, ids: deduped, includeExpired } };
}

function parseAdminBookingAction(value) {
  const action = value ?? 'update_notes';
  if (
    action !== 'update_notes' &&
    action !== 'mark_paid' &&
    action !== 'cancel' &&
    action !== 'send_payment_link'
  ) {
    return { ok: false, error: 'Unsupported action.' };
  }

  return { ok: true, value: action };
}

function parseCancelReason(value) {
  return value === 'auto_expired' ? 'auto_expired' : 'admin_cancelled';
}

module.exports = {
  parseAdminBookingAction,
  parseBookingId,
  parseBulkBookingPayload,
  parseCancelReason
};
