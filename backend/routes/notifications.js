const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const Notification = require('../models/Notification');
const { isValidObjectId } = require('../utils/validation');

router.get('/', auth, async (req, res) => {
  try {
    const limit = Math.min(Math.max(Number(req.query.limit) || 30, 1), 100);
    const notifications = await Notification.find({ user: req.user.id })
      .populate('actor', 'name avatar')
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean();
    const unreadCount = await Notification.countDocuments({ user: req.user.id, read: false });
    res.json({ notifications, unreadCount });
  } catch (error) {
    console.error('Notification list error:', error);
    res.status(500).json({ error: 'Unable to load notifications' });
  }
});

router.patch('/:notificationId/read', auth, async (req, res) => {
  try {
    if (!isValidObjectId(req.params.notificationId)) return res.status(400).json({ error: 'Invalid notification ID' });
    const notification = await Notification.findOneAndUpdate(
      { _id: req.params.notificationId, user: req.user.id },
      { $set: { read: true, readAt: new Date() } },
      { new: true }
    ).lean();
    if (!notification) return res.status(404).json({ error: 'Notification not found' });
    res.json(notification);
  } catch (error) {
    console.error('Notification read error:', error);
    res.status(500).json({ error: 'Unable to update notification' });
  }
});

router.post('/read-all', auth, async (req, res) => {
  try {
    await Notification.updateMany(
      { user: req.user.id, read: false },
      { $set: { read: true, readAt: new Date() } }
    );
    res.json({ ok: true });
  } catch (error) {
    console.error('Notification read-all error:', error);
    res.status(500).json({ error: 'Unable to update notifications' });
  }
});

module.exports = router;
