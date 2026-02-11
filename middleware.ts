import { NextRequest, NextResponse } from 'next/server';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { createMemoryStore, createRateLimitKey, createRateLimiter, createUpstashStore, getRule } = require('@/lib/rateLimit');

const getClientIp = (request: NextRequest): string => {
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) {
    return forwarded.split(',')[0]?.trim() || 'unknown';
  }
  return request.ip ?? 'unknown';
};

const memoryStore = createMemoryStore();
const upstashStore = createUpstashStore();
const limiter = createRateLimiter({
  primaryStore: upstashStore ?? memoryStore,
  fallbackStore: memoryStore
});

export async function middleware(request: NextRequest) {
  if (!request.nextUrl.pathname.startsWith('/api/')) {
    return NextResponse.next();
  }

  const now = Date.now();
  const ip = getClientIp(request);
  const rule = getRule(request.nextUrl.pathname, request.method);
  const key = createRateLimitKey(ip, request.method, request.nextUrl.pathname);

  const decision = await limiter.check({
    key,
    limit: rule.limit,
    windowMs: rule.windowMs,
    now
  });

  if (!decision.allowed) {
    return NextResponse.json(
      { error: 'Too many requests. Please retry shortly.' },
      {
        status: 429,
        headers: {
          'Retry-After': String(decision.retryAfterSeconds)
        }
      }
    );
  }
  return NextResponse.next();
}

export const config = {
  matcher: ['/api/:path*']
};
