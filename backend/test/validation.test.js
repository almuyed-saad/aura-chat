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

test('rejects unsafe media URLs', () => {
  const result = validateMessagePayload({
    receiverId: validReceiverId,
    image: 'javascript:alert(1)'
  });
  assert.equal(result.valid, false);
});
