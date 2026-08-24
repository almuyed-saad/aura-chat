const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const rateLimit = require('../middleware/rateLimit');
const User = require('../models/User');
const { callAi, getAiStatus, parseSmartReplies, sanitizeMessages } = require('../services/aiService');

const aiLimiter = rateLimit({ windowMs: 60 * 1000, max: 20, message: 'AI request limit reached. Please try again shortly.' });
const textValue = (value, max = 4000) => typeof value === 'string' ? value.trim().slice(0, max) : '';
const requireAiConsent = async (req, res, next) => {
  if (!getAiStatus().enabled) return res.status(503).json({ error: 'AI features are not configured' });
  const user = await User.findById(req.user.id).select('aiEnabled');
  if (!user?.aiEnabled) return res.status(403).json({ error: 'Enable AI assistance to use this feature' });
  next();
};

const providerError = (error, res) => {
  if (error.code === 'AI_NOT_CONFIGURED') return res.status(503).json({ error: 'AI features are not configured' });
  if (error.name === 'AbortError') return res.status(504).json({ error: 'AI request timed out' });
  return res.status(502).json({ error: 'AI service is temporarily unavailable' });
};

router.get('/status', auth, async (req, res) => {
  const user = await User.findById(req.user.id).select('aiEnabled').lean();
  res.json({ ...getAiStatus(), consent: Boolean(user?.aiEnabled) });
});

router.patch('/preferences', auth, async (req, res) => {
  if (typeof req.body?.enabled !== 'boolean') return res.status(400).json({ error: 'AI preference must be boolean' });
  const user = await User.findByIdAndUpdate(req.user.id, {
    aiEnabled: req.body.enabled,
    aiConsentAt: req.body.enabled ? new Date() : null
  }, { new: true }).select('aiEnabled aiConsentAt').lean();
  res.json(user);
});

router.post('/smart-replies', auth, requireAiConsent, aiLimiter, async (req, res) => {
  const messages = sanitizeMessages(req.body?.messages, req.user.id);
  if (!messages.length) return res.status(400).json({ error: 'Conversation context is required' });
  try {
    const content = await callAi({
      system: 'You suggest concise, natural replies for a chat app. Return JSON only as {"replies":["..."]}. Provide exactly three replies, each no more than 80 characters. Do not include sensitive inferences or claims not present in the conversation.',
      user: JSON.stringify(messages),
      maxTokens: 300
    });
    const replies = parseSmartReplies(content)
      .filter(item => typeof item === 'string' && item.trim())
      .slice(0, 3)
      .map(item => item.trim().slice(0, 120));
    res.json({ replies });
  } catch (error) {
    console.error('AI smart-replies error:', error.code || error.message);
    providerError(error, res);
  }
});

router.post('/summarize', auth, requireAiConsent, aiLimiter, async (req, res) => {
  const messages = sanitizeMessages(req.body?.messages, req.user.id);
  if (!messages.length) return res.status(400).json({ error: 'Conversation context is required' });
  try {
    const summary = await callAi({
      system: 'Summarize this conversation in two concise sentences. State only what is explicitly discussed. Do not identify or infer sensitive personal information.',
      user: JSON.stringify(messages),
      maxTokens: 180
    });
    res.json({ summary: summary.slice(0, 600) });
  } catch (error) {
    console.error('AI summary error:', error.code || error.message);
    providerError(error, res);
  }
});

router.post('/rewrite', auth, requireAiConsent, aiLimiter, async (req, res) => {
  const text = textValue(req.body?.text, 1200);
  const tone = textValue(req.body?.tone, 40).toLowerCase();
  if (!text || !['professional', 'friendly', 'concise', 'empathetic'].includes(tone)) return res.status(400).json({ error: 'Text and a supported tone are required' });
  try {
    const rewritten = await callAi({
      system: `Rewrite the provided message in a ${tone} tone. Preserve the meaning, facts, and language. Return only the rewritten message.`,
      user: text,
      maxTokens: 300
    });
    res.json({ text: rewritten.slice(0, 1200) });
  } catch (error) {
    console.error('AI rewrite error:', error.code || error.message);
    providerError(error, res);
  }
});

router.post('/translate', auth, requireAiConsent, aiLimiter, async (req, res) => {
  const text = textValue(req.body?.text, 1200);
  const targetLanguage = textValue(req.body?.targetLanguage, 40);
  if (!text || !targetLanguage) return res.status(400).json({ error: 'Text and target language are required' });
  try {
    const translated = await callAi({
      system: `Translate the provided message into ${targetLanguage}. Preserve meaning and tone. Return only the translation.`,
      user: text,
      maxTokens: 500
    });
    res.json({ text: translated.slice(0, 1600), targetLanguage });
  } catch (error) {
    console.error('AI translation error:', error.code || error.message);
    providerError(error, res);
  }
});

module.exports = router;
