const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');

test('single booking admin route blocks live-payment actions on expired/cancelled rows', () => {
  const source = fs.readFileSync('app/api/admin/bookings/[id]/route.ts', 'utf8');
  assert.match(source, /Payment link is only available for live bookings/);
  assert.match(source, /Expired\/cancelled bookings cannot be marked paid/);
});

test('bulk admin route restricts mark paid to live statuses', () => {
  const source = fs.readFileSync('app/api/admin/bookings/bulk/route.ts', 'utf8');
  assert.match(source, /\.in\('status', \['CONFIRMED', 'PENDING'\]\)/);
});

console.log('admin-action-guards.test.js passed');
