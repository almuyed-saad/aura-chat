const mongoose = require('mongoose');

const MessageSchema = new mongoose.Schema({
  sender: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  receiver: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  clientMessageId: {
    type: String,
    trim: true,
    maxlength: 100,
    default: undefined
  },
  text: {
    type: String,
    default: ''
  },
  image: {
    type: String,
    default: ''
  },
  imagePublicId: {
    type: String,
    default: ''
  },
  video: {
    type: String,
    default: ''
  },
  videoPublicId: {
    type: String,
    default: ''
  },
  reactions: {
    type: Map,
    of: String,
    default: () => new Map()
  },
  replyTo: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Message',
    default: null
  },
  replyToText: {
    type: String,
    default: ''
  },
  replyToSender: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  // ✅ STATUS FIELD - sent, delivered, read
  status: {
    type: String,
    enum: ['sent', 'delivered', 'read'],
    default: 'sent'
  },
  deliveredAt: {
    type: Date
  },
  read: {
    type: Boolean,
    default: false
  },
  readAt: {
    type: Date
  },
  deleted: {
    type: Boolean,
    default: false
  },
  deletedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  deletedAt: {
    type: Date
  }
}, { timestamps: true });

MessageSchema.index({ sender: 1, receiver: 1, createdAt: 1 });
MessageSchema.index({ receiver: 1, read: 1, sender: 1 });
MessageSchema.index(
  { sender: 1, clientMessageId: 1 },
  { unique: true, sparse: true }
);

module.exports = mongoose.models.Message || mongoose.model('Message', MessageSchema);
