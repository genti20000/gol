import { Service } from '@/types';

export const formatPounds = (value: number) => Number(value || 0).toFixed(2);

export const poundsToPence = (value: number) => Math.max(0, Math.round((Number(value) || 0) * 100));

export const penceToPounds = (value: number) => Number(((Number(value) || 0) / 100).toFixed(2));

export const parsePeopleRangeFromName = (name: string): { minPeople: number; maxPeople: number } | null => {
  const text = `${name || ''}`.trim();
  if (!text) return null;

  const rangeMatch = text.match(/(\d+)\s*[-–to]+\s*(\d+)/i);
  if (rangeMatch) {
    const min = Number(rangeMatch[1]);
    const max = Number(rangeMatch[2]);
    if (Number.isInteger(min) && Number.isInteger(max) && min > 0 && max >= min) {
      return { minPeople: min, maxPeople: max };
    }
  }

  const singleMatch = text.match(/(\d+)/);
  if (singleMatch) {
    const value = Number(singleMatch[1]);
    if (Number.isInteger(value) && value > 0) {
      return { minPeople: value, maxPeople: value };
    }
  }

  return null;
};

export const getServicePartySize = (service?: Pick<Service, 'minPeople' | 'maxPeople'> | null, preferredGuests?: number) => {
  if (!service) return Math.max(1, Math.floor(preferredGuests || 8));
  const min = Math.max(1, Math.floor(service.minPeople || 1));
  const max = Math.max(min, Math.floor(service.maxPeople || min));
  if (typeof preferredGuests === 'number' && Number.isFinite(preferredGuests)) {
    return Math.min(max, Math.max(min, Math.floor(preferredGuests)));
  }
  return min;
};

export const getServiceBaseTotal = (
  service: Pick<Service, 'pricePerPersonPence' | 'minPeople' | 'maxPeople'> | null | undefined,
  guests: number
) => {
  if (!service) return 0;
  const partySize = getServicePartySize(service, guests);
  const totalPence = partySize * Math.max(0, Math.floor(service.pricePerPersonPence || 0));
  return penceToPounds(totalPence);
};

export const getServicePreviewTotal = (service: Pick<Service, 'minPeople' | 'maxPeople' | 'pricePerPersonPence'>) => {
  const min = Math.max(1, Math.floor(service.minPeople || 1));
  const max = Math.max(min, Math.floor(service.maxPeople || min));
  const pp = Math.max(0, Math.floor(service.pricePerPersonPence || 0));
  const minTotal = penceToPounds(min * pp);
  const maxTotal = penceToPounds(max * pp);
  if (min === max) return `£${formatPounds(minTotal)}`;
  return `£${formatPounds(minTotal)}–£${formatPounds(maxTotal)}`;
};
