const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');

test('availability route is dynamic and no-store', () => {
  const source = fs.readFileSync('app/api/bookings/availability/route.ts', 'utf8');
  assert.match(source, /export const dynamic = 'force-dynamic'/);
  assert.match(source, /Cache-Control': 'no-store/);
});

console.log('availability-route-caching.test.js passed');
