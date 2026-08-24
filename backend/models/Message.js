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
    default: null
  },
  group: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Group',
    default: null
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
  attachment: {
    url: { type: String, maxlength: 2048 },
    publicId: { type: String, maxlength: 255 },
    resourceType: { type: String, enum: ['image', 'video', 'audio', 'raw'] },
    mimeType: { type: String, maxlength: 150 },
    fileName: { type: String, maxlength: 255 },
    fileSize: { type: Number, min: 0, max: 25 * 1024 * 1024 },
    duration: { type: Number, min: 0 },
    width: { type: Number, min: 0 },
    height: { type: Number, min: 0 }
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
  threadRoot: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Message',
    default: null
  },
  mentions: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  starredBy: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
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
  edited: {
    type: Boolean,
    default: false
  },
  editedAt: {
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
MessageSchema.index({ group: 1, createdAt: 1 });
MessageSchema.index({ threadRoot: 1, createdAt: 1 });
MessageSchema.index(
  { sender: 1, clientMessageId: 1 },
  { unique: true, sparse: true }
);

module.exports = mongoose.models.Message || mongoose.model('Message', MessageSchema);
