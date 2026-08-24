const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const http = require('http');
const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
require('dotenv').config();

const { sendPushToUser } = require('./services/pushSender');
const User = require('./models/User');
const Message = require('./models/Message');
const Conversation = require('./models/Conversation');
const { router: conversationRouter, participantKeyFor } = require('./routes/conversations');
const { isValidObjectId, validateMessagePayload, MAX_MESSAGE_LENGTH } = require('./utils/validation');

// ===== INITIALIZE APP =====
const app = express();
const server = http.createServer(app);

// ===== SOCKET.IO SETUP =====
const allowedOrigins = (process.env.ALLOWED_ORIGINS || [
  'http://localhost:5173',
  'https://aura-chat-topaz.vercel.app'
].join(',')).split(',').map(origin => origin.trim()).filter(Boolean);

const io = new Server(server, {
  cors: {
    origin: allowedOrigins,
    methods: ['GET', 'POST'],
    credentials: true
  }
});

// ===== MIDDLEWARE =====

app.use(cors({
  origin: function (origin, callback) {
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      console.log('❌ Blocked by CORS:', origin);
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true
}));
app.use(express.json({ limit: '1mb' }));

// ===== HEALTH ROUTES =====
let dbReady = false;

app.get('/health/live', (req, res) => {
  res.status(200).json({ status: 'ok' });
});

app.get('/health/ready', (req, res) => {
  if (!dbReady) {
    return res.status(503).json({ status: 'not_ready', database: 'disconnected' });
  }
  return res.status(200).json({ status: 'ready', database: 'connected' });
});

app.get('/', (req, res) => {
  res.status(dbReady ? 200 : 503).json({
    status: dbReady ? 'ok' : 'starting',
    message: dbReady ? 'Chat API is running!' : 'Chat API is starting'
  });
});

// ===== API ROUTES =====
app.use('/api/auth', require('./routes/auth'));
app.use('/api/users', require('./routes/users'));
app.use('/api/messages', require('./routes/messages'));
app.use('/api/conversations', conversationRouter);
app.use('/api/push', require('./routes/push'));

app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

app.use((error, req, res, next) => {
  if (error?.type === 'entity.too.large') {
    return res.status(413).json({ error: 'Request payload is too large' });
  }
  console.error('Unhandled request error:', error?.message || error);
  return res.status(500).json({ error: 'Internal server error' });
});

// ===== MONGODB CONNECTION =====
const connectDB = async () => {
  try {
    if (!process.env.MONGO_URI) {
      throw new Error('MONGO_URI is not configured');
    }

    await mongoose.connect(process.env.MONGO_URI, {
      dbName: 'chat-app',
      serverSelectionTimeoutMS: 30000,
      socketTimeoutMS: 45000,
      connectTimeoutMS: 30000,
    });
    dbReady = true;
    console.log('✅ Connected to MongoDB');
    await User.updateMany({}, { online: false });
    console.log('🧹 Reset all users to offline on server start');
  } catch (err) {
    dbReady = false;
    console.error('❌ MongoDB connection error:', err.message);
    console.log('🔄 Retrying in 5 seconds...');
    setTimeout(connectDB, 5000);
  }
};

connectDB();

// ===== SOCKET STORE =====
// A user may be connected from several tabs or devices at once.
const userSocketMap = new Map();

const addUserSocket = (userId, socketId) => {
  const sockets = userSocketMap.get(userId) || new Set();
  sockets.add(socketId);
  userSocketMap.set(userId, sockets);
};

const removeUserSocket = (userId, socketId) => {
  const sockets = userSocketMap.get(userId);
  if (!sockets) return false;
  sockets.delete(socketId);
  if (sockets.size === 0) userSocketMap.delete(userId);
  return sockets.size > 0;
};

const isUserOnline = (userId) => userSocketMap.has(String(userId));

const getMessagePreview = (message) => {
  if (message.deleted) return 'Message deleted';
  if (message.text) return message.text.slice(0, 400);
  if (message.attachment?.resourceType === 'audio') return 'Voice note';
  if (message.attachment?.resourceType === 'raw') return 'Document';
  if (message.attachment?.resourceType === 'image' || message.image) return 'Image';
  if (message.attachment?.resourceType === 'video' || message.video) return 'Video';
  return 'Message';
};

const updateConversationSummary = async (message) => {
  const senderId = String(message.sender);
  const receiverId = String(message.receiver);
  await Conversation.findOneAndUpdate(
    { participantKey: participantKeyFor(senderId, receiverId) },
    {
      $set: {
        lastMessage: message._id,
        lastMessageText: getMessagePreview(message),
        lastMessageSender: senderId,
        lastMessageAt: message.createdAt || new Date()
      },
      $setOnInsert: {
        participantKey: participantKeyFor(senderId, receiverId),
        participants: [senderId, receiverId]
      }
    },
    { upsert: true, setDefaultsOnInsert: true }
  );
};

// ===== SOCKET.IO AUTHENTICATION MIDDLEWARE =====
io.use((socket, next) => {
  if (!dbReady) return next(new Error('Service not ready'));

  const token = socket.handshake.auth?.token;
  if (!token) return next(new Error('Authentication error'));

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    if (!decoded.id || !isValidObjectId(decoded.id)) {
      return next(new Error('Authentication error'));
    }
    socket.userId = String(decoded.id);
    next();
  } catch (err) {
    next(new Error('Authentication error'));
  }
});

// ===== SOCKET.IO CONNECTION HANDLER =====
io.on('connection', (socket) => {
  console.log('🟢 User connected:', socket.userId);

  addUserSocket(socket.userId, socket.id);
  socket.join(socket.userId);

  // ===== JOIN ROOM (for reconnects) =====
  // The payload is intentionally ignored. Socket identity comes from the JWT.
  socket.on('joinRoom', () => {
    socket.join(socket.userId);
  });

  const messageRateWindow = { startedAt: Date.now(), count: 0 };
  const canSendMessage = () => {
    const now = Date.now();
    if (now - messageRateWindow.startedAt >= 60 * 1000) {
      messageRateWindow.startedAt = now;
      messageRateWindow.count = 0;
    }
    messageRateWindow.count += 1;
    return messageRateWindow.count <= 60;
  };

  // ===== SEND MESSAGE =====
  socket.on('sendMessage', async (data = {}) => {
    try {
      if (!canSendMessage()) {
        return socket.emit('messageError', {
          clientMessageId: data.clientMessageId || null,
          error: 'Too many messages. Please slow down.'
        });
      }

      const validation = validateMessagePayload(data);
      if (!validation.valid) {
        return socket.emit('messageError', { clientMessageId: data.clientMessageId || null, error: validation.message });
      }

      const { receiverId, text, image, video, replyTo } = validation.value;
      const clientMessageId = typeof data.clientMessageId === 'string'
        ? data.clientMessageId.trim().slice(0, 100)
        : '';

      const receiver = await User.findById(receiverId).select('_id');
      if (!receiver) {
        return socket.emit('messageError', { clientMessageId: clientMessageId || null, error: 'Recipient not found' });
      }

      let message = clientMessageId
        ? await Message.findOne({ sender: socket.userId, clientMessageId })
        : null;
      const isNewMessage = !message;

      if (!message) {
        const receiverOnline = isUserOnline(receiverId);
        message = new Message({
          sender: socket.userId,
          receiver: receiverId,
          clientMessageId: clientMessageId || undefined,
          text,
          image,
          imagePublicId: typeof data.imagePublicId === 'string' ? data.imagePublicId.slice(0, 255) : '',
          video,
          videoPublicId: typeof data.videoPublicId === 'string' ? data.videoPublicId.slice(0, 255) : '',
          attachment: validation.value.attachment,
          replyTo,
          replyToText: typeof data.replyToText === 'string' ? data.replyToText.trim().slice(0, 500) : '',
          replyToSender: isValidObjectId(data.replyToSender) ? data.replyToSender : null,
          status: receiverOnline ? 'delivered' : 'sent',
          deliveredAt: receiverOnline ? new Date() : null,
          read: false
        });
        await message.save();
        await updateConversationSummary(message);
      }

      const populatedMessage = await Message.findById(message._id)
        .populate('sender', 'name avatar')
        .populate('receiver', 'name avatar')
        .lean();

      const messageToSend = {
        ...populatedMessage,
        reactions: populatedMessage.reactions instanceof Map
          ? Object.fromEntries(populatedMessage.reactions)
          : populatedMessage.reactions || {}
      };

      if (!isNewMessage) {
        return socket.emit('messageAcknowledged', { clientMessageId, message: messageToSend });
      }

      io.to(receiverId).emit('receiveMessage', messageToSend);
      io.to(socket.userId).except(socket.id).emit('receiveMessage', messageToSend);
      socket.emit('messageAcknowledged', { clientMessageId, message: messageToSend });

      const conversationSettings = await Conversation.findOne({
        participantKey: participantKeyFor(socket.userId, receiverId)
      }).select('mutedBy').lean();
      const recipientMuted = conversationSettings?.mutedBy?.some(id => String(id) === receiverId);

      if (!isUserOnline(receiverId) && !recipientMuted) {
        const senderUser = await User.findById(socket.userId).select('name');
        sendPushToUser(receiverId, {
          title: senderUser?.name || 'New message',
          body: text ? text.slice(0, 100) : getMessagePreview(message),
          senderId: socket.userId,
          url: '/'
        }).catch(err => console.error('❌ Push trigger failed:', err));
      }

      const unreadCount = await Message.countDocuments({
        receiver: receiverId,
        sender: socket.userId,
        read: false
      });
      io.to(receiverId).emit('unreadCount', { senderId: socket.userId, count: unreadCount });
    } catch (error) {
      console.error('❌ Message error:', error);
      socket.emit('messageError', {
        clientMessageId: data.clientMessageId || null,
        error: 'Failed to send message'
      });
    }
  });

  // ===== TYPING INDICATOR =====
  const emitTyping = (data = {}, isTyping) => {
    const receiverId = String(data.receiverId || '');
    if (!isValidObjectId(receiverId) || receiverId === socket.userId) return;
    io.to(receiverId).emit('typing', { userId: socket.userId, isTyping });
  };

  socket.on('typing', (data) => emitTyping(data, Boolean(data?.isTyping)));
  socket.on('stopTyping', (data) => emitTyping(data, false));

  // ===== REACTION =====
  socket.on('addReaction', async (data = {}) => {
    try {
      const { messageId, emoji } = data;
      if (!isValidObjectId(messageId) || (emoji !== null && (typeof emoji !== 'string' || emoji.length > 32))) {
        return socket.emit('reactionError', { error: 'Invalid reaction payload' });
      }

      const message = await Message.findOne({
        _id: messageId,
        $or: [{ sender: socket.userId }, { receiver: socket.userId }]
      });
      if (!message) {
        return socket.emit('reactionError', { error: 'Message not found' });
      }

      if (emoji === null) {
        message.reactions.delete(socket.userId);
        console.log('🗑️ Removed reaction from user:', socket.userId);
      } else {
        message.reactions.set(socket.userId, emoji);
        console.log('✅ Set reaction:', emoji, 'for user:', socket.userId);
      }
      
      await message.save();
      console.log('💾 Reaction saved to database');

      const updatedMessage = await Message.findById(messageId)
        .populate('sender', 'name avatar')
        .populate('receiver', 'name avatar');
      
      const messageToSend = {
        ...updatedMessage.toObject(),
        reactions: updatedMessage.reactions instanceof Map 
          ? Object.fromEntries(updatedMessage.reactions) 
          : updatedMessage.reactions || {}
      };
      
      const senderId = message.sender.toString();
      const receiverId = message.receiver.toString();
      io.to(senderId).emit('reactionUpdated', messageToSend);
      io.to(receiverId).emit('reactionUpdated', messageToSend);
      
    } catch (error) {
      console.error('❌ Reaction error:', error);
    }
  });

  // ===== EDIT MESSAGE =====
  socket.on('editMessage', async (data = {}) => {
    try {
      const { messageId, text } = data;
      const normalizedText = typeof text === 'string' ? text.trim() : '';
      if (!isValidObjectId(messageId) || !normalizedText || normalizedText.length > MAX_MESSAGE_LENGTH) {
        return socket.emit('messageError', { error: 'Invalid edited message' });
      }

      const message = await Message.findOne({
        _id: messageId,
        sender: socket.userId,
        deleted: false
      });
      if (!message) return socket.emit('messageError', { error: 'Message not found' });

      message.text = normalizedText;
      message.edited = true;
      message.editedAt = new Date();
      await message.save();
      await Conversation.updateOne(
        { lastMessage: message._id },
        { $set: { lastMessageText: getMessagePreview(message) } }
      );

      const updatedMessage = await Message.findById(messageId)
        .populate('sender', 'name avatar')
        .populate('receiver', 'name avatar')
        .lean();
      io.to(message.sender.toString()).emit('messageUpdated', updatedMessage);
      io.to(message.receiver.toString()).emit('messageUpdated', updatedMessage);
    } catch (error) {
      console.error('❌ Edit message error:', error);
      socket.emit('messageError', { error: 'Failed to edit message' });
    }
  });

  // ===== DELETE MESSAGE =====
  socket.on('deleteMessage', async (data = {}) => {
    try {
      const { messageId } = data;
      if (!isValidObjectId(messageId)) {
        return socket.emit('messageError', { error: 'Invalid message ID' });
      }

      const message = await Message.findOne({ _id: messageId, sender: socket.userId });
      if (!message) {
        console.log('❌ Message not found');
        return;
      }

      message.deleted = true;
      message.deletedBy = socket.userId;
      message.deletedAt = new Date();
      message.text = '';
      message.image = '';
      message.video = '';
      await message.save();
      await Conversation.updateOne(
        { lastMessage: message._id },
        { $set: { lastMessageText: getMessagePreview(message) } }
      );

      console.log('✅ Message marked as deleted');

      const updatedMessage = await Message.findById(messageId)
        .populate('sender', 'name avatar')
        .populate('receiver', 'name avatar')
        .populate('deletedBy', 'name')
        .lean();

      const messageToSend = {
        ...updatedMessage,
        reactions: updatedMessage.reactions instanceof Map 
          ? Object.fromEntries(updatedMessage.reactions) 
          : updatedMessage.reactions || {}
      };

      io.to(message.sender.toString()).emit('messageDeleted', messageToSend);
      io.to(message.receiver.toString()).emit('messageDeleted', messageToSend);
      
    } catch (error) {
      console.error('❌ Delete message error:', error);
    }
  });

  // ===== MARK AS READ =====
  socket.on('markAsRead', async ({ senderId } = {}) => {
    try {
      if (!isValidObjectId(senderId) || senderId === socket.userId) return;

      const unreadMessages = await Message.find({
        sender: senderId,
        receiver: socket.userId,
        status: { $ne: 'read' }
      });

      if (unreadMessages.length > 0) {
        const messageIds = unreadMessages.map(m => m._id);
        
        await Message.updateMany(
          { _id: { $in: messageIds } },
          { 
            status: 'read', 
            read: true, 
            readAt: new Date() 
          }
        );

        io.to(senderId).emit('messagesRead', {
          readerId: socket.userId,
          messageIds: messageIds.map(id => id.toString())
        });
        
        console.log(`✅ Marked ${messageIds.length} messages as read from ${senderId}`);
      }
      
      socket.emit('unreadCount', { 
        senderId: senderId, 
        count: 0 
      });
      
    } catch (error) {
      console.error('❌ markAsRead error:', error);
    }
  });

  // ===== UPDATE ONLINE STATUS & DELIVERY ON CONNECT =====
  (async () => {
    try {
      // ✅ Update online status
      await User.findByIdAndUpdate(socket.userId, { 
        online: true, 
        lastSeen: Date.now() 
      });

      const onlineUsers = await User.find({ online: true }).select('_id name');
      console.log('📡 Online users:', onlineUsers.map(u => u.name));
      
      // ✅ FIX: Broadcast to ALL users (not just the one who connected)
      io.emit('getOnlineUsers', onlineUsers);

      // ✅ Auto-upgrade pending messages to "delivered"
      const pendingMessages = await Message.find({
        receiver: socket.userId,
        status: 'sent'
      });

      if (pendingMessages.length > 0) {
        const messageIds = pendingMessages.map(m => m._id);
        await Message.updateMany(
          { _id: { $in: messageIds } },
          { status: 'delivered', deliveredAt: new Date() }
        );

        const bySender = {};
        pendingMessages.forEach(m => {
          const sId = m.sender.toString();
          if (!bySender[sId]) bySender[sId] = [];
          bySender[sId].push(m._id.toString());
        });

        Object.entries(bySender).forEach(([senderId, ids]) => {
          io.to(senderId).emit('messagesDelivered', { messageIds: ids });
        });
        console.log('📬 Delivered', messageIds.length, 'pending messages to', socket.userId);
      }

    } catch (error) {
      console.error('❌ Connection error:', error);
    }
  })();

  // ===== DISCONNECT =====
  socket.on('disconnect', async () => {
    console.log('🔴 User disconnected:', socket.userId);

    try {
      const stillOnline = removeUserSocket(socket.userId, socket.id);

      if (!stillOnline) {
        await User.findByIdAndUpdate(socket.userId, {
          online: false,
          lastSeen: Date.now()
        });
      }

      const onlineUsers = await User.find({ online: true }).select('_id name');
      io.emit('getOnlineUsers', onlineUsers);
    } catch (error) {
      console.error('❌ Disconnect error:', error);
    }
  });
});

// ===== START SERVER =====
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📍 http://localhost:${PORT}`);
});