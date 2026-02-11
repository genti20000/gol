const assert = require('node:assert/strict');
const { shouldShowExtraInfoIcon } = require('../lib/extras.js');

assert.equal(shouldShowExtraInfoIcon(undefined), false, 'Undefined info should hide icon.');
assert.equal(shouldShowExtraInfoIcon(null), false, 'Null info should hide icon.');
assert.equal(shouldShowExtraInfoIcon('   '), false, 'Whitespace info should hide icon.');
assert.equal(shouldShowExtraInfoIcon('Details here'), true, 'Non-empty info should show icon.');

console.log('extras-ui.test.js passed');
