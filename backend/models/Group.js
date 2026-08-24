const mongoose = require('mongoose');

const GroupMemberSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  role: { type: String, enum: ['owner', 'admin', 'member'], default: 'member' },
  joinedAt: { type: Date, default: Date.now }
}, { _id: false });

const GroupSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, minlength: 2, maxlength: 80 },
  description: { type: String, trim: true, maxlength: 500, default: '' },
  avatar: { type: String, maxlength: 2048, default: '' },
  owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  members: {
    type: [GroupMemberSchema],
    validate: value => value.length >= 1 && value.length <= 100
  },
  lastMessage: { type: mongoose.Schema.Types.ObjectId, ref: 'Message', default: null },
  lastMessageText: { type: String, maxlength: 4000, default: '' },
  lastMessageSender: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  lastMessageAt: { type: Date, default: Date.now }
}, { timestamps: true });

GroupSchema.index({ 'members.user': 1, lastMessageAt: -1 });
GroupSchema.index({ owner: 1, createdAt: -1 });

module.exports = mongoose.models.Group || mongoose.model('Group', GroupSchema);
