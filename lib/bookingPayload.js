// Helper to build booking payloads used by server endpoints and tests
const SLOT_MS = 60000;

const toIsoDate = (isoString) => {
  if (!isoString || typeof isoString !== 'string') return '';
  // Expect an ISO timestamp (UTC) or full datetime; take YYYY-MM-DD portion
  return isoString.split('T')[0];
};

const formatTimeHHMM = (isoString) => {
  if (!isoString || typeof isoString !== 'string') return '';
  const timePart = isoString.split('T')[1] || '';
  return timePart ? timePart.substring(0,5) : '';
};

function buildDraftBookingPayload({
  roomId,
  roomName,
  serviceId = null,
  staffId = null,
  date, // YYYY-MM-DD
  time, // HH:MM
  extraHours = 0,
  baseDurationHours = 2,
  baseTotal = 0,
  extrasPrice = 0,
  discountAmount = 0,
  promoCode = null,
  promoDiscountAmount = 0,
  totalPrice = 0,
  source = 'public',
  depositAmount = 0,
  depositPaid = false,
  expiresAt = null,
  firstName = '',
  surname = '',
  email = null,
  phone = null,
  notes = null
}) {
  const startTimestamp = Date.parse(`${date}T${time}:00`);
  const startDate = new Date(startTimestamp);
  const totalDurationHours = baseDurationHours + Number(extraHours || 0);
  const endDate = new Date(startDate.getTime() + totalDurationHours * 3600000);

  const payload = {
    room_id: roomId,
    room_name: roomName,
    service_id: serviceId,
    staff_id: staffId,
    booking_date: date,
    start_time: time,
    duration_hours: totalDurationHours,
    start_at: startDate.toISOString(),
    end_at: endDate.toISOString(),
    status: 'DRAFT',
    expires_at: expiresAt,
    guests: undefined,
    customer_name: `${firstName} ${surname}`.trim() || null,
    customer_surname: surname || null,
    customer_email: email || null,
    customer_phone: phone || null,
    notes: notes || null,
    base_total: baseTotal,
    extras_hours: extraHours,
    extras_price: extrasPrice,
    discount_amount: discountAmount,
    promo_code: promoCode,
    promo_discount_amount: promoDiscountAmount,
    total_price: totalPrice,
    source,
    deposit_amount: depositAmount,
    deposit_paid: depositPaid,
    extras_total: 0,
    extras_snapshot: []
  };

  return payload;
}

module.exports = { buildDraftBookingPayload, toIsoDate, formatTimeHHMM };
