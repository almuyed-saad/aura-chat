const test = require('node:test');
const assert = require('node:assert/strict');
const {
  validateRegistration,
  validateLogin,
  validateMessagePayload
} = require('../utils/validation');

const validReceiverId = '507f1f77bcf86cd799439011';

test('normalizes valid registration data', () => {
  const result = validateRegistration({
    name: '  Aura User  ',
    email: 'USER@Example.COM ',
    password: 'correct horse battery staple'
  });

  assert.equal(result.valid, true);
  assert.deepEqual(result.value, {
    name: 'Aura User',
    email: 'user@example.com',
    password: 'correct horse battery staple'
  });
});

test('rejects weak registration data', () => {
  assert.equal(validateRegistration({ name: 'A', email: 'bad', password: 'short' }).valid, false);
});

test('normalizes valid login data', () => {
  const result = validateLogin({ email: ' USER@Example.COM ', password: 'password' });
  assert.equal(result.valid, true);
  assert.equal(result.value.email, 'user@example.com');
});

test('accepts a group message with bounded mentions and thread root', () => {
  const result = validateMessagePayload({
    groupId: validReceiverId,
    text: 'Hello @Aura',
    mentions: [validReceiverId],
    threadRoot: validReceiverId
  });
  assert.equal(result.valid, true);
  assert.equal(result.value.groupId, validReceiverId);
  assert.deepEqual(result.value.mentions, [validReceiverId]);
});

test('rejects a payload that targets both a user and a group', () => {
  assert.equal(validateMessagePayload({ receiverId: validReceiverId, groupId: validReceiverId, text: 'Hello' }).valid, false);
});

test('rejects an invalid recipient', () => {
  const result = validateMessagePayload({ receiverId: 'not-an-id', text: 'Hello' });
  assert.equal(result.valid, false);
  assert.equal(result.message, 'Invalid recipient');
});

test('rejects empty and oversized messages', () => {
  assert.equal(validateMessagePayload({ receiverId: validReceiverId, text: '   ' }).valid, false);
  assert.equal(validateMessagePayload({ receiverId: validReceiverId, text: 'x'.repeat(4001) }).valid, false);
});

test('accepts bounded text and media payloads', () => {
  const result = validateMessagePayload({
    receiverId: validReceiverId,
    text: ' Hello ',
    image: 'https://res.cloudinary.com/example/image/upload/aura.jpg',
    replyTo: validReceiverId
  });

  assert.equal(result.valid, true);
  assert.equal(result.value.text, 'Hello');
});

test('accepts a bounded rich-media attachment', () => {
  const result = validateMessagePayload({
    receiverId: validReceiverId,
    attachment: {
      url: 'https://res.cloudinary.com/example/video/upload/voice.webm',
      publicId: 'voice-note-1',
      resourceType: 'audio',
      mimeType: 'audio/webm',
      fileName: 'voice-note.webm',
      fileSize: 120000,
      duration: 12
    }
  });
  assert.equal(result.valid, true);
  assert.equal(result.value.attachment.resourceType, 'audio');
});

test('rejects oversized rich-media attachments', () => {
  const result = validateMessagePayload({
    receiverId: validReceiverId,
    attachment: {
      url: 'https://res.cloudinary.com/example/raw/upload/file.pdf',
      resourceType: 'raw',
      fileSize: 26 * 1024 * 1024
    }
  });
  assert.equal(result.valid, false);
});

test('rejects unsafe media URLs', () => {
  const result = validateMessagePayload({
    receiverId: validReceiverId,
    image: 'javascript:alert(1)'
  });
  assert.equal(result.valid, false);
});
