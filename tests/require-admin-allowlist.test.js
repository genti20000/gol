const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');

test('requireAdmin allowlist accepts all supported env variable names', () => {
  const source = fs.readFileSync('lib/requireAdmin.ts', 'utf8');
  assert.match(source, /ADMIN_EMAIL_ALLOWLIST/);
  assert.match(source, /ADMIN_EMAILS/);
  assert.match(source, /NEXT_PUBLIC_ADMIN_EMAILS/);
});

console.log('require-admin-allowlist.test.js passed');
