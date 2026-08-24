const mongoose = require('mongoose');

const ConversationSchema = new mongoose.Schema({
  participantKey: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  participants: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  }],
  lastMessage: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Message',
    default: null
  },
  lastMessageText: {
    type: String,
    default: '',
    maxlength: 4000
  },
  lastMessageSender: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  lastMessageAt: {
    type: Date,
    default: Date.now,
    index: true
  },
  pinnedBy: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  mutedBy: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  archivedBy: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }]
}, { timestamps: true });

ConversationSchema.index({ participants: 1, lastMessageAt: -1 });

module.exports = mongoose.models.Conversation || mongoose.model('Conversation', ConversationSchema);
