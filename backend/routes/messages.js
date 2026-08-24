const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const Message = require('../models/Message');
const Group = require('../models/Group');
const { isValidObjectId } = require('../utils/validation');

const canAccessMessage = async (message, userId) => {
  if (!message) return false;
  if (message.group) return Boolean(await Group.exists({ _id: message.group, 'members.user': userId }));
  return String(message.sender) === String(userId) || String(message.receiver) === String(userId);
};

// Get unread counts before the parameterized conversation route.
router.get('/unread/count', auth, async (req, res) => {
  try {
    const unreadCounts = await Message.aggregate([
      { $match: { receiver: req.user.id, read: false } },
      { $group: { _id: '$sender', count: { $sum: 1 } } }
    ]);
    res.json(unreadCounts);
  } catch (error) {
    console.error('Unread count error:', error);
    res.status(500).json({ error: 'Unable to load unread counts' });
  }
});

router.get('/starred', auth, async (req, res) => {
  try {
    const messages = await Message.find({ starredBy: req.user.id })
      .populate('sender', 'name avatar')
      .populate('receiver', 'name avatar')
      .populate('group', 'name avatar')
      .sort({ createdAt: -1 })
      .limit(200)
      .lean();
    res.json(messages);
  } catch (error) {
    console.error('Starred messages error:', error);
    res.status(500).json({ error: 'Unable to load starred messages' });
  }
});

router.get('/:messageId/thread', auth, async (req, res) => {
  try {
    if (!isValidObjectId(req.params.messageId)) return res.status(400).json({ error: 'Invalid message ID' });
    const root = await Message.findById(req.params.messageId).select('sender receiver group');
    if (!await canAccessMessage(root, req.user.id)) return res.status(403).json({ error: 'You cannot view this thread' });
    const messages = await Message.find({ $or: [{ _id: root._id }, { threadRoot: root._id }] })
      .populate('sender', 'name avatar')
      .sort({ createdAt: 1 })
      .lean();
    res.json(messages);
  } catch (error) {
    console.error('Thread error:', error);
    res.status(500).json({ error: 'Unable to load thread' });
  }
});

// Get messages between two direct-chat users.
router.get('/:userId', auth, async (req, res) => {
  try {
    const { userId } = req.params;
    const currentUserId = req.user.id || req.user._id;
    if (!isValidObjectId(userId) || String(userId) === String(currentUserId)) {
      return res.status(400).json({ error: 'Invalid conversation user' });
    }

    await Message.updateMany(
      { sender: userId, receiver: currentUserId, read: false },
      { read: true, status: 'read', readAt: new Date() }
    );

    const messages = await Message.find({
      $or: [
        { sender: currentUserId, receiver: userId },
        { sender: userId, receiver: currentUserId }
      ]
    })
      .populate('sender', 'name avatar')
      .populate('receiver', 'name avatar')
      .populate('deletedBy', 'name')
      .populate('replyTo', 'text sender')
      .populate('replyToSender', 'name')
      .sort({ createdAt: 1 });

    res.json(messages.map(message => {
      const obj = message.toObject();
      return {
        ...obj,
        reactions: obj.reactions instanceof Map ? Object.fromEntries(obj.reactions) : obj.reactions || {},
        isStarred: obj.starredBy?.some(id => String(id) === String(currentUserId)) || false
      };
    }));
  } catch (error) {
    console.error('Direct messages error:', error);
    res.status(500).json({ error: 'Unable to load messages' });
  }
});

module.exports = router;
