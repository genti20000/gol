const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');

const middlewareSource = fs.readFileSync('middleware.ts', 'utf8');
const initSource = fs.readFileSync('app/api/bookings/init/route.ts', 'utf8');
const createDraftSource = fs.readFileSync('app/api/bookings/create-draft/route.ts', 'utf8');
const availabilitySource = fs.readFileSync('app/api/bookings/availability/route.ts', 'utf8');
const finalizeSource = fs.readFileSync('app/api/bookings/finalize/route.ts', 'utf8');
const holdSlotSource = fs.readFileSync('app/api/hold-slot/route.ts', 'utf8');

test('middleware matcher is API-only and does not protect /book routes', () => {
  assert.match(middlewareSource, /matcher:\s*\['\/api\/:path\*'\]/);
  assert.doesNotMatch(middlewareSource, /\/book\//);
});

test('public booking endpoints are not admin-gated', () => {
  assert.doesNotMatch(availabilitySource, /requireAdmin\(/);
  assert.doesNotMatch(finalizeSource, /requireAdmin\(/);
  assert.doesNotMatch(holdSlotSource, /requireAdmin\(/);
});

test('legacy draft endpoints are admin-gated', () => {
  assert.match(initSource, /requireAdmin\(/);
  assert.match(createDraftSource, /requireAdmin\(/);
});

console.log('middleware-public-routes.test.js passed');
