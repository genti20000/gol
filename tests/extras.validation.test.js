const assert = require('node:assert/strict');
const { EXTRA_INFO_MAX_LENGTH, normalizeExtraInfoText } = require('../lib/extras.js');

const makeString = (length) => 'a'.repeat(length);

const emptyResult = normalizeExtraInfoText('   ');
assert.equal(emptyResult.value, null, 'Empty string should normalize to null.');

const trimmedResult = normalizeExtraInfoText('  hello world  ');
assert.equal(trimmedResult.value, 'hello world', 'Should trim leading/trailing whitespace.');

const nullResult = normalizeExtraInfoText(null);
assert.equal(nullResult.value, null, 'Null should normalize to null.');

const maxResult = normalizeExtraInfoText(makeString(EXTRA_INFO_MAX_LENGTH));
assert.equal(maxResult.value?.length, EXTRA_INFO_MAX_LENGTH, 'Should allow max length.');
assert.equal(maxResult.error, undefined, 'Max length should not error.');

const tooLongResult = normalizeExtraInfoText(makeString(EXTRA_INFO_MAX_LENGTH + 1));
assert.ok(tooLongResult.error, 'Over max length should error.');

console.log('extras.validation.test.js passed');
