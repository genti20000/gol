const MAX_NAME_LENGTH = 120;
const MAX_GUESTS = 100;
const MIN_DURATION_MINUTES = 15;
const MAX_DURATION_MINUTES = 480;
const MAX_PRICE_PENCE = 10000000;
const MAX_SORT_ORDER = 10000;

const isObject = (value) =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const asSafeInt = (value) => {
  if (typeof value !== 'number' || !Number.isInteger(value)) return null;
  if (!Number.isFinite(value)) return null;
  return value;
};

const asBoolean = (value) => (typeof value === 'boolean' ? value : null);

const asTrimmedString = (value) => {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

const validateRange = (label, value, min, max) => {
  if (value < min || value > max) {
    return `${label} must be between ${min} and ${max}.`;
  }
  return null;
};

function parseServiceCreatePayload(payload) {
  if (!isObject(payload)) return { ok: false, error: 'Invalid JSON body.' };

  const name = asTrimmedString(payload.name);
  if (!name) return { ok: false, error: 'name is required.' };
  if (name.length > MAX_NAME_LENGTH) {
    return { ok: false, error: `name must be at most ${MAX_NAME_LENGTH} characters.` };
  }

  const minPeople = asSafeInt(payload.minPeople);
  if (minPeople === null) return { ok: false, error: 'minPeople must be an integer.' };
  const minErr = validateRange('minPeople', minPeople, 1, MAX_GUESTS);
  if (minErr) return { ok: false, error: minErr };

  const maxPeople = asSafeInt(payload.maxPeople);
  if (maxPeople === null) return { ok: false, error: 'maxPeople must be an integer.' };
  const maxErr = validateRange('maxPeople', maxPeople, 1, MAX_GUESTS);
  if (maxErr) return { ok: false, error: maxErr };
  if (maxPeople < minPeople) return { ok: false, error: 'maxPeople must be greater than or equal to minPeople.' };

  const durationMinutes = asSafeInt(payload.durationMinutes);
  if (durationMinutes === null) return { ok: false, error: 'durationMinutes must be an integer.' };
  const durationErr = validateRange('durationMinutes', durationMinutes, MIN_DURATION_MINUTES, MAX_DURATION_MINUTES);
  if (durationErr) return { ok: false, error: durationErr };

  const pricePerPersonPence = asSafeInt(payload.pricePerPersonPence);
  if (pricePerPersonPence === null) return { ok: false, error: 'pricePerPersonPence must be an integer.' };
  const priceErr = validateRange('pricePerPersonPence', pricePerPersonPence, 0, MAX_PRICE_PENCE);
  if (priceErr) return { ok: false, error: priceErr };

  const depositRaw = payload.depositPerPersonPence;
  let depositPerPersonPence = null;
  if (depositRaw !== undefined && depositRaw !== null) {
    const parsedDeposit = asSafeInt(depositRaw);
    if (parsedDeposit === null) return { ok: false, error: 'depositPerPersonPence must be an integer or null.' };
    const depositErr = validateRange('depositPerPersonPence', parsedDeposit, 0, MAX_PRICE_PENCE);
    if (depositErr) return { ok: false, error: depositErr };
    depositPerPersonPence = parsedDeposit;
  }

  const isActive = payload.isActive === undefined ? true : asBoolean(payload.isActive);
  if (isActive === null) return { ok: false, error: 'isActive must be a boolean.' };

  const sortOrderRaw = payload.sortOrder === undefined ? 1 : payload.sortOrder;
  const sortOrder = asSafeInt(sortOrderRaw);
  if (sortOrder === null) return { ok: false, error: 'sortOrder must be an integer.' };
  const sortErr = validateRange('sortOrder', sortOrder, 1, MAX_SORT_ORDER);
  if (sortErr) return { ok: false, error: sortErr };

  return {
    ok: true,
    value: {
      name,
      minPeople,
      maxPeople,
      durationMinutes,
      pricePerPersonPence,
      depositPerPersonPence,
      isActive,
      sortOrder
    }
  };
}

function parseServicePatchPayload(payload) {
  if (!isObject(payload)) return { ok: false, error: 'Invalid JSON body.' };

  const patch = {};

  if (payload.name !== undefined) {
    const name = asTrimmedString(payload.name);
    if (!name) return { ok: false, error: 'name must be a non-empty string.' };
    if (name.length > MAX_NAME_LENGTH) {
      return { ok: false, error: `name must be at most ${MAX_NAME_LENGTH} characters.` };
    }
    patch.name = name;
  }

  let parsedMin;
  let parsedMax;
  if (payload.minPeople !== undefined) {
    const minPeople = asSafeInt(payload.minPeople);
    if (minPeople === null) return { ok: false, error: 'minPeople must be an integer.' };
    const minErr = validateRange('minPeople', minPeople, 1, MAX_GUESTS);
    if (minErr) return { ok: false, error: minErr };
    patch.min_people = minPeople;
    parsedMin = minPeople;
  }
  if (payload.maxPeople !== undefined) {
    const maxPeople = asSafeInt(payload.maxPeople);
    if (maxPeople === null) return { ok: false, error: 'maxPeople must be an integer.' };
    const maxErr = validateRange('maxPeople', maxPeople, 1, MAX_GUESTS);
    if (maxErr) return { ok: false, error: maxErr };
    patch.max_people = maxPeople;
    parsedMax = maxPeople;
  }
  if (parsedMin !== undefined && parsedMax !== undefined && parsedMax < parsedMin) {
    return { ok: false, error: 'maxPeople must be greater than or equal to minPeople.' };
  }

  if (payload.durationMinutes !== undefined) {
    const durationMinutes = asSafeInt(payload.durationMinutes);
    if (durationMinutes === null) return { ok: false, error: 'durationMinutes must be an integer.' };
    const durationErr = validateRange('durationMinutes', durationMinutes, MIN_DURATION_MINUTES, MAX_DURATION_MINUTES);
    if (durationErr) return { ok: false, error: durationErr };
    patch.duration_minutes = durationMinutes;
  }

  if (payload.pricePerPersonPence !== undefined) {
    const pricePerPersonPence = asSafeInt(payload.pricePerPersonPence);
    if (pricePerPersonPence === null) return { ok: false, error: 'pricePerPersonPence must be an integer.' };
    const priceErr = validateRange('pricePerPersonPence', pricePerPersonPence, 0, MAX_PRICE_PENCE);
    if (priceErr) return { ok: false, error: priceErr };
    patch.price_per_person_pence = pricePerPersonPence;
  }

  if (payload.depositPerPersonPence !== undefined) {
    if (payload.depositPerPersonPence === null) {
      patch.deposit_per_person_pence = null;
    } else {
      const depositPerPersonPence = asSafeInt(payload.depositPerPersonPence);
      if (depositPerPersonPence === null) {
        return { ok: false, error: 'depositPerPersonPence must be an integer or null.' };
      }
      const depositErr = validateRange('depositPerPersonPence', depositPerPersonPence, 0, MAX_PRICE_PENCE);
      if (depositErr) return { ok: false, error: depositErr };
      patch.deposit_per_person_pence = depositPerPersonPence;
    }
  }

  if (payload.isActive !== undefined) {
    const isActive = asBoolean(payload.isActive);
    if (isActive === null) return { ok: false, error: 'isActive must be a boolean.' };
    patch.is_active = isActive;
  }

  if (payload.sortOrder !== undefined) {
    const sortOrder = asSafeInt(payload.sortOrder);
    if (sortOrder === null) return { ok: false, error: 'sortOrder must be an integer.' };
    const sortErr = validateRange('sortOrder', sortOrder, 1, MAX_SORT_ORDER);
    if (sortErr) return { ok: false, error: sortErr };
    patch.sort_order = sortOrder;
  }

  if (Object.keys(patch).length === 0) {
    return { ok: false, error: 'No valid fields provided for update.' };
  }

  return { ok: true, value: patch };
}

module.exports = {
  parseServiceCreatePayload,
  parseServicePatchPayload
};
