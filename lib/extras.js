const EXTRA_INFO_MAX_LENGTH = 500;

const normalizeExtraInfoText = (value) => {
  if (value === undefined || value === null) {
    return { value: null };
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return { value: null };
  }

  if (trimmed.length > EXTRA_INFO_MAX_LENGTH) {
    return { value: trimmed, error: `Info text must be ${EXTRA_INFO_MAX_LENGTH} characters or fewer.` };
  }

  return { value: trimmed };
};

const shouldShowExtraInfoIcon = (value) => {
  if (value === undefined || value === null) {
    return false;
  }
  return value.trim().length > 0;
};

module.exports = {
  EXTRA_INFO_MAX_LENGTH,
  normalizeExtraInfoText,
  shouldShowExtraInfoIcon
};
