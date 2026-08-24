const mongoose = require('mongoose');

const MAX_MESSAGE_LENGTH = 4000;
const MAX_URL_LENGTH = 2048;
const MAX_ATTACHMENT_SIZE = 25 * 1024 * 1024;

const isValidObjectId = (value) => mongoose.isValidObjectId(value);

const normalizeEmail = (value) => (
  typeof value === 'string' ? value.trim().toLowerCase() : ''
);

const isValidEmail = (email) => (
  email.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
);

const validateRegistration = ({ name, email, password } = {}) => {
  const normalizedName = typeof name === 'string' ? name.trim() : '';
  const normalizedEmail = normalizeEmail(email);

  if (normalizedName.length < 2 || normalizedName.length > 50) {
    return { valid: false, message: 'Name must be between 2 and 50 characters' };
  }

  if (!isValidEmail(normalizedEmail)) {
    return { valid: false, message: 'Please provide a valid email address' };
  }

  if (typeof password !== 'string' || password.length < 8 || password.length > 128) {
    return { valid: false, message: 'Password must be between 8 and 128 characters' };
  }

  return {
    valid: true,
    value: { name: normalizedName, email: normalizedEmail, password }
  };
};

const validateLogin = ({ email, password } = {}) => {
  const normalizedEmail = normalizeEmail(email);
  if (!isValidEmail(normalizedEmail) || typeof password !== 'string' || password.length === 0) {
    return { valid: false, message: 'Email and password are required' };
  }
  return { valid: true, value: { email: normalizedEmail, password } };
};

const isSafeMediaUrl = (value) => {
  if (typeof value !== 'string' || value.length === 0 || value.length > MAX_URL_LENGTH) return false;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' || url.protocol === 'http:';
  } catch {
    return false;
  }
};

const validateMessagePayload = ({ receiverId, text, image, video, attachment, replyTo } = {}) => {
  if (!isValidObjectId(receiverId)) {
    return { valid: false, message: 'Invalid recipient' };
  }

  const normalizedText = typeof text === 'string' ? text.trim() : '';
  const normalizedImage = typeof image === 'string' ? image.trim() : '';
  const normalizedVideo = typeof video === 'string' ? video.trim() : '';
  const normalizedAttachment = attachment && typeof attachment === 'object' ? {
    url: typeof attachment.url === 'string' ? attachment.url.trim() : '',
    publicId: typeof attachment.publicId === 'string' ? attachment.publicId.slice(0, 255) : '',
    resourceType: typeof attachment.resourceType === 'string' ? attachment.resourceType : '',
    mimeType: typeof attachment.mimeType === 'string' ? attachment.mimeType.slice(0, 150) : '',
    fileName: typeof attachment.fileName === 'string' ? attachment.fileName.trim().slice(0, 255) : '',
    fileSize: Number(attachment.fileSize) || 0,
    duration: Number(attachment.duration) || null,
    width: Number(attachment.width) || null,
    height: Number(attachment.height) || null
  } : null;

  if (normalizedText.length > MAX_MESSAGE_LENGTH) {
    return { valid: false, message: `Message must be ${MAX_MESSAGE_LENGTH} characters or fewer` };
  }

  if (!normalizedText && !normalizedImage && !normalizedVideo && !normalizedAttachment?.url) {
    return { valid: false, message: 'Message cannot be empty' };
  }

  if (normalizedAttachment) {
    const allowedTypes = new Set(['image', 'video', 'audio', 'raw']);
    if (!allowedTypes.has(normalizedAttachment.resourceType) || !isSafeMediaUrl(normalizedAttachment.url)) {
      return { valid: false, message: 'Invalid attachment' };
    }
    if (!normalizedAttachment.fileSize || normalizedAttachment.fileSize > MAX_ATTACHMENT_SIZE) {
      return { valid: false, message: 'Attachment must be 25MB or smaller' };
    }
  }

  if (normalizedImage && !isSafeMediaUrl(normalizedImage)) {
    return { valid: false, message: 'Invalid image URL' };
  }

  if (normalizedVideo && !isSafeMediaUrl(normalizedVideo)) {
    return { valid: false, message: 'Invalid video URL' };
  }

  if (replyTo && !isValidObjectId(replyTo)) {
    return { valid: false, message: 'Invalid reply reference' };
  }

  return {
    valid: true,
    value: {
      receiverId: String(receiverId),
      text: normalizedText,
      image: normalizedImage,
      video: normalizedVideo,
      attachment: normalizedAttachment,
      replyTo: replyTo || null
    }
  };
};

module.exports = {
  MAX_MESSAGE_LENGTH,
  isValidObjectId,
  normalizeEmail,
  validateRegistration,
  validateLogin,
  validateMessagePayload
};
