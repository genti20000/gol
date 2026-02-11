const MUTATING_METHODS = new Set(['POST', 'PATCH', 'PUT', 'DELETE']);

const PUBLIC_BOOKING_MUTATION_RULE = { windowMs: 60_000, limit: 25 };
const PUBLIC_BOOKING_READ_RULE = { windowMs: 60_000, limit: 120 };
const ADMIN_MUTATION_RULE = { windowMs: 60_000, limit: 60 };
const DEFAULT_RULE = { windowMs: 60_000, limit: 180 };

const getGlobalStore = () => {
  if (!globalThis.__GOL_RATE_LIMIT_BUCKETS__) {
    globalThis.__GOL_RATE_LIMIT_BUCKETS__ = new Map();
  }
  return globalThis.__GOL_RATE_LIMIT_BUCKETS__;
};

function createMemoryStore() {
  const buckets = getGlobalStore();

  return {
    async hit(key, windowMs, now = Date.now()) {
      const existing = buckets.get(key);

      if (!existing || existing.resetAt <= now) {
        const resetAt = now + windowMs;
        buckets.set(key, { count: 1, resetAt });
        return { count: 1, resetAt };
      }

      existing.count += 1;
      buckets.set(key, existing);
      return { count: existing.count, resetAt: existing.resetAt };
    },
    prune(now = Date.now()) {
      if (buckets.size < 2000) return;
      for (const [key, bucket] of buckets.entries()) {
        if (bucket.resetAt <= now) {
          buckets.delete(key);
        }
      }
    }
  };
}

function createUpstashStore(env = process.env, fetchImpl = fetch) {
  const baseUrl = env.UPSTASH_REDIS_REST_URL;
  const token = env.UPSTASH_REDIS_REST_TOKEN;

  if (!baseUrl || !token) return null;

  const url = `${baseUrl.replace(/\/$/, '')}/pipeline`;

  return {
    async hit(key, windowMs, now = Date.now()) {
      const response = await fetchImpl(url, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify([
          ['INCR', key],
          ['PEXPIRE', key, String(windowMs)],
          ['PTTL', key]
        ])
      });

      if (!response.ok) {
        throw new Error(`Upstash rate limit request failed (${response.status}).`);
      }

      const payload = await response.json();
      const count = Number(payload?.[0]?.result ?? 0);
      const ttlMsRaw = Number(payload?.[2]?.result ?? windowMs);
      const ttlMs = Number.isFinite(ttlMsRaw) && ttlMsRaw > 0 ? ttlMsRaw : windowMs;
      return { count, resetAt: now + ttlMs };
    }
  };
}

function getRule(path, method) {
  const isMutating = MUTATING_METHODS.has(method.toUpperCase());

  if (path.startsWith('/api/admin/')) {
    return isMutating ? ADMIN_MUTATION_RULE : DEFAULT_RULE;
  }

  if (path.startsWith('/api/bookings/')) {
    return isMutating ? PUBLIC_BOOKING_MUTATION_RULE : PUBLIC_BOOKING_READ_RULE;
  }

  return DEFAULT_RULE;
}

function getPathGroup(path) {
  if (path.startsWith('/api/admin/')) return '/api/admin/*';
  if (path.startsWith('/api/bookings/')) return '/api/bookings/*';
  return '/api/*';
}

function createRateLimitKey(ip, method, path) {
  return `${ip}:${method.toUpperCase()}:${getPathGroup(path)}`;
}

function createRateLimiter({ primaryStore, fallbackStore }) {
  return {
    async check({ key, limit, windowMs, now = Date.now() }) {
      if (fallbackStore?.prune) fallbackStore.prune(now);

      let result;
      try {
        result = await primaryStore.hit(key, windowMs, now);
      } catch {
        result = await fallbackStore.hit(key, windowMs, now);
      }

      const allowed = result.count <= limit;
      const retryAfterSeconds = Math.max(1, Math.ceil((result.resetAt - now) / 1000));
      return { allowed, retryAfterSeconds, count: result.count };
    }
  };
}

module.exports = {
  createMemoryStore,
  createRateLimitKey,
  createRateLimiter,
  createUpstashStore,
  getRule
};
