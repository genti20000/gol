const formatTime = (value) => {
  if (!value || typeof value !== 'string') {
    return '';
  }
  const trimmed = value.trim();
  if (trimmed.length === 0) {
    return '';
  }
  return trimmed.length >= 5 ? trimmed.slice(0, 5) : trimmed;
};

const getCheckoutSummaryFields = ({ booking, fallback, baseDurationHours = 2 }) => {
  const bookingDate = booking?.booking_date ?? '';
  const bookingTime = formatTime(booking?.start_time ?? '');
  const bookingGuests = Number.isFinite(booking?.guests) ? booking.guests : undefined;
  const durationHours = Number.isFinite(booking?.duration_hours) ? booking.duration_hours : undefined;
  const extraHoursFromDuration =
    typeof durationHours === 'number'
      ? Math.max(0, durationHours - baseDurationHours)
      : undefined;

  const date = bookingDate || fallback.date || '';
  const time = bookingTime || fallback.time || '';
  const guests =
    typeof bookingGuests === 'number' ? bookingGuests : Number.isFinite(fallback.guests) ? fallback.guests : 0;
  const extraHours =
    typeof extraHoursFromDuration === 'number'
      ? extraHoursFromDuration
      : Number.isFinite(fallback.extraHours)
        ? fallback.extraHours
        : 0;

  const errors = {};
  if (!date) {
    errors.date = 'Select a valid date.';
  }
  if (!time) {
    errors.time = 'Select a time.';
  }

  return {
    date,
    time,
    guests,
    extraHours,
    errors,
    hasValidDateTime: Object.keys(errors).length === 0
  };
};

module.exports = {
  formatTime,
  getCheckoutSummaryFields
};
