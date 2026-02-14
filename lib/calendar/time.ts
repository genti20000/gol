export type Room = "TERRACE" | "VOX" | "ATTIC";

export const OPEN_MIN = 17 * 60; // 17:00
export const CLOSE_MIN = 25 * 60; // 01:00 next day
export const SLOT_MIN = 30;

export const ROOMS: Room[] = ["TERRACE", "VOX", "ATTIC"];

export function minutesToLabel(min: number) {
  const m = ((min % (24 * 60)) + 24 * 60) % (24 * 60);
  const hh = Math.floor(m / 60);
  const mm = m % 60;
  return `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
}

export function clampToGrid(min: number) {
  const clamped = Math.max(OPEN_MIN, Math.min(CLOSE_MIN - SLOT_MIN, min));
  const snapped = Math.round((clamped - OPEN_MIN) / SLOT_MIN) * SLOT_MIN + OPEN_MIN;
  return snapped;
}

export function buildSlots() {
  const slots: number[] = [];
  for (let t = OPEN_MIN; t <= CLOSE_MIN - SLOT_MIN; t += SLOT_MIN) slots.push(t);
  return slots;
}
