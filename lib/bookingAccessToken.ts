import { createHash, timingSafeEqual } from 'crypto';

type TokenPayload = {
  bookingToken?: string;
  token?: string;
};

const ACCESS_TOKEN_HEADER = 'x-booking-token';

const normalizeToken = (token: string | null | undefined): string => {
  if (!token) return '';
  return token.trim();
};

const parseBodyToken = async (request: Request): Promise<string> => {
  const contentType = request.headers.get('content-type') || '';
  if (!contentType.toLowerCase().includes('application/json')) {
    return '';
  }

  const payload = (await request.json().catch(() => null)) as TokenPayload | null;
  return normalizeToken(payload?.bookingToken || payload?.token);
};

export const extractBookingToken = async (request: Request): Promise<string> => {
  const fromHeader = normalizeToken(request.headers.get(ACCESS_TOKEN_HEADER));
  if (fromHeader) {
    return fromHeader;
  }

  const url = new URL(request.url);
  const fromQuery = normalizeToken(url.searchParams.get('bookingToken') || url.searchParams.get('token'));
  if (fromQuery) {
    return fromQuery;
  }

  return parseBodyToken(request);
};

export const isBookingTokenValid = (providedToken: string, storedToken: string | null | undefined): boolean => {
  if (!providedToken || !storedToken) {
    return false;
  }

  const providedHash = createHash('sha256').update(providedToken).digest();
  const storedHash = createHash('sha256').update(storedToken).digest();

  if (providedHash.length !== storedHash.length) {
    return false;
  }

  return timingSafeEqual(providedHash, storedHash);
};
