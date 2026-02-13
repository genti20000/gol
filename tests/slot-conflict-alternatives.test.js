const test = require('node:test');
const assert = require('node:assert/strict');

const { pickClosestAlternatives } = require('../lib/slotAlternatives');

test('pickClosestAlternatives returns nearest slots to selected time', () => {
  const options = ['17:00', '17:30', '18:00', '18:30', '19:00', '19:30'];
  const result = pickClosestAlternatives(options, '18:40', 3);
  assert.deepEqual(result, ['18:30', '19:00', '18:00']);
});

test('pickClosestAlternatives falls back safely for invalid selected time', () => {
  const options = ['17:00', '17:30', '18:00'];
  const result = pickClosestAlternatives(options, 'invalid', 2);
  assert.deepEqual(result, ['17:00', '17:30']);
});

test('finalize route includes structured slot conflict payload', () => {
  const fs = require('fs');
  const source = fs.readFileSync('app/api/bookings/finalize/route.ts', 'utf8');
  assert.match(source, /error:\s*'SLOT_TAKEN'/);
  assert.match(source, /alternatives/);
});

console.log('slot-conflict-alternatives.test.js passed');
