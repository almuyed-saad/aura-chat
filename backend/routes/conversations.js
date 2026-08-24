const express = require('express');
const mongoose = require('mongoose');
const router = express.Router();
const auth = require('../middleware/auth');
const User = require('../models/User');
const Conversation = require('../models/Conversation');
const Message = require('../models/Message');
const { isValidObjectId } = require('../utils/validation');

const participantKeyFor = (first, second) => [String(first), String(second)].sort().join(':');

const getPreferenceSet = (conversation, field, userId) => (
  Boolean(conversation?.[field]?.some(id => String(id) === String(userId)))
);

router.get('/', auth, async (req, res) => {
  try {
    const currentUserId = new mongoose.Types.ObjectId(req.user.id);
    const [latestMessages, unreadCounts, preferences] = await Promise.all([
      Message.aggregate([
        { $match: { $or: [{ sender: currentUserId }, { receiver: currentUserId }] } },
        { $sort: { createdAt: -1 } },
        {
          $project: {
            otherUserId: {
              $cond: [
                { $eq: ['$sender', currentUserId] },
                '$receiver',
                '$sender'
              ]
            },
            text: 1,
            image: 1,
            video: 1,
            attachment: 1,
            deleted: 1,
            sender: 1,
            createdAt: 1
          }
        },
        { $group: { _id: '$otherUserId', message: { $first: '$$ROOT' } } },
        { $sort: { 'message.createdAt': -1 } }
      ]),
      Message.aggregate([
        { $match: { receiver: currentUserId, read: false } },
        { $group: { _id: '$sender', count: { $sum: 1 } } }
      ]),
      Conversation.find({ participants: currentUserId }).lean()
    ]);

    const userIds = latestMessages.map(item => item._id);
    const users = await User.find({ _id: { $in: userIds } })
      .select('name avatar online lastSeen')
      .lean();
    const userById = new Map(users.map(user => [String(user._id), user]));
    const unreadById = new Map(unreadCounts.map(item => [String(item._id), item.count]));
    const preferenceByKey = new Map(preferences.map(item => [item.participantKey, item]));

    const summaries = latestMessages
      .map(({ _id, message }) => {
        const otherUser = userById.get(String(_id));
        if (!otherUser) return null;
        const preference = preferenceByKey.get(participantKeyFor(currentUserId, _id));
        return {
          user: otherUser,
          lastMessage: {
            text: message.deleted ? 'Message deleted' : (message.text || (message.attachment?.resourceType === 'audio' ? 'Voice note' : message.attachment?.resourceType === 'raw' ? 'Document' : message.image || message.attachment?.resourceType === 'image' ? 'Image' : message.video || message.attachment?.resourceType === 'video' ? 'Video' : 'Message')),
            senderId: String(message.sender),
            createdAt: message.createdAt
          },
          unreadCount: unreadById.get(String(_id)) || 0,
          isPinned: getPreferenceSet(preference, 'pinnedBy', currentUserId),
          isMuted: getPreferenceSet(preference, 'mutedBy', currentUserId),
          isArchived: getPreferenceSet(preference, 'archivedBy', currentUserId)
        };
      })
      .filter(Boolean)
      .sort((a, b) => Number(b.isPinned) - Number(a.isPinned) || new Date(b.lastMessage.createdAt) - new Date(a.lastMessage.createdAt));

    res.json(summaries);
  } catch (error) {
    console.error('Conversation summary error:', error);
    res.status(500).json({ error: 'Unable to load conversations' });
  }
});

router.put('/:userId/preferences', auth, async (req, res) => {
  try {
    const { userId } = req.params;
    const { preference, enabled } = req.body || {};
    const allowedPreferences = new Set(['pinnedBy', 'mutedBy', 'archivedBy']);

    if (!isValidObjectId(userId) || String(userId) === String(req.user.id)) {
      return res.status(400).json({ error: 'Invalid conversation user' });
    }
    if (!allowedPreferences.has(preference) || typeof enabled !== 'boolean') {
      return res.status(400).json({ error: 'Invalid conversation preference' });
    }
    if (!await User.exists({ _id: userId })) {
      return res.status(404).json({ error: 'User not found' });
    }

    const participantKey = participantKeyFor(req.user.id, userId);
    const update = enabled
      ? { $addToSet: { [preference]: req.user.id } }
      : { $pull: { [preference]: req.user.id } };

    const conversation = await Conversation.findOneAndUpdate(
      { participantKey },
      {
        $setOnInsert: { participantKey, participants: [req.user.id, userId] },
        ...update
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    ).lean();

    res.json({
      preference,
      enabled,
      isPinned: getPreferenceSet(conversation, 'pinnedBy', req.user.id),
      isMuted: getPreferenceSet(conversation, 'mutedBy', req.user.id),
      isArchived: getPreferenceSet(conversation, 'archivedBy', req.user.id)
    });
  } catch (error) {
    console.error('Conversation preference error:', error);
    res.status(500).json({ error: 'Unable to update conversation preference' });
  }
});

module.exports = { router, participantKeyFor };
