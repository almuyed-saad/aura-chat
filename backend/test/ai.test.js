const test = require('node:test');
const assert = require('node:assert/strict');
const {
  getAiStatus,
  isAiConfigured,
  parseSmartReplies,
  sanitizeMessages,
  callAi
} = require('../services/aiService');

const restoreEnv = (key, value) => {
  if (value === undefined) delete process.env[key];
  else process.env[key] = value;
};

test('AI is disabled unless explicitly configured', () => {
  const previousEnabled = process.env.AI_ENABLED;
  const previousKey = process.env.AI_API_KEY;
  delete process.env.AI_ENABLED;
  delete process.env.AI_API_KEY;
  try {
    assert.equal(isAiConfigured(), false);
    assert.equal(getAiStatus().enabled, false);
  } finally {
    restoreEnv('AI_ENABLED', previousEnabled);
    restoreEnv('AI_API_KEY', previousKey);
  }
});

test('sanitizes AI context to recent text only and labels current-user messages correctly', () => {
  const result = sanitizeMessages([
    { sender: 'current-user-id', text: '  My message  ' },
    { sender: 'other-user-id', text: 'Their message', attachment: { url: 'https://private.example/file' } },
    { sender: 'other-user-id', text: 'Deleted', deleted: true },
    { sender: 'other-user-id', text: 'x'.repeat(2000) }
  ], 'current-user-id');
  assert.equal(result.length, 3);
  assert.deepEqual(result[0], { role: 'user', content: 'My message' });
  assert.deepEqual(result[1], { role: 'assistant', content: 'Their message' });
  assert.equal(result[2].content.length, 1000);
  assert.equal(Object.hasOwn(result[0], 'attachment'), false);
});

test('parses JSON, fenced JSON, arrays, and plain-text smart replies', () => {
  assert.deepEqual(parseSmartReplies('{"replies":["One","Two"]}'), ['One', 'Two']);
  assert.deepEqual(parseSmartReplies('```json\n{"replies":["One"]}\n```'), ['One']);
  assert.deepEqual(parseSmartReplies('["One","Two"]'), ['One', 'Two']);
  assert.deepEqual(parseSmartReplies('- One\n2. Two'), ['One', 'Two']);
});

test('callAi uses model-compatible token parameters and extracts content parts', async () => {
  const previous = {
    enabled: process.env.AI_ENABLED,
    key: process.env.AI_API_KEY,
    model: process.env.AI_MODEL,
    url: process.env.AI_API_URL,
    fetch: global.fetch
  };
  let captured;
  process.env.AI_ENABLED = 'true';
  process.env.AI_API_KEY = 'test-key';
  process.env.AI_MODEL = 'gpt-5-mini';
  global.fetch = async (url, options) => {
    captured = { url, body: JSON.parse(options.body) };
    return {
      ok: true,
      json: async () => ({ choices: [{ message: { content: [{ type: 'output_text', text: ' provider result ' }] } }] })
    };
  };
  try {
    const output = await callAi({ system: 'system', user: 'user', maxTokens: 12 });
    assert.equal(output, 'provider result');
    assert.equal(captured.body.max_completion_tokens, 12);
    assert.equal(captured.body.max_tokens, undefined);
    assert.equal(captured.body.temperature, undefined);
  } finally {
    restoreEnv('AI_ENABLED', previous.enabled);
    restoreEnv('AI_API_KEY', previous.key);
    restoreEnv('AI_MODEL', previous.model);
    restoreEnv('AI_API_URL', previous.url);
    global.fetch = previous.fetch;
  }
});

test('callAi uses max_tokens for non-GPT-5 compatible models', async () => {
  const previous = {
    enabled: process.env.AI_ENABLED,
    key: process.env.AI_API_KEY,
    model: process.env.AI_MODEL,
    fetch: global.fetch
  };
  let requestBody;
  process.env.AI_ENABLED = 'true';
  process.env.AI_API_KEY = 'test-key';
  process.env.AI_MODEL = 'claude-haiku-4-5';
  global.fetch = async (_url, options) => {
    requestBody = JSON.parse(options.body);
    return { ok: true, json: async () => ({ choices: [{ message: { content: 'ok' } }] }) };
  };
  try {
    await callAi({ system: 'system', user: 'user', maxTokens: 22 });
    assert.equal(requestBody.max_tokens, 22);
    assert.equal(requestBody.max_completion_tokens, undefined);
  } finally {
    restoreEnv('AI_ENABLED', previous.enabled);
    restoreEnv('AI_API_KEY', previous.key);
    restoreEnv('AI_MODEL', previous.model);
    global.fetch = previous.fetch;
  }
});

test('callAi fails closed when provider is not configured', async () => {
  const previousEnabled = process.env.AI_ENABLED;
  const previousKey = process.env.AI_API_KEY;
  delete process.env.AI_ENABLED;
  delete process.env.AI_API_KEY;
  try {
    await assert.rejects(callAi({ system: 'test', user: 'test' }), error => error.code === 'AI_NOT_CONFIGURED');
  } finally {
    restoreEnv('AI_ENABLED', previousEnabled);
    restoreEnv('AI_API_KEY', previousKey);
  }
});
