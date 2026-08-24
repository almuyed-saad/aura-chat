const DEFAULT_AI_API_URL = 'https://api.openai.com/v1/chat/completions';
const DEFAULT_AI_MODEL = 'gpt-5-mini';

const isAiConfigured = () => process.env.AI_ENABLED === 'true' && Boolean(process.env.AI_API_KEY);

const getAiStatus = () => ({
  enabled: isAiConfigured(),
  model: process.env.AI_MODEL || DEFAULT_AI_MODEL
});

const extractContent = (data) => {
  const content = data?.choices?.[0]?.message?.content;
  if (typeof content === 'string') return content.trim();
  if (Array.isArray(content)) return content.map(part => part?.text || '').join('').trim();
  return '';
};

const callAi = async ({ system, user, maxTokens = 500, responseFormat } = {}) => {
  if (!isAiConfigured()) {
    const error = new Error('AI is not configured');
    error.code = 'AI_NOT_CONFIGURED';
    throw error;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20_000);
  const model = process.env.AI_MODEL || DEFAULT_AI_MODEL;
  const tokenLimit = model.startsWith('gpt-5') ? { max_completion_tokens: maxTokens } : { max_tokens: maxTokens };
  try {
    const response = await fetch(process.env.AI_API_URL || DEFAULT_AI_API_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.AI_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model,
        temperature: 0.4,
        ...tokenLimit,
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: user }
        ],
        ...(responseFormat ? { response_format: responseFormat } : {})
      }),
      signal: controller.signal
    });

    if (!response.ok) {
      const error = new Error('AI provider request failed');
      error.code = 'AI_PROVIDER_ERROR';
      throw error;
    }
    const data = await response.json();
    const content = extractContent(data);
    if (!content) {
      const error = new Error('AI provider returned no content');
      error.code = 'AI_EMPTY_RESPONSE';
      throw error;
    }
    return content;
  } finally {
    clearTimeout(timeout);
  }
};

const sanitizeMessages = (messages) => {
  if (!Array.isArray(messages)) return [];
  return messages
    .filter(message => !message?.deleted && typeof message?.text === 'string' && message.text.trim())
    .slice(-40)
    .map(message => ({
      role: message.sender === 'me' || message.role === 'user' ? 'user' : 'assistant',
      content: message.text.trim().slice(0, 1000)
    }));
};

module.exports = { callAi, getAiStatus, isAiConfigured, sanitizeMessages };
