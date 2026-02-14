export const GRID_START_HOUR = 17;
export const GRID_END_HOUR = 25; // 01:00 next day
export const GRID_INTERVAL_MINUTES = 30;

export const ROOMS = [
  { id: 'terrace', name: 'TERRACE' },
  { id: 'vox', name: 'VOX' },
  { id: 'attic', name: 'ATTIC' }
] as const;

export type RoomId = (typeof ROOMS)[number]['id'];

const pad = (value: number) => String(value).padStart(2, '0');

export const toMinutesFromMidnight = (time: string) => {
  const match = String(time).match(/^(\d{1,2}):(\d{2})/);
  if (!match) return NaN;
  let hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return NaN;
  if (hours < GRID_START_HOUR) hours += 24;
  return hours * 60 + minutes;
};

export const toOffsetMinutes = (time: string) => {
  const absolute = toMinutesFromMidnight(time);
  if (!Number.isFinite(absolute)) return NaN;
  return absolute - GRID_START_HOUR * 60;
};

export const offsetToTimeLabel = (offsetMinutes: number) => {
  const absolute = GRID_START_HOUR * 60 + offsetMinutes;
  const hours = Math.floor(absolute / 60) % 24;
  const minutes = absolute % 60;
  return `${pad(hours)}:${pad(minutes)}`;
};

export const getGridOffsets = () => {
  const offsets: number[] = [];
  const maxMinutes = (GRID_END_HOUR - GRID_START_HOUR) * 60;
  for (let offset = 0; offset <= maxMinutes; offset += GRID_INTERVAL_MINUTES) {
    offsets.push(offset);
  }
  return offsets;
};

export const addMinutesToIso = (baseIso: string, minutes: number) => {
  const date = new Date(baseIso);
  if (!Number.isFinite(date.getTime())) return '';
  return new Date(date.getTime() + minutes * 60_000).toISOString();
};

export const dateAndOffsetToIso = (date: string, offsetMinutes: number) => {
  const [year, month, day] = String(date).split('-').map((part) => Number(part));
  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) return '';
  const minutes = GRID_START_HOUR * 60 + offsetMinutes;
  const extraDays = Math.floor(minutes / (24 * 60));
  const normalizedMinutes = minutes % (24 * 60);
  const hours = Math.floor(normalizedMinutes / 60);
  const mins = normalizedMinutes % 60;
  return new Date(year, month - 1, day + extraDays, hours, mins, 0).toISOString();
};

