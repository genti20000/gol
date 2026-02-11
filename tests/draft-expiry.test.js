const test = require('node:test');
const assert = require('node:assert/strict');

const { isDraftExpired } = require('../lib/draftExpiry');

test('draft with past expires_at is treated as expired', () => {
  const booking = {
    status: 'DRAFT',
    expires_at: new Date(Date.now() - 60_000).toISOString()
  };
  assert.equal(isDraftExpired(booking), true);
});

test('draft with future expires_at is not expired', () => {
  const booking = {
    status: 'DRAFT',
    expires_at: new Date(Date.now() + 60_000).toISOString()
  };
  assert.equal(isDraftExpired(booking), false);
});

test('non-draft is never treated as draft-expired', () => {
  const booking = {
    status: 'CONFIRMED',
    expires_at: new Date(Date.now() - 60_000).toISOString()
  };
  assert.equal(isDraftExpired(booking), false);
});
