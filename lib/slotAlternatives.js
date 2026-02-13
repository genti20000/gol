const parseTimeToMinutes = (time) => {
  const [h, m] = String(time || '').split(':').map((v) => Number(v));
  if (!Number.isFinite(h) || !Number.isFinite(m)) return null;
  return h * 60 + m;
};

const pickClosestAlternatives = (validTimes, selectedTime, limit = 3) => {
  if (!Array.isArray(validTimes) || validTimes.length === 0) return [];
  const selectedMinutes = parseTimeToMinutes(selectedTime);
  if (selectedMinutes === null) return validTimes.slice(0, limit);

  return [...validTimes]
    .map((time) => {
      const minutes = parseTimeToMinutes(time) ?? selectedMinutes;
      const delta = minutes - selectedMinutes;
      return {
        time,
        delta,
        distance: Math.abs(delta)
      };
    })
    .sort((a, b) => {
      if (a.distance !== b.distance) return a.distance - b.distance;
      if (a.delta >= 0 && b.delta < 0) return -1;
      if (a.delta < 0 && b.delta >= 0) return 1;
      return a.delta - b.delta;
    })
    .slice(0, limit)
    .map((item) => item.time);
};

module.exports = {
  pickClosestAlternatives
};
