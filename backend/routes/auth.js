const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const rateLimit = require('../middleware/rateLimit');
const { validateRegistration, validateLogin } = require('../utils/validation');

const authRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: 'Too many authentication attempts. Please try again later.'
});

const serializeUser = (user) => ({
  id: String(user._id),
  _id: String(user._id),
  name: user.name,
  email: user.email,
  avatar: user.avatar
});

// ===== REGISTER =====
router.post('/register', authRateLimit, async (req, res) => {
  try {
    const validation = validateRegistration(req.body);
    if (!validation.valid) {
      return res.status(400).json({ message: validation.message });
    }

    const { name, email, password } = validation.value;

    // Check if user exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: 'User already exists' });
    }

    // Create new user
    const user = new User({ name, email, password });
    await user.save();

    // Generate JWT
    const token = jwt.sign(
      { id: user._id },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.status(201).json({ token, user: serializeUser(user) });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({ message: 'An account with this email already exists' });
    }
    if (error.name === 'ValidationError') {
      return res.status(400).json({ message: 'Invalid registration data' });
    }
    console.error('Registration error:', error);
    res.status(500).json({ message: 'Unable to create account' });
  }
});

// ===== LOGIN =====
router.post('/login', authRateLimit, async (req, res) => {
  try {
    const validation = validateLogin(req.body);
    if (!validation.valid) {
      return res.status(400).json({ message: validation.message });
    }

    const { email, password } = validation.value;

    // Find user
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    // Check password
    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    // Generate JWT
    const token = jwt.sign(
      { id: user._id },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({ token, user: serializeUser(user) });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ message: 'Unable to sign in' });
  }
});

// ===== GET PROFILE (Protected) =====
router.get('/profile', require('../middleware/auth'), async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('-password');
    res.json(user);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;