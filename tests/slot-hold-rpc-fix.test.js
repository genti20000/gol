const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

const source = fs.readFileSync('supabase/migrations/202602130008_fix_hold_function_expires_at_ambiguity.sql', 'utf8');

test('hold rpc fix qualifies expires_at in delete statement', () => {
  assert.match(source, /DELETE FROM public\.slot_holds h\s+WHERE h\.expires_at <= now\(\)/i);
});
