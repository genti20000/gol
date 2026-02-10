const ALLOWED_UPDATE_KEYS = new Set([
  'firstName',
  'surname',
  'email',
  'phone',
  'notes',
  'specialRequests',
  'extras'
]);

const CONTACT_KEYS = ['firstName', 'surname', 'email', 'phone', 'notes', 'specialRequests'];

const normalizeContactField = (value) => {
  if (value === null) return null;
  if (value === undefined) return undefined;
  if (typeof value !== 'string') return value;

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

const isPlainObject = (value) =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const isFiniteInteger = (value) => Number.isFinite(value) && Number.isInteger(value);

const getExtraMaxQuantity = (extraDef) => {
  const rawCap = extraDef?.max_quantity
    ?? extraDef?.max_qty
    ?? extraDef?.maximum_quantity
    ?? extraDef?.maxQuantity;

  if (rawCap === undefined || rawCap === null || rawCap === '') {
    return null;
  }

  const parsedCap = Number(rawCap);
  if (!isFiniteInteger(parsedCap) || parsedCap < 0) {
    return null;
  }

  return parsedCap;
};

const validateBookingUpdateInput = (input) => {
  const fieldErrors = {};

  if (!isPlainObject(input)) {
    return {
      isValid: false,
      fieldErrors: { payload: 'Payload must be a JSON object.' },
      normalized: null
    };
  }

  const unknownKeys = Object.keys(input).filter((key) => !ALLOWED_UPDATE_KEYS.has(key));
  if (unknownKeys.length > 0) {
    fieldErrors.payload = `Unknown fields: ${unknownKeys.join(', ')}`;
  }

  const normalized = {};

  for (const key of CONTACT_KEYS) {
    if (input[key] !== undefined) {
      const normalizedValue = normalizeContactField(input[key]);
      if (normalizedValue !== null && normalizedValue !== undefined && typeof normalizedValue !== 'string') {
        fieldErrors[key] = `${key} must be a string.`;
      } else {
        normalized[key] = normalizedValue;
      }
    }
  }

  if (input.extras !== undefined) {
    if (!isPlainObject(input.extras)) {
      fieldErrors.extras = 'extras must be an object mapping extra IDs to quantities.';
    } else {
      const normalizedExtras = {};
      for (const [extraId, qty] of Object.entries(input.extras)) {
        if (!isFiniteInteger(qty)) {
          fieldErrors[`extras.${extraId}`] = 'Quantity must be a finite integer.';
          continue;
        }

        if (qty < 0) {
          fieldErrors[`extras.${extraId}`] = 'Quantity must be greater than or equal to 0.';
          continue;
        }

        normalizedExtras[extraId] = qty;
      }

      normalized.extras = normalizedExtras;
    }
  }

  return {
    isValid: Object.keys(fieldErrors).length === 0,
    fieldErrors,
    normalized
  };
};

module.exports = {
  ALLOWED_UPDATE_KEYS,
  getExtraMaxQuantity,
  normalizeContactField,
  validateBookingUpdateInput
};
