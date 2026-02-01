export const REQUIRED_BOOKING_DRAFT_FIELDS = [
  'date',
  'time',
  'guests',
  'extraHours',
  'firstName',
  'surname',
  'email'
] as const;

export const REQUIRED_BOOKING_INSERT_FIELDS = [
  'room_id',
  'room_name',
  'start_at',
  'end_at',
  'status',
  'guests',
  'customer_name',
  'customer_email',
  'base_total',
  'extras_price',
  'discount_amount',
  'total_price',
  'deposit_amount'
] as const;

export type BookingDraftInput = {
  date?: string | null;
  time?: string | null;
  guests?: number | string | null;
  extraHours?: number | string | null;
  firstName?: string | null;
  surname?: string | null;
  email?: string | null;
};

export type BookingDraftValidationResult = {
  normalized: {
    date: string;
    time: string;
    guests: number;
    extraHours: number;
    firstName: string;
    surname: string;
    email: string;
  };
  fieldErrors: Record<string, string>;
  isValid: boolean;
};

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const parseNumberInput = (value: number | string | null | undefined) => {
  if (typeof value === 'number') return value;
  if (typeof value === 'string' && value.trim().length > 0) return Number(value);
  return NaN;
};

const parseOptionalHours = (value: number | string | null | undefined) => {
  if (value === null || value === undefined) return 0;
  if (typeof value === 'string' && value.trim().length === 0) return 0;
  return parseNumberInput(value);
};

const safeDecode = (value: string) => {
  try {
    return decodeURIComponent(value);
  } catch (error) {
    return value;
  }
};

export const normalizeBookingDraftInput = (input: BookingDraftInput) => ({
  date: safeDecode(input.date?.trim() ?? ''),
  time: safeDecode(input.time?.trim() ?? ''),
  guests: parseNumberInput(input.guests),
  extraHours: parseOptionalHours(input.extraHours),
  firstName: input.firstName?.trim() ?? '',
  surname: input.surname?.trim() ?? '',
  email: input.email?.trim().toLowerCase() ?? ''
});

export const isValidBookingDateTime = (date: string, time: string) => {
  if (!date || !time) return false;
  const parsed = Date.parse(`${date}T${time}:00`);
  return Number.isFinite(parsed);
};

export const buildCustomerName = (firstName: string, surname: string) =>
  `${firstName} ${surname}`.trim();

export const validateBookingInitInput = (input: BookingDraftInput): BookingDraftValidationResult => {
  const normalized = normalizeBookingDraftInput(input);
  const fieldErrors: Record<string, string> = {};

  if (!normalized.date) {
    fieldErrors.date = 'Date is required.';
  }

  if (!normalized.time) {
    fieldErrors.time = 'Time is required.';
  }

  if (normalized.date && normalized.time && !isValidBookingDateTime(normalized.date, normalized.time)) {
    fieldErrors.date = fieldErrors.date ?? 'Select a valid date.';
    fieldErrors.time = fieldErrors.time ?? 'Select a valid time.';
  }

  if (!Number.isFinite(normalized.guests)) {
    fieldErrors.guests = 'Guest count is required.';
  }

  if (!Number.isFinite(normalized.extraHours)) {
    fieldErrors.extraHours = 'Session length is required.';
  } else if (normalized.extraHours < 0) {
    fieldErrors.extraHours = 'Session length is required.';
  }

  return { normalized, fieldErrors, isValid: Object.keys(fieldErrors).length === 0 };
};

export const validateBookingDraftInput = (input: BookingDraftInput): BookingDraftValidationResult => {
  const normalized = normalizeBookingDraftInput(input);
  const fieldErrors: Record<string, string> = {};

  // All Init fields must be present
  const initResult = validateBookingInitInput(input);
  Object.assign(fieldErrors, initResult.fieldErrors);

  // Plus customer details
  if (!normalized.firstName) {
    fieldErrors.firstName = 'First name is required.';
  }

  if (!normalized.surname) {
    fieldErrors.surname = 'Surname is required.';
  }

  if (!normalized.email) {
    fieldErrors.email = 'Email is required.';
  } else if (!EMAIL_REGEX.test(normalized.email)) {
    fieldErrors.email = 'Enter a valid email address.';
  }

  return { normalized, fieldErrors, isValid: Object.keys(fieldErrors).length === 0 };
};
