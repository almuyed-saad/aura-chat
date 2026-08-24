const test = require('node:test');
const assert = require('node:assert/strict');
const { getAiStatus, isAiConfigured, sanitizeMessages, callAi } = require('../services/aiService');

test('AI is disabled unless explicitly configured', () => {
  const previousEnabled = process.env.AI_ENABLED;
  const previousKey = process.env.AI_API_KEY;
  delete process.env.AI_ENABLED;
  delete process.env.AI_API_KEY;
  assert.equal(isAiConfigured(), false);
  assert.equal(getAiStatus().enabled, false);
  process.env.AI_ENABLED = previousEnabled || 'false';
  if (previousKey) process.env.AI_API_KEY = previousKey;
});

test('sanitizes AI context to recent text only', () => {
  const result = sanitizeMessages([
    { sender: 'me', text: '  Hello  ' },
    { sender: 'other', text: 'Attachment', attachment: { url: 'https://private.example/file' } },
    { sender: 'other', text: 'Deleted', deleted: true },
    { sender: 'other', text: 'x'.repeat(2000) }
  ]);
  assert.equal(result.length, 3);
  assert.equal(result[0].content, 'Hello');
  assert.equal(result[1].content, 'Attachment');
  assert.equal(result[2].content.length, 1000);
  assert.equal(Object.hasOwn(result[0], 'attachment'), false);
});

test('callAi fails closed when provider is not configured', async () => {
  const previousEnabled = process.env.AI_ENABLED;
  const previousKey = process.env.AI_API_KEY;
  delete process.env.AI_ENABLED;
  delete process.env.AI_API_KEY;
  await assert.rejects(callAi({ system: 'test', user: 'test' }), error => error.code === 'AI_NOT_CONFIGURED');
  process.env.AI_ENABLED = previousEnabled || 'false';
  if (previousKey) process.env.AI_API_KEY = previousKey;
});
