const test = require('node:test');
const assert = require('node:assert/strict');
const { participantKeyFor } = require('../routes/conversations');

test('conversation participant key is independent of participant order', () => {
  assert.equal(
    participantKeyFor('507f1f77bcf86cd799439011', '507f1f77bcf86cd799439012'),
    participantKeyFor('507f1f77bcf86cd799439012', '507f1f77bcf86cd799439011')
  );
});
