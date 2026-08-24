const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const User = require('../models/User');
const mongoose = require('mongoose');

// ===== GET ALL USERS (except current user) =====
router.get('/', auth, async (req, res) => {
  try {
    const users = await User.find({ _id: { $ne: req.user.id } })
      .select('-password -blockedUsers')
      .sort({ online: -1, name: 1 });
    res.json(users);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// ===== SEARCH USERS =====
router.get('/search', auth, async (req, res) => {
  try {
    const q = typeof req.query.q === 'string' ? req.query.q.trim().slice(0, 80) : '';
    if (!q) {
      return res.status(400).json({ message: 'Search query required' });
    }

    const escapedQuery = q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const users = await User.find({
      _id: { $ne: req.user.id },
      $or: [
        { name: { $regex: escapedQuery, $options: 'i' } },
        { email: { $regex: escapedQuery, $options: 'i' } },
      ]
    }).select('-password -blockedUsers').limit(10);

    res.json(users);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// ===== GET USER BY ID =====
router.get('/:id', auth, async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ message: 'Invalid user ID' });
    }
    const user = await User.findById(req.params.id).select('-password -blockedUsers');
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    res.json(user);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// ===== UPDATE ONLINE STATUS =====
router.put('/online', auth, async (req, res) => {
  try {
    const { online } = req.body;
    const user = await User.findByIdAndUpdate(
      req.user.id,
      { online, lastSeen: Date.now() },
      { new: true }
    ).select('-password -blockedUsers');
    res.json(user);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

const authenticate = require('../middleware/auth');

// ===== UPDATE PROFILE (nickname + avatar) =====
router.patch('/profile', authenticate, async (req, res) => {
  try {
    const { name, avatar } = req.body;

    const update = {};
    if (name && name.trim()) update.name = name.trim();
    if (avatar !== undefined) update.avatar = avatar;

    const user = await User.findByIdAndUpdate(
      req.user.id,
      update,
      { new: true, runValidators: true }
    ).select('-password -blockedUsers');

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.json(user);
  } catch (error) {
    console.error('❌ Profile update error:', error);
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;