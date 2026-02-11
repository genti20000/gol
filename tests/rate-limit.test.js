const assert = require('node:assert/strict');
const {
  createMemoryStore,
  createRateLimitKey,
  createRateLimiter,
  getRule
} = require('../lib/rateLimit.js');

async function run() {
  const memoryStore = createMemoryStore();
  const limiter = createRateLimiter({
    primaryStore: memoryStore,
    fallbackStore: memoryStore
  });

  const key = createRateLimitKey('1.2.3.4', 'POST', '/api/bookings/create-draft');
  const rule = getRule('/api/bookings/create-draft', 'POST');

  for (let i = 0; i < rule.limit; i += 1) {
    const decision = await limiter.check({
      key,
      limit: rule.limit,
      windowMs: rule.windowMs,
      now: 1000
    });
    assert.equal(decision.allowed, true, `Request ${i + 1} should be allowed.`);
  }

  const blocked = await limiter.check({
    key,
    limit: rule.limit,
    windowMs: rule.windowMs,
    now: 1000
  });
  assert.equal(blocked.allowed, false, 'Next request should be rate limited.');
  assert.ok(blocked.retryAfterSeconds >= 1, 'retry-after should be positive.');

  const afterWindow = await limiter.check({
    key,
    limit: rule.limit,
    windowMs: rule.windowMs,
    now: 1000 + rule.windowMs + 1
  });
  assert.equal(afterWindow.allowed, true, 'Limit should reset after window.');

  console.log('rate-limit.test.js passed');
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
