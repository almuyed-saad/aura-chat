const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const Message = require('../models/Message');

// Get messages between two users
router.get('/:userId', auth, async (req, res) => {
  try {
    const { userId } = req.params;
    const currentUserId = req.user.id || req.user._id;
    
    // ✅ Mark messages as read when user opens chat
    await Message.updateMany(
      {
        sender: userId,
        receiver: currentUserId,
        read: false
      },
      {
        read: true,
        readAt: new Date()
      }
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

    const formattedMessages = messages.map(msg => {
      const obj = msg.toObject();
      const reactions = obj.reactions instanceof Map 
        ? Object.fromEntries(obj.reactions) 
        : obj.reactions || {};
      
      return {
        ...obj,
        reactions: reactions
      };
    });

    res.json(formattedMessages);
  } catch (error) {
    console.error('❌ Error fetching messages:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// ✅ Get unread counts for all users
router.get('/unread/count', auth, async (req, res) => {
  try {
    const currentUserId = req.user.id || req.user._id;
    
    const unreadCounts = await Message.aggregate([
      {
        $match: {
          receiver: currentUserId,
          read: false
        }
      },
      {
        $group: {
          _id: '$sender',
          count: { $sum: 1 }
        }
      }
    ]);

    res.json(unreadCounts);
  } catch (error) {
    console.error('❌ Error fetching unread counts:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;