const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const User = require('../models/User');

// ===== GET ALL USERS (except current user) =====
router.get('/', auth, async (req, res) => {
  try {
    const users = await User.find({ _id: { $ne: req.user.id } })
      .select('-password')
      .sort({ online: -1, name: 1 });
    res.json(users);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// ===== SEARCH USERS =====
router.get('/search', auth, async (req, res) => {
  try {
    const { q } = req.query;
    if (!q) {
      return res.status(400).json({ message: 'Search query required' });
    }

    const users = await User.find({
      _id: { $ne: req.user.id },
      $or: [
        { name: { $regex: q, $options: 'i' } },
        { email: { $regex: q, $options: 'i' } },
      ]
    }).select('-password').limit(10);

    res.json(users);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// ===== GET USER BY ID =====
router.get('/:id', auth, async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select('-password');
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
    ).select('-password');
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
    ).select('-password');

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