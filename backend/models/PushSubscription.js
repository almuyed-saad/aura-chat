const mongoose = require('mongoose');

// A user can have multiple subscriptions (phone + laptop + tablet all
// separately subscribed), so this is NOT unique per user - it's unique
// per endpoint (one row per device/browser installation).
const PushSubscriptionSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  endpoint: {
    type: String,
    required: true,
    unique: true
  },
  keys: {
    p256dh: { type: String, required: true },
    auth: { type: String, required: true }
  }
}, { timestamps: true });

module.exports = mongoose.models.PushSubscription || mongoose.model('PushSubscription', PushSubscriptionSchema);