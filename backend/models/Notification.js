const mongoose = require('mongoose');

const NotificationSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  actor: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  type: { type: String, enum: ['mention', 'reply', 'group_invite', 'moderation', 'system'], required: true },
  text: { type: String, required: true, maxlength: 500 },
  entityId: { type: mongoose.Schema.Types.ObjectId, default: null },
  entityType: { type: String, enum: ['message', 'group', 'report', 'system'], default: 'system' },
  read: { type: Boolean, default: false },
  readAt: { type: Date }
}, { timestamps: true });

NotificationSchema.index({ user: 1, read: 1, createdAt: -1 });

module.exports = mongoose.models.Notification || mongoose.model('Notification', NotificationSchema);
