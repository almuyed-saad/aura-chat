// ===== DNS FIX FOR MONGODB ATLAS =====
const dns = require('dns');
dns.setServers(['8.8.8.8', '8.8.4.4']);
// =====================================

const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const http = require('http');
const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
require('dotenv').config();

const { sendPushToUser } = require('./services/pushSender');
const User = require('./models/User');

// ===== INITIALIZE APP =====
const app = express();
const server = http.createServer(app);

// ===== SOCKET.IO SETUP =====
const io = new Server(server, {
  cors: {
    origin: ["http://localhost:5173", "https://aura-chat-topaz.vercel.app"],
    methods: ["GET", "POST"],
    credentials: true
  }
});

// ===== MIDDLEWARE =====
const allowedOrigins = [
  'http://localhost:5173',
  'https://aura-chat-topaz.vercel.app'
];

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
app.use(express.json());

// ===== TEST ROUTE =====
app.get('/', (req, res) => {
  res.send('🚀 Chat API is running!');
});

// ===== API ROUTES =====
app.use('/api/auth', require('./routes/auth'));
app.use('/api/users', require('./routes/users'));
app.use('/api/messages', require('./routes/messages'));
app.use('/api/upload', require('./routes/upload'));
app.use('/api/push', require('./routes/push'));

// ===== MONGODB CONNECTION =====
const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI, {
      dbName: 'chat-app',
      serverSelectionTimeoutMS: 30000,
      socketTimeoutMS: 45000,
      connectTimeoutMS: 30000,
    });
    console.log('✅ Connected to MongoDB');
    await User.updateMany({}, { online: false });
    console.log('🧹 Reset all users to offline on server start');
  } catch (err) {
    console.error('❌ MongoDB connection error:', err.message);
    console.log('🔄 Retrying in 5 seconds...');
    setTimeout(connectDB, 5000);
  }
};

connectDB();

// ===== MODELS =====
// ===== MODELS =====
const Message = require('./models/Message');

// ===== SOCKET STORE =====
const userSocketMap = new Map();

// ===== SOCKET.IO AUTHENTICATION MIDDLEWARE =====
io.use((socket, next) => {
  const token = socket.handshake.auth.token;
  console.log('🔑 Auth token received:', token ? 'Yes' : 'No');
  
  if (!token) {
    console.log('❌ No token provided');
    return next(new Error('Authentication error: No token'));
  }
  
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    socket.userId = decoded.id;
    console.log('✅ Authenticated user:', socket.userId);
    next();
  } catch (err) {
    console.error('❌ Invalid token:', err.message);
    next(new Error('Invalid token'));
  }
});

// ===== SOCKET.IO CONNECTION HANDLER =====
io.on('connection', (socket) => {
  console.log('🟢 User connected:', socket.userId);

  // ✅ Store socket reference
  userSocketMap.set(socket.userId, socket.id);
  console.log('📌 Socket stored for user:', socket.userId, 'Socket ID:', socket.id);

  // ✅ Auto-join room immediately
  socket.join(socket.userId);
  console.log('📌 Auto-joined room:', socket.userId);

  // ===== JOIN ROOM (for reconnects) =====
  socket.on('joinRoom', (userId) => {
    socket.join(userId);
    userSocketMap.set(userId, socket.id);
    console.log('📌 User joined room:', userId);
  });

  // ===== SEND MESSAGE =====
  socket.on('sendMessage', async (data) => {
    console.log('📨 Message from:', socket.userId, 'to:', data.receiverId);
    
    try {
      const { 
        receiverId, 
        text, 
        image, 
        imagePublicId, 
        video, 
        videoPublicId,
        replyTo,
        replyToText,
        replyToSender
      } = data;
      
      // ✅ Check if receiver is online
      const receiverOnline = userSocketMap.has(receiverId);
      
      const message = new Message({
        sender: socket.userId,
        receiver: receiverId,
        text: text || '',
        image: image || '',
        imagePublicId: imagePublicId || '',
        video: video || '',
        videoPublicId: videoPublicId || '',
        replyTo: replyTo || null,
        replyToText: replyToText || '',
        replyToSender: replyToSender || null,
        status: receiverOnline ? 'delivered' : 'sent',
        deliveredAt: receiverOnline ? new Date() : null,
        read: false
      });
      
      await message.save();
      console.log('✅ Message saved! ID:', message._id, 'Status:', message.status);

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

      // ✅ Send to receiver
      io.to(receiverId).emit('receiveMessage', messageToSend);
      io.to(socket.id).emit('receiveMessage', messageToSend);
      
      // ✅ Send push notification if receiver is offline
      if (!userSocketMap.has(receiverId)) {
        const senderUser = await User.findById(socket.userId).select('name');
        sendPushToUser(receiverId, {
          title: senderUser?.name || 'New message',
          body: text ? text.slice(0, 100) : (image ? '📷 Sent an image' : 'Sent a message'),
          senderId: socket.userId,
          url: '/'
        }).catch(err => console.error('❌ Push trigger failed:', err));
      }
      
      console.log('📤 Message emitted to receiver:', receiverId);

      // ✅ Count unread messages from THIS sender only
      const unreadCount = await Message.countDocuments({
        receiver: receiverId,
        sender: socket.userId,
        read: false
      });
      
      io.to(receiverId).emit('unreadCount', { 
        senderId: socket.userId, 
        count: unreadCount 
      });
      console.log('🔴 Unread count emitted:', unreadCount);

    } catch (error) {
      console.error('❌ Message error:', error);
      socket.emit('messageError', { error: 'Failed to send message' });
    }
  });

  // ===== TYPING INDICATOR =====
  socket.on('typing', (data) => {
    console.log('⌨️ Typing from:', socket.userId, 'isTyping:', data.isTyping);
    socket.broadcast.emit('typing', { 
      userId: socket.userId, 
      isTyping: data.isTyping 
    });
  });

  // ===== STOP TYPING =====
  socket.on('stopTyping', (data) => {
    socket.broadcast.emit('typing', {
      userId: socket.userId,
      isTyping: false
    });
  });

  // ===== REACTION =====
  socket.on('addReaction', async (data) => {
    console.log('👍 Reaction from:', socket.userId, 'on message:', data.messageId);
    
    try {
      const { messageId, emoji } = data;
      
      const message = await Message.findById(messageId);
      if (!message) {
        console.log('❌ Message not found');
        return;
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
      const senderSocketId = userSocketMap.get(senderId);
      const receiverSocketId = userSocketMap.get(receiverId);
      
      if (senderSocketId) {
        io.to(senderSocketId).emit('reactionUpdated', messageToSend);
        console.log('✅ Emitted to sender via socket ID');
      }
      
      if (receiverSocketId) {
        io.to(receiverSocketId).emit('reactionUpdated', messageToSend);
        console.log('✅ Emitted to receiver via socket ID');
      }
      
      io.to(senderId).emit('reactionUpdated', messageToSend);
      io.to(receiverId).emit('reactionUpdated', messageToSend);
      
    } catch (error) {
      console.error('❌ Reaction error:', error);
    }
  });

  // ===== DELETE MESSAGE =====
  socket.on('deleteMessage', async (data) => {
    console.log('🗑️ Delete message request from:', socket.userId, 'message:', data.messageId);
    
    try {
      const { messageId } = data;
      
      const message = await Message.findById(messageId);
      if (!message) {
        console.log('❌ Message not found');
        return;
      }

      if (message.sender.toString() !== socket.userId) {
        console.log('❌ User not authorized to delete this message');
        return;
      }

      message.deleted = true;
      message.deletedBy = socket.userId;
      message.deletedAt = new Date();
      message.text = '';
      message.image = '';
      await message.save();
      
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
  socket.on('markAsRead', async ({ senderId }) => {
    try {
      console.log('📖 markAsRead from:', socket.userId, 'for sender:', senderId);
      
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
    
    userSocketMap.delete(socket.userId);
    console.log('🗑️ Removed socket from map');
    
    try {
      await User.findByIdAndUpdate(socket.userId, { 
        online: false, 
        lastSeen: Date.now() 
      });
      
      const onlineUsers = await User.find({ online: true }).select('_id name');
      
      // ✅ FIX: Broadcast to ALL users (not just the one who disconnected)
      io.emit('getOnlineUsers', onlineUsers);
      console.log('📡 Updated online users after disconnect');
      
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