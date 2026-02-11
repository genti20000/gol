const PAYMENT_STATES = {
  NONE: 'NONE',
  DEPOSIT_HELD: 'DEPOSIT_HELD',
  PAID: 'PAID',
  REFUNDED: 'REFUNDED'
};

const NOTES_MAX_LENGTH = 300;

const hasMissingCustomerDetails = (booking) => {
  const name = String(booking?.customer_name ?? '').trim();
  const email = String(booking?.customer_email ?? '').trim();
  return !name || !email;
};

const hasObviousGarbage = (text) => /(.)\1{6,}/.test(String(text ?? ''));

const validateNotesInput = (notes) => {
  if (notes === null || notes === undefined || String(notes).trim().length === 0) {
    return { ok: true, normalized: null };
  }

  if (typeof notes !== 'string') {
    return { ok: false, error: 'Notes must be text.' };
  }

  const normalized = notes.trim();
  if (normalized.length > NOTES_MAX_LENGTH) {
    return { ok: false, error: `Notes must be ${NOTES_MAX_LENGTH} characters or less.` };
  }

  if (hasObviousGarbage(normalized)) {
    return { ok: false, error: 'Notes look invalid (repeated character sequence).' };
  }

  return { ok: true, normalized };
};

const deriveStatusFromPaymentState = (booking) => {
  const status = booking?.status;
  const paymentState = booking?.payment_state ?? PAYMENT_STATES.NONE;

  if (status === 'CANCELLED') return 'CANCELLED';
  if (status === 'EXPIRED') return 'EXPIRED';

  if (paymentState === PAYMENT_STATES.DEPOSIT_HELD || paymentState === PAYMENT_STATES.PAID) {
    return 'CONFIRMED';
  }

  return 'PENDING';
};

const hasConflict = (booking, bookings) => {
  if (!booking || booking.status === 'CANCELLED' || booking.status === 'EXPIRED') return false;
  const start = new Date(booking.start_at).getTime();
  const end = new Date(booking.end_at).getTime();

  return bookings.some((other) => {
    if (!other || other.id === booking.id) return false;
    if (other.status === 'CANCELLED' || other.status === 'EXPIRED') return false;
    if (other.room_id !== booking.room_id) return false;
    const otherStart = new Date(other.start_at).getTime();
    const otherEnd = new Date(other.end_at).getTime();
    return start < otherEnd && end > otherStart;
  });
};

const shouldAutoExpirePendingBooking = (booking, expiryHours = 24, now = new Date()) => {
  if (!booking) return false;
  if (booking.status !== 'PENDING') return false;
  if ((booking.payment_state ?? PAYMENT_STATES.NONE) !== PAYMENT_STATES.NONE) return false;

  const createdAt = new Date(booking.created_at).getTime();
  if (!Number.isFinite(createdAt)) return false;

  return now.getTime() - createdAt >= expiryHours * 60 * 60 * 1000;
};

module.exports = {
  PAYMENT_STATES,
  NOTES_MAX_LENGTH,
  hasMissingCustomerDetails,
  hasObviousGarbage,
  validateNotesInput,
  deriveStatusFromPaymentState,
  hasConflict,
  shouldAutoExpirePendingBooking
};
