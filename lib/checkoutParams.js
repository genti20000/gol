const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;
const TIME_REGEX = /^\d{2}:\d{2}$/;

const safeDecode = (value) => {
  if (typeof value !== 'string') {
    return '';
  }
  try {
    return decodeURIComponent(value);
  } catch (error) {
    return value;
  }
};

const isValidDateTime = (date, time) => {
  if (!DATE_REGEX.test(date) || !TIME_REGEX.test(time)) {
    return false;
  }
  const parsed = Date.parse(`${date}T${time}:00`);
  return Number.isFinite(parsed);
};

const parseCheckoutParams = (searchParams) => {
  const params =
    searchParams instanceof URLSearchParams ? searchParams : new URLSearchParams(searchParams ?? '');
  const date = safeDecode(params.get('date') ?? '').trim();
  const time = safeDecode(params.get('time') ?? '').trim();
  const guestsRaw = params.get('guests');
  const guests = guestsRaw === null || guestsRaw === '' ? Number.NaN : Number.parseInt(guestsRaw, 10);
  const extraHoursRaw = params.get('extraHours');
  const extraHoursParsed =
    extraHoursRaw === null || extraHoursRaw === '' ? 0 : Number.parseInt(extraHoursRaw, 10);
  const extraHours = Number.isFinite(extraHoursParsed) ? extraHoursParsed : Number.NaN;
  const promo = safeDecode(params.get('promo') ?? '').trim();
  const serviceId = safeDecode(params.get('serviceId') ?? '').trim();
  const staffIdRaw = safeDecode(params.get('staffId') ?? '').trim();
  const staffId = staffIdRaw.length > 0 ? staffIdRaw : undefined;

  const errors = {};

  if (!date) {
    errors.date = 'Date is required.';
  } else if (!DATE_REGEX.test(date)) {
    errors.date = 'Date must be in YYYY-MM-DD format.';
  }

  if (!time) {
    errors.time = 'Time is required.';
  } else if (!TIME_REGEX.test(time)) {
    errors.time = 'Time must be in HH:mm format.';
  }

  if (date && time && !errors.date && !errors.time && !isValidDateTime(date, time)) {
    errors.date = errors.date ?? 'Date is invalid.';
    errors.time = errors.time ?? 'Time is invalid.';
  }

  if (!Number.isInteger(guests) || guests < 1) {
    errors.guests = 'Guests must be an integer of at least 1.';
  }

  if (!serviceId) {
    errors.serviceId = 'Service is required.';
  }

  if (!Number.isInteger(extraHours) || extraHours < 0) {
    errors.extraHours = 'Extra hours must be 0 or more.';
  }

  return {
    params: {
      date,
      time,
      guests,
      extraHours,
      promo,
      serviceId,
      staffId
    },
    errors,
    isValid: Object.keys(errors).length === 0
  };
};

module.exports = {
  parseCheckoutParams
};
