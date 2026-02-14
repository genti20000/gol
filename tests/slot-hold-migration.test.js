const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

const source = fs.readFileSync('supabase/migrations/202602130007_slot_hold_upsert_refresh.sql', 'utf8');

test('slot hold migration enforces session+slot uniqueness', () => {
  assert.match(source, /CREATE UNIQUE INDEX IF NOT EXISTS slot_holds_session_slot_unique/i);
  assert.match(source, /ON public\.slot_holds\s*\(service_id,\s*date,\s*start_time,\s*session_id\)/i);
});

test('slot hold migration keeps cross-session conflict protection', () => {
  assert.match(source, /h\.session_id\s*<>\s*p_session_id/i);
});

test('slot hold migration refreshes same-session hold via upsert', () => {
  assert.match(source, /ON CONFLICT\s*\(service_id,\s*date,\s*start_time,\s*session_id\)/i);
  assert.match(source, /DO UPDATE SET\s+[\s\S]*expires_at\s*=\s*EXCLUDED\.expires_at/i);
});
