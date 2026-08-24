const test = require('node:test');
const assert = require('node:assert/strict');
const {
  beforeFilter,
  decodeCursor,
  encodeCursor,
  pageResult,
  parsePagination
} = require('../utils/pagination');

const firstId = '507f1f77bcf86cd799439011';
const secondId = '507f1f77bcf86cd799439012';
const thirdId = '507f1f77bcf86cd799439013';

test('pagination cursor round-trips a message timestamp and ID', () => {
  const message = { _id: firstId, createdAt: '2026-08-24T10:00:00.000Z' };
  const cursor = encodeCursor(message);
  assert.deepEqual(decodeCursor(cursor), {
    createdAt: new Date(message.createdAt),
    id: firstId
  });
});

test('pagination rejects malformed cursors and bounds page size', () => {
  assert.equal(parsePagination({ before: 'not-a-cursor' }).error, 'Invalid pagination cursor');
  assert.equal(parsePagination({ limit: '1000' }).limit, 100);
  assert.equal(parsePagination({ limit: '-5' }).limit, 1);
  assert.equal(parsePagination({}).enabled, false);
});

test('page result reverses newest-first database results and returns the oldest page cursor', () => {
  const messages = [
    { _id: thirdId, createdAt: '2026-08-24T10:02:00.000Z' },
    { _id: secondId, createdAt: '2026-08-24T10:01:00.000Z' },
    { _id: firstId, createdAt: '2026-08-24T10:00:00.000Z' }
  ];
  const result = pageResult(messages, 2);
  assert.deepEqual(result.items.map(message => message._id), [secondId, thirdId]);
  assert.equal(result.pagination.hasMore, true);
  assert.deepEqual(decodeCursor(result.pagination.nextCursor), {
    createdAt: new Date('2026-08-24T10:01:00.000Z'),
    id: secondId
  });
});

test('before filter uses timestamp and ID tie-breaker', () => {
  const cursor = decodeCursor(encodeCursor({ _id: secondId, createdAt: '2026-08-24T10:01:00.000Z' }));
  assert.deepEqual(beforeFilter(cursor), {
    $or: [
      { createdAt: { $lt: new Date('2026-08-24T10:01:00.000Z') } },
      { createdAt: new Date('2026-08-24T10:01:00.000Z'), _id: { $lt: secondId } }
    ]
  });
});
