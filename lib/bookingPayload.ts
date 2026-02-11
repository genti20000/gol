// Helper to build booking payloads used by server endpoints and tests

export type BuildDraftBookingPayloadInput = {
  roomId: string;
  roomName: string;
  serviceId?: string | null;
  staffId?: string | null;
  date: string;
  time: string;
  extraHours?: number;
  baseDurationHours?: number;
  baseTotal?: number;
  extrasPrice?: number;
  discountAmount?: number;
  promoCode?: string | null;
  promoDiscountAmount?: number;
  totalPrice?: number;
  source?: string;
  depositAmount?: number;
  depositPaid?: boolean;
  expiresAt?: string | null;
  firstName?: string;
  surname?: string;
  email?: string | null;
  phone?: string | null;
  notes?: string | null;
  specialRequests?: string | null;
};

export type DraftBookingPayload = {
  room_id: string;
  room_name: string;
  service_id: string | null;
  staff_id: string | null;
  booking_date: string;
  start_time: string;
  duration_hours: number;
  start_at: string;
  end_at: string;
  status: string;
  expires_at: string | null;
  guests: number | undefined;
  customer_name: string | null;
  customer_surname: string | null;
  customer_email: string | null;
  customer_phone: string | null;
  notes: string | null;
  special_requests: string | null;
  base_total: number;
  extras_hours: number;
  extras_price: number;
  discount_amount: number;
  promo_code: string | null;
  promo_discount_amount: number;
  total_price: number;
  source: string;
  deposit_amount: number;
  deposit_paid: boolean;
  extras_total: number;
  extras_snapshot: unknown[];
};

export const toIsoDate = (isoString: string | null | undefined): string => {
  if (!isoString || typeof isoString !== 'string') return '';
  return isoString.split('T')[0];
};

export const formatTimeHHMM = (isoString: string | null | undefined): string => {
  if (!isoString || typeof isoString !== 'string') return '';
  const timePart = isoString.split('T')[1] || '';
  return timePart ? timePart.substring(0, 5) : '';
};

export function buildDraftBookingPayload({
  roomId,
  roomName,
  serviceId = null,
  staffId = null,
  date,
  time,
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
  notes = null,
  specialRequests = null
}: BuildDraftBookingPayloadInput): DraftBookingPayload {
  const startTimestamp = Date.parse(`${date}T${time}:00`);
  const startDate = new Date(startTimestamp);
  const totalDurationHours = baseDurationHours + Number(extraHours || 0);
  const endDate = new Date(startDate.getTime() + totalDurationHours * 3600000);

  return {
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
    special_requests: specialRequests || null,
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
}
