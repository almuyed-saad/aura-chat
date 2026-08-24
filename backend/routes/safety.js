const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const User = require('../models/User');
const Message = require('../models/Message');
const Report = require('../models/Report');
const { isValidObjectId } = require('../utils/validation');

router.get('/blocks', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).populate('blockedUsers', 'name avatar email').select('blockedUsers').lean();
    res.json(user?.blockedUsers || []);
  } catch (error) {
    console.error('Blocked users error:', error);
    res.status(500).json({ error: 'Unable to load blocked users' });
  }
});

router.post('/blocks/:userId', auth, async (req, res) => {
  try {
    const { userId } = req.params;
    if (!isValidObjectId(userId) || String(userId) === String(req.user.id)) return res.status(400).json({ error: 'Invalid user ID' });
    if (!await User.exists({ _id: userId })) return res.status(404).json({ error: 'User not found' });
    await User.findByIdAndUpdate(req.user.id, { $addToSet: { blockedUsers: userId } });
    res.json({ blocked: true, userId });
  } catch (error) {
    console.error('Block user error:', error);
    res.status(500).json({ error: 'Unable to block user' });
  }
});

router.delete('/blocks/:userId', auth, async (req, res) => {
  try {
    if (!isValidObjectId(req.params.userId)) return res.status(400).json({ error: 'Invalid user ID' });
    await User.findByIdAndUpdate(req.user.id, { $pull: { blockedUsers: req.params.userId } });
    res.json({ blocked: false, userId: req.params.userId });
  } catch (error) {
    console.error('Unblock user error:', error);
    res.status(500).json({ error: 'Unable to unblock user' });
  }
});

router.post('/reports', auth, async (req, res) => {
  try {
    const { targetUserId, messageId, reason, details } = req.body || {};
    const allowedReasons = new Set(['spam', 'harassment', 'abuse', 'illegal', 'other']);
    if (!allowedReasons.has(reason)) return res.status(400).json({ error: 'Invalid report reason' });
    if (!isValidObjectId(targetUserId) && !isValidObjectId(messageId)) return res.status(400).json({ error: 'A user or message is required' });
    if (isValidObjectId(targetUserId) && String(targetUserId) === String(req.user.id)) return res.status(400).json({ error: 'You cannot report yourself' });

    if (targetUserId && !await User.exists({ _id: targetUserId })) return res.status(404).json({ error: 'Target user not found' });
    if (messageId) {
      const message = await Message.findById(messageId).select('_id sender receiver group');
      if (!message) return res.status(404).json({ error: 'Message not found' });
      if (message.group) {
        const Group = require('../models/Group');
        if (!await Group.exists({ _id: message.group, 'members.user': req.user.id })) return res.status(403).json({ error: 'You cannot report this message' });
      } else if (String(message.sender) !== String(req.user.id) && String(message.receiver) !== String(req.user.id)) {
        return res.status(403).json({ error: 'You cannot report this message' });
      }
    }

    const duplicate = await Report.exists({ reporter: req.user.id, message: messageId || null, status: 'open' });
    if (duplicate) return res.status(409).json({ error: 'You already reported this item' });
    const report = await Report.create({
      reporter: req.user.id,
      targetUser: targetUserId || null,
      message: messageId || null,
      reason,
      details: typeof details === 'string' ? details.trim().slice(0, 1000) : ''
    });
    res.status(201).json({ id: report._id, status: report.status });
  } catch (error) {
    console.error('Create report error:', error);
    res.status(500).json({ error: 'Unable to submit report' });
  }
});

module.exports = router;
