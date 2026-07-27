const express = require('express');
const router = express.Router();
const authenticate = require('../middleware/auth');
const PushSubscription = require('../models/PushSubscription');

// ===== SAVE / UPDATE SUBSCRIPTION =====
// Called by the frontend right after the browser grants notification
// permission and pushManager.subscribe() resolves.
router.post('/subscribe', authenticate, async (req, res) => {
  try {
    const { endpoint, keys } = req.body;
    if (!endpoint || !keys?.p256dh || !keys?.auth) {
      return res.status(400).json({ error: 'Invalid subscription payload' });
    }

    await PushSubscription.findOneAndUpdate(
      { endpoint },
      { user: req.user.id, endpoint, keys },
      { upsert: true, new: true }
    );

    res.status(201).json({ message: 'Subscribed' });
  } catch (error) {
    console.error('❌ Push subscribe error:', error);
    res.status(500).json({ error: 'Failed to save subscription' });
  }
});

// ===== REMOVE SUBSCRIPTION (e.g. on logout) =====
router.post('/unsubscribe', authenticate, async (req, res) => {
  try {
    const { endpoint } = req.body;
    if (!endpoint) return res.status(400).json({ error: 'Endpoint required' });

    await PushSubscription.deleteOne({ endpoint, user: req.user.id });
    res.json({ message: 'Unsubscribed' });
  } catch (error) {
    console.error('❌ Push unsubscribe error:', error);
    res.status(500).json({ error: 'Failed to remove subscription' });
  }
});

module.exports = router;