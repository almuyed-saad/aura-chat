import { useEffect, useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { FiLogOut, FiMessageCircle, FiSend, FiMenu, FiX } from 'react-icons/fi'
import ThemeToggle from '../components/ThemeToggle'
import ImageUpload from '../components/ImageUpload'
import ImageModal from '../components/ImageModal'
import MessageReactions from '../components/MessageReactions'
import MessageMenu from '../components/MessageMenu'
import MessageStatus from '../components/MessageStatus'
import { useTheme } from '../context/ThemeContext'
import { useSocket } from '../context/SocketContext'
import axios from 'axios'
import toast from 'react-hot-toast'
import { useNotifications } from '../hooks/useNotifications'
import NotificationBanner from '../components/NotificationBanner'
import ProfileModal from '../components/ProfileModal'
import Avatar from '../components/Avatar'

// ✅ Use environment variable for production, fallback to localhost for development
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000'

// Helper: Normalize reactions to a plain object { userId: emoji }.
const normalizeReactions = (reactions) => {
  if (!reactions) return {}
  if (reactions instanceof Map) return Object.fromEntries(reactions)
  if (Array.isArray(reactions)) return Object.fromEntries(reactions)
  return reactions
}

// Helper: Normalize sender to a plain string ID
const normalizeSender = (sender) => {
  if (!sender) return null
  if (typeof sender === 'string') return sender
  if (typeof sender === 'object') return sender._id || sender.id || null
  return sender
}

// Helper: Normalize user object
const normalizeUser = (userData) => {
  if (!userData) return null
  return {
    ...userData,
    _id: userData._id || userData.id
  }
}

const ChatPage = () => {
  const navigate = useNavigate()
  const [user, setUser] = useState(null)
  const [users, setUsers] = useState([])
  const [selectedUser, setSelectedUser] = useState(null)
  const [messages, setMessages] = useState([])
  const [newMessage, setNewMessage] = useState('')
  const [loading, setLoading] = useState(true)
  const [uploadedImage, setUploadedImage] = useState(null)
  const [selectedImage, setSelectedImage] = useState(null)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [replyToMessage, setReplyToMessage] = useState(null)
  const { theme } = useTheme()
  const { socket, onlineUsers, typingUsers, isConnected, unreadCounts, clearUnreadCount } = useSocket()
  const messagesEndRef = useRef(null)
  const typingTimeoutRef = useRef(null)
  const { enableNotifications } = useNotifications()
  const [showProfile, setShowProfile] = useState(false)

  const token = localStorage.getItem('token')

  // Auto-scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Check auth
  useEffect(() => {
    if (!token) {
      navigate('/login')
      return
    }
    const userData = JSON.parse(localStorage.getItem('user') || '{}')
    setUser(normalizeUser(userData))
  }, [navigate])

  // Fetch all users & restore selected conversation
  useEffect(() => {
    const fetchUsers = async () => {
      if (!token) return
      setLoading(true)
      try {
        const response = await axios.get(`${API_URL}/api/users`, {
          headers: { Authorization: `Bearer ${token}` }
        })
        setUsers(response.data)

        // ✅ Restore previously selected conversation after refresh
        const savedUserId = localStorage.getItem('selectedUserId')
        if (savedUserId) {
          const restoredUser = response.data.find(u => u._id === savedUserId)
          if (restoredUser) {
            setSelectedUser(restoredUser)
          }
        }
      } catch (error) {
        console.error('Error fetching users:', error)
        toast.error('Failed to load users')
      } finally {
        setLoading(false)
      }
    }
    fetchUsers()
  }, [token])

  // Fetch messages when a user is selected
  useEffect(() => {
    if (!selectedUser || !token) return

    const fetchMessages = async () => {
      try {
        const response = await axios.get(`${API_URL}/api/messages/${selectedUser._id}`, {
          headers: { Authorization: `Bearer ${token}` }
        })
        const normalized = response.data.map(msg => ({
          ...msg,
          sender: normalizeSender(msg.sender),
          reactions: normalizeReactions(msg.reactions),
          deleted: msg.deleted || false,
          deletedBy: msg.deletedBy || null,
          replyTo: msg.replyTo || null,
          replyToText: msg.replyToText || '',
          replyToSender: msg.replyToSender || null,
          status: msg.status || 'sent',
          read: msg.read || false,
          readAt: msg.readAt || null,
          deliveredAt: msg.deliveredAt || null
        }))
        setMessages(normalized)
      } catch (error) {
        console.error('Error fetching messages:', error)
        toast.error('Failed to load messages')
      }
    }
    fetchMessages()
  }, [selectedUser, token])

  // Listen for incoming messages
  useEffect(() => {
    if (!socket) return

    const handleReceiveMessage = (message) => {
      const normalized = {
        ...message,
        sender: normalizeSender(message.sender),
        reactions: normalizeReactions(message.reactions),
        deleted: message.deleted || false,
        deletedBy: message.deletedBy || null,
        replyTo: message.replyTo || null,
        replyToText: message.replyToText || '',
        replyToSender: message.replyToSender || null,
        status: message.status || 'sent',
        read: message.read || false,
        readAt: message.readAt || null,
        deliveredAt: message.deliveredAt || null
      }

      if (selectedUser) {
        if (normalized.sender === selectedUser._id) {
          setMessages(prev => [...prev, normalized])
        } else if (normalized.sender === user?._id && normalized.receiver === selectedUser._id) {
          setMessages(prev => {
            const exists = prev.some(m => m._id === normalized._id)
            if (!exists) return [...prev, normalized]
            return prev
          })
        }
      }
    }

    const handleReactionUpdated = (updatedMessage) => {
      setMessages(prev => prev.map(msg =>
        msg._id === updatedMessage._id ? {
          ...updatedMessage,
          sender: normalizeSender(updatedMessage.sender),
          reactions: normalizeReactions(updatedMessage.reactions),
          deleted: updatedMessage.deleted || false,
          deletedBy: updatedMessage.deletedBy || null,
          replyTo: updatedMessage.replyTo || null,
          replyToText: updatedMessage.replyToText || '',
          replyToSender: updatedMessage.replyToSender || null,
          status: updatedMessage.status || 'sent',
          read: updatedMessage.read || false,
          readAt: updatedMessage.readAt || null,
          deliveredAt: updatedMessage.deliveredAt || null
        } : msg
      ))
    }

    const handleMessageDeleted = (updatedMessage) => {
      setMessages(prev => prev.map(msg =>
        msg._id === updatedMessage._id ? {
          ...updatedMessage,
          sender: normalizeSender(updatedMessage.sender),
          reactions: normalizeReactions(updatedMessage.reactions),
          deleted: updatedMessage.deleted || true,
          deletedBy: updatedMessage.deletedBy || null,
          text: '',
          image: '',
          replyTo: updatedMessage.replyTo || null,
          replyToText: updatedMessage.replyToText || '',
          replyToSender: updatedMessage.replyToSender || null,
          status: updatedMessage.status || 'sent',
          read: updatedMessage.read || false,
          readAt: updatedMessage.readAt || null,
          deliveredAt: updatedMessage.deliveredAt || null
        } : msg
      ))
    }

    // Handle messages delivered (sent → delivered)
    const handleMessagesDelivered = ({ messageIds }) => {
      setMessages(prev => prev.map(msg =>
        messageIds.includes(msg._id) && msg.status !== 'read'
          ? { ...msg, status: 'delivered' }
          : msg
      ))
    }

    // Handle messages read (delivered → read)
    const handleMessagesRead = ({ messageIds }) => {
      setMessages(prev => prev.map(msg =>
        messageIds.includes(msg._id)
          ? { ...msg, status: 'read' }
          : msg
      ))
    }

    socket.on('receiveMessage', handleReceiveMessage)
    socket.on('reactionUpdated', handleReactionUpdated)
    socket.on('messageDeleted', handleMessageDeleted)
    socket.on('messagesDelivered', handleMessagesDelivered)
    socket.on('messagesRead', handleMessagesRead)

    return () => {
      socket.off('receiveMessage', handleReceiveMessage)
      socket.off('reactionUpdated', handleReactionUpdated)
      socket.off('messageDeleted', handleMessageDeleted)
      socket.off('messagesDelivered', handleMessagesDelivered)
      socket.off('messagesRead', handleMessagesRead)
    }
  }, [socket, selectedUser, user])

  const handleImageUpload = (imageUrl, imagePublicId) => {
    setUploadedImage({ url: imageUrl, publicId: imagePublicId })
  }

  const clearUploadedImage = () => {
    setUploadedImage(null)
  }

  const handleReaction = (messageId, emoji) => {
    if (!socket) {
      toast.error('Cannot react - no connection')
      return
    }

    setMessages(prev => prev.map(msg => {
      if (msg._id !== messageId) return msg
      const newReactions = { ...msg.reactions }
      if (emoji === null) {
        delete newReactions[user._id]
      } else {
        newReactions[user._id] = emoji
      }
      return { ...msg, reactions: newReactions }
    }))

    socket.emit('addReaction', { messageId, emoji })
  }

  const handleDeleteMessage = (messageId) => {
    if (!socket) {
      toast.error('Cannot delete - no connection')
      return
    }

    // Optimistic update
    setMessages(prev => prev.map(msg =>
      msg._id === messageId
        ? { ...msg, deleted: true, text: '', image: '' }
        : msg
    ))

    socket.emit('deleteMessage', { messageId })
  }

  const handleCopyMessage = (text) => {
    if (!text) {
      toast.error('Nothing to copy')
      return
    }
    navigator.clipboard.writeText(text)
    toast.success('Copied to clipboard!')
  }

  const handleReply = (message) => {
    setReplyToMessage(message)
    setTimeout(() => {
      const input = document.querySelector('input[type="text"]')
      if (input) input.focus()
    }, 100)
  }

  const cancelReply = () => {
    setReplyToMessage(null)
  }

  // ✅ SELECT USER - Persist to localStorage
  const selectUser = (chatUser) => {
    setSelectedUser(chatUser)
    localStorage.setItem('selectedUserId', chatUser._id)  // ✅ Save selection
    
    if (unreadCounts[chatUser._id] > 0) {
      clearUnreadCount(chatUser._id)
      socket?.emit('markAsRead', { senderId: chatUser._id })
      console.log('📤 markAsRead emitted for:', chatUser.name)
    }
    
    if (window.innerWidth < 1024) {
      setSidebarOpen(false)
    }
  }

  const sendMessage = async (e) => {
    e.preventDefault()
    if (!newMessage.trim() && !uploadedImage) return
    if (!selectedUser || !socket) return

    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current)
    }
    socket.emit('typing', { receiverId: selectedUser._id, isTyping: false })

    const messageData = {
      receiverId: selectedUser._id,
      text: newMessage,
      image: uploadedImage?.url || '',
      imagePublicId: uploadedImage?.publicId || '',
      replyTo: replyToMessage?._id || null,
      replyToText: replyToMessage?.text || '',
      replyToSender: replyToMessage?.sender || null
    }

    const tempMessage = {
      _id: Date.now().toString(),
      sender: user._id,
      receiver: selectedUser._id,
      text: newMessage,
      image: uploadedImage?.url || '',
      createdAt: new Date().toISOString(),
      reactions: {},
      deleted: false,
      deletedBy: null,
      replyTo: replyToMessage?._id || null,
      replyToText: replyToMessage?.text || '',
      replyToSender: replyToMessage?.sender || null,
      status: 'sent',
      read: false,
      readAt: null,
      deliveredAt: null
    }
    setMessages(prev => [...prev, tempMessage])

    socket.emit('sendMessage', messageData)
    setNewMessage('')
    setUploadedImage(null)
    setReplyToMessage(null)

    if (window.innerWidth < 1024) {
      setSidebarOpen(false)
    }
  }

  const handleTyping = (e) => {
    setNewMessage(e.target.value)
    if (!selectedUser || !socket) return

    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current)

    socket.emit('typing', { receiverId: selectedUser._id, isTyping: true })

    typingTimeoutRef.current = setTimeout(() => {
      socket.emit('typing', { receiverId: selectedUser._id, isTyping: false })
    }, 1500)
  }

  const isOnline = (userId) => {
    return onlineUsers.some(u => u._id === userId)
  }

  const isUserTyping = typingUsers.includes(selectedUser?._id)
  const isDark = theme.name === 'Dark'

  if (!user) return null

  return (
    <div className={`min-h-screen ${theme.background} transition-colors duration-500 ${isDark ? 'text-white' : ''}`}>
      <NotificationBanner enableNotifications={enableNotifications} theme={theme} isDark={isDark} />
      {/* Navbar */}
      <nav className={`${theme.card} backdrop-blur-xl border-b ${isDark ? 'border-white/20' : theme.border} sticky top-0 z-50 transition-colors duration-500`}>
        <div className="max-w-7xl mx-auto px-3 sm:px-4 lg:px-6">
          <div className="flex justify-between items-center h-14 sm:h-16">
            <div className="flex items-center gap-2 sm:gap-3">
              <button
                onClick={() => setSidebarOpen(!sidebarOpen)}
                className="lg:hidden p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition"
                aria-label="Toggle sidebar"
              >
                {sidebarOpen ? <FiX className="w-5 h-5" /> : <FiMenu className="w-5 h-5" />}
              </button>

              <span className={`text-xl sm:text-2xl font-logo ${isDark ? 'text-white' : 'bg-gradient-to-r from-primary-500 to-purple-600 bg-clip-text text-transparent'}`}>
                ✦ Aura
              </span>
              <span className={`text-[10px] sm:text-xs bg-gradient-to-r ${theme.primary} text-white px-1.5 sm:px-2 py-0.5 rounded-full hidden sm:inline-block`}>
                Premium
              </span>
            </div>

            <div className="flex items-center gap-2 sm:gap-4">
              <ThemeToggle />

              <div className="flex items-center gap-2 sm:gap-3">
                <button onClick={() => setShowProfile(true)} className="flex-shrink-0">
                  <Avatar user={user} size="sm" theme={theme} isDark={isDark} />
                </button>
                <span className={`text-xs sm:text-sm font-medium ${theme.text} hidden xs:inline-block`}>
                  {user?.name || 'User'}
                </span>
                {isConnected && <span className="w-1.5 h-1.5 sm:w-2 sm:h-2 bg-green-500 rounded-full"></span>}
              </div>

              <button
                onClick={() => {
                  localStorage.removeItem('token')
                  localStorage.removeItem('user')
                  localStorage.removeItem('selectedUserId')  // ✅ Clear saved selection on logout
                  navigate('/login')
                }}
                className="flex items-center gap-1 sm:gap-2 px-2 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-xl transition-all"
              >
                <FiLogOut className="w-4 h-4" />
                <span className="hidden sm:inline">Logout</span>
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* Main Content - Full height on mobile */}
      <div className="max-w-7xl mx-auto px-3 sm:px-4 lg:px-6 py-2 sm:py-4 lg:py-6 h-[calc(100dvh-56px)] sm:h-auto">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-3 sm:gap-4 lg:gap-6 h-full lg:h-auto">
          {/* Sidebar - Mobile Overlay */}
          <AnimatePresence>
            {sidebarOpen && (
              <>
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="fixed inset-0 bg-black/50 z-40 lg:hidden"
                  onClick={() => setSidebarOpen(false)}
                />
                <motion.div
                  initial={{ x: -280, opacity: 0 }}
                  animate={{ x: 0, opacity: 1 }}
                  exit={{ x: -280, opacity: 0 }}
                  transition={{ type: 'spring', damping: 25 }}
                  className="fixed left-0 top-0 bottom-0 w-[280px] z-50 lg:hidden"
                >
                  <div className={`h-full ${theme.card} backdrop-blur-xl border-r ${isDark ? 'border-white/20' : theme.border} p-4 overflow-y-auto`}>
                    <div className="flex items-center gap-2 mb-4 pb-3 border-b ${isDark ? 'border-white/20' : theme.border}">
                      <FiMessageCircle className={`${isDark ? 'text-white' : theme.accent}`} />
                      <h2 className={`font-heading font-semibold ${theme.text}`}>Chats</h2>
                      <span className={`ml-auto text-xs bg-gradient-to-r ${theme.primary} text-white px-2 py-0.5 rounded-full`}>
                        {users.length}
                      </span>
                      {!isConnected && <span className="text-xs text-red-500 ml-2">⚡</span>}
                    </div>

                    {loading ? (
                      <div className="text-center text-gray-500 py-4 text-sm">Loading...</div>
                    ) : users.length === 0 ? (
                      <div className="text-center text-gray-500 py-4 text-sm">No users found.</div>
                    ) : (
                      <div className="space-y-1.5">
                        {users.map((chatUser) => {
                          const unreadCount = unreadCounts?.[chatUser._id] || 0
                          const latestMessage = messages.length > 0 ? messages[messages.length - 1] : null
                          const isLatestFromThisUser = latestMessage && 
                            (latestMessage.sender === chatUser._id || latestMessage.receiver === chatUser._id)

                          return (
                            <motion.div
                              key={chatUser._id}
                              whileHover={{ scale: 1.02 }}
                              onClick={() => selectUser(chatUser)}
                              className={`flex items-center gap-3 p-2.5 rounded-xl border ${isDark ? 'border-white/10 hover:border-white/30' : 'border-transparent hover:border-light-border'} ${theme.cardHover} transition-all cursor-pointer group ${selectedUser?._id === chatUser._id ? (isDark ? 'border-white/40 bg-white/10' : 'border-primary-500/30 bg-primary-50/30') : ''}`}
                            >
                              <div className="relative flex-shrink-0">
                                <Avatar user={chatUser} size="md" theme={theme} isDark={isDark} />
                                {isOnline(chatUser._id) && (
                                  <span className="absolute bottom-0 right-0 w-2.5 h-2.5 sm:w-3 sm:h-3 bg-green-500 rounded-full border-2 border-white dark:border-black" />
                                )}
                                {unreadCount > 0 && (
                                  <span className="absolute -top-1 -right-1 min-w-[20px] h-5 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center px-1 border-2 border-white dark:border-dark-surface">
                                    {unreadCount > 9 ? '9+' : unreadCount}
                                  </span>
                                )}
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center justify-between">
                                  <span className={`font-medium ${theme.text} text-xs sm:text-sm truncate ${unreadCount > 0 ? 'font-bold' : ''}`}>
                                    {chatUser.name}
                                  </span>
                                  {isOnline(chatUser._id) && (
                                    <span className="text-[7px] sm:text-[8px] text-green-500 font-semibold">● Online</span>
                                  )}
                                </div>
                                {isLatestFromThisUser && latestMessage && (
                                  <p className={`text-[10px] sm:text-xs truncate ${unreadCount > 0 ? 'text-primary-500 dark:text-primary-400 font-medium' : theme.textSecondary}`}>
                                    {latestMessage.sender === user._id ? 'You: ' : ''}
                                    {latestMessage.deleted ? 'Message deleted' : latestMessage.text || (latestMessage.image ? '📷 Image' : '')}
                                  </p>
                                )}
                              </div>
                            </motion.div>
                          )
                        })}
                      </div>
                    )}
                  </div>
                </motion.div>
              </>
            )}
          </AnimatePresence>

          {/* Desktop Sidebar */}
          <div className={`hidden lg:block lg:col-span-1 ${theme.card} backdrop-blur-sm rounded-2xl shadow-xl ${isDark ? 'border border-white/20 shadow-2xl shadow-white/5' : `border ${theme.border}`} p-4 transition-colors duration-500 max-h-[70vh] overflow-y-auto`}>
            <div className="flex items-center gap-2 mb-4 pb-3 border-b ${isDark ? 'border-white/20' : theme.border}">
              <FiMessageCircle className={`${isDark ? 'text-white' : theme.accent}`} />
              <h2 className={`font-heading font-semibold ${theme.text}`}>Chats</h2>
              <span className={`ml-auto text-xs bg-gradient-to-r ${theme.primary} text-white px-2 py-0.5 rounded-full`}>
                {users.length}
              </span>
              {!isConnected && <span className="text-xs text-red-500 ml-2">⚡ Disconnected</span>}
            </div>

            {loading ? (
              <div className="text-center text-gray-500 py-4 text-sm">Loading users...</div>
            ) : users.length === 0 ? (
              <div className="text-center text-gray-500 py-4 text-sm">No users found.</div>
            ) : (
              <div className="space-y-1.5">
                {users.map((chatUser) => {
                  const unreadCount = unreadCounts?.[chatUser._id] || 0
                  const latestMessage = messages.length > 0 ? messages[messages.length - 1] : null
                  const isLatestFromThisUser = latestMessage && 
                    (latestMessage.sender === chatUser._id || latestMessage.receiver === chatUser._id)

                  return (
                    <motion.div
                      key={chatUser._id}
                      whileHover={{ scale: 1.02 }}
                      onClick={() => selectUser(chatUser)}
                      className={`flex items-center gap-3 p-2.5 rounded-xl border ${isDark ? 'border-white/10 hover:border-white/30' : 'border-transparent hover:border-light-border'} ${theme.cardHover} transition-all cursor-pointer group ${selectedUser?._id === chatUser._id ? (isDark ? 'border-white/40 bg-white/10' : 'border-primary-500/30 bg-primary-50/30') : ''}`}
                    >
                      <div className="relative flex-shrink-0">
                        <Avatar user={chatUser} size="md" theme={theme} isDark={isDark} />
                        {isOnline(chatUser._id) && (
                          <span className="absolute bottom-0 right-0 w-2.5 h-2.5 sm:w-3 sm:h-3 bg-green-500 rounded-full border-2 border-white dark:border-black" />
                        )}
                        {unreadCount > 0 && (
                          <span className="absolute -top-1 -right-1 min-w-[20px] h-5 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center px-1 border-2 border-white dark:border-dark-surface">
                            {unreadCount > 9 ? '9+' : unreadCount}
                          </span>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <span className={`font-medium ${theme.text} text-xs sm:text-sm truncate ${unreadCount > 0 ? 'font-bold' : ''}`}>
                            {chatUser.name}
                          </span>
                          {isOnline(chatUser._id) && (
                            <span className="text-[7px] sm:text-[8px] text-green-500 font-semibold">● Online</span>
                          )}
                        </div>
                        {isLatestFromThisUser && latestMessage && (
                          <p className={`text-[10px] sm:text-xs truncate ${unreadCount > 0 ? 'text-primary-500 dark:text-primary-400 font-medium' : theme.textSecondary}`}>
                            {latestMessage.sender === user._id ? 'You: ' : ''}
                            {latestMessage.deleted ? 'Message deleted' : latestMessage.text || (latestMessage.image ? '📷 Image' : '')}
                          </p>
                        )}
                      </div>
                    </motion.div>
                  )
                })}
              </div>
            )}
          </div>

          {/* Chat Window - Full height on mobile with input at bottom */}
          <div className={`lg:col-span-3 ${theme.card} backdrop-blur-sm rounded-2xl shadow-xl ${isDark ? 'border border-white/20 shadow-2xl shadow-white/5' : `border ${theme.border}`} p-3 sm:p-4 lg:p-6 flex flex-col h-full sm:min-h-[500px] transition-colors duration-500`}>
            {selectedUser ? (
              <>
                {/* Chat Header */}
                <div className={`flex items-center gap-2 sm:gap-3 pb-2 sm:pb-3 border-b ${isDark ? 'border-white/20' : theme.border} mb-2 sm:mb-4`}>
                  <Avatar user={selectedUser} size="md" theme={theme} isDark={isDark} />
                  <div className="flex-1 min-w-0">
                    <h3 className={`font-heading font-semibold ${theme.text} text-sm sm:text-base truncate`}>
                      {selectedUser.name}
                    </h3>
                    <p className={`text-[10px] sm:text-xs ${theme.textSecondary}`}>
                      {isOnline(selectedUser._id) ? '🟢 Online' : '⚪ Offline'}
                    </p>
                  </div>
                </div>

                {/* Messages */}
                <div className="flex-1 overflow-y-auto mb-2 sm:mb-4 space-y-2 sm:space-y-3 min-h-0">
                  {messages.map((msg, index) => {
                    const senderId = normalizeSender(msg.sender)
                    const isMyMessage = String(senderId) === String(user?._id)
                    const isDeleted = msg.deleted === true
                    const hasReply = msg.replyTo || msg.replyToText
                    const replySenderName = msg.replyToSender?.name || 'Someone'

                    return (
                      <div key={index} className={`flex ${isMyMessage ? 'justify-end' : 'justify-start'}`}>
                        <div className={`max-w-[85%] sm:max-w-[70%] px-3 sm:px-4 py-1.5 sm:py-2 rounded-2xl ${
                          isMyMessage
                            ? `bg-gradient-to-r ${theme.button} text-white`
                            : isDark
                              ? 'bg-white/10 border border-white/20 text-white'
                              : 'bg-gray-100 text-gray-800'
                        }`}>
                          {isDeleted ? (
                            <div className="flex items-center gap-2">
                              <span className="text-sm italic opacity-60">
                                {isMyMessage 
                                  ? 'You deleted this message' 
                                  : `${selectedUser?.name || 'Someone'} deleted a message`}
                              </span>
                            </div>
                          ) : (
                            <>
                              {hasReply && (
                                <div className={`mb-1.5 pl-2 border-l-2 ${isMyMessage ? 'border-white/50' : 'border-gray-400 dark:border-gray-500'} text-xs opacity-70`}>
                                  <span className="font-medium">
                                    {replySenderName}:
                                  </span>
                                  <span className="ml-1 italic truncate block max-w-[200px]">
                                    {msg.replyToText || 'Reply to message'}
                                  </span>
                                </div>
                              )}

                              {msg.image && (
                                <img
                                  src={msg.image}
                                  alt="Shared"
                                  className="max-w-full rounded-lg mb-1 sm:mb-2 cursor-pointer hover:opacity-90 transition"
                                  onClick={() => setSelectedImage(msg.image)}
                                />
                              )}
                              {msg.text && <p className="text-sm sm:text-base break-words">{msg.text}</p>}
                              
                              <span className="text-[9px] sm:text-[10px] opacity-70 mt-0.5 sm:mt-1 flex items-center gap-1">
                                {new Date(msg.createdAt).toLocaleTimeString()}
                                {isMyMessage && <MessageStatus status={msg.status || 'sent'} />}
                              </span>

                              {/* Reactions */}
                              <div className="flex items-center gap-0.5 mt-0.5 flex-wrap">
                                <MessageReactions
                                  messageId={msg._id}
                                  reactions={msg.reactions}
                                  currentUserId={user._id}
                                  onReact={handleReaction}
                                  isMyMessage={isMyMessage}
                                />
                                <MessageMenu
                                  messageId={msg._id}
                                  isMyMessage={isMyMessage}
                                  onDelete={handleDeleteMessage}
                                  onCopy={() => handleCopyMessage(msg.text)}
                                  onReply={() => handleReply(msg)}
                                />
                              </div>
                            </>
                          )}
                        </div>
                      </div>
                    )
                  })}
                  <div ref={messagesEndRef} />
                </div>

                {/* Reply Preview */}
                {replyToMessage && (
                  <div className="mt-2 p-2 bg-blue-50 dark:bg-blue-900/20 rounded-lg flex items-center gap-2 border-l-4 border-blue-500">
                    <div className="flex-1 min-w-0">
                      <span className="text-xs font-medium text-blue-600 dark:text-blue-400">
                        Replying to {replyToMessage.sender?.name || 'User'}:
                      </span>
                      <p className="text-xs text-gray-600 dark:text-gray-400 truncate">
                        {replyToMessage.text || 'Image'}
                      </p>
                    </div>
                    <button
                      onClick={cancelReply}
                      className="text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300 p-1"
                    >
                      ✕
                    </button>
                  </div>
                )}

                {/* Message Input */}
                <div className="mt-2 sm:mt-4">
                  {isUserTyping && (
                    <div className="text-[10px] sm:text-xs text-primary-500 dark:text-primary-400 mb-1 sm:mb-2 flex items-center gap-1">
                      <span className="animate-pulse">●</span>
                      <span>{selectedUser.name} is typing...</span>
                    </div>
                  )}

                  <form onSubmit={sendMessage} className={`flex gap-1 sm:gap-2 pt-2 sm:pt-3 border-t ${isDark ? 'border-white/20' : theme.border}`}>
                    <div className="flex-1 flex items-center gap-1 sm:gap-2">
                      <input
                        type="text"
                        value={newMessage}
                        onChange={handleTyping}
                        placeholder={replyToMessage ? "Write a reply..." : uploadedImage ? "Add caption..." : "Type a message..."}
                        className={`flex-1 px-3 sm:px-4 py-2.5 sm:py-3 rounded-xl text-sm sm:text-base border ${isDark ? 'border-white/20' : theme.border} ${isDark ? 'bg-[#1a1a1a]' : 'bg-light-surface'} ${theme.text} focus:outline-none focus:ring-2 focus:ring-primary-500 transition-all font-input placeholder:${theme.textSecondary} min-h-[44px]`}
                      />
                      <ImageUpload
                        onImageUpload={handleImageUpload}
                        disabled={!selectedUser}
                      />
                    </div>
                    <button
                      type="submit"
                      disabled={!newMessage.trim() && !uploadedImage}
                      className={`px-4 sm:px-6 py-2.5 sm:py-3 bg-gradient-to-r ${theme.button} text-white rounded-xl font-btn font-semibold ${theme.shadow} hover:shadow-xl transition-all hover:scale-[1.02] disabled:opacity-50 disabled:cursor-not-allowed min-h-[44px] min-w-[44px] flex items-center justify-center`}
                    >
                      <FiSend className="w-4 h-4 sm:w-5 sm:h-5" />
                    </button>
                  </form>

                  {uploadedImage && (
                    <div className="mt-2 p-2 bg-light-card dark:bg-dark-card rounded-lg flex items-center gap-2 sm:gap-3">
                      <img src={uploadedImage.url} alt="Preview" className="w-10 h-10 sm:w-12 sm:h-12 object-cover rounded" />
                      <span className="text-xs sm:text-sm text-light-text-secondary dark:text-dark-text-secondary flex-1">
                        Image ready to send
                      </span>
                      <button
                        type="button"
                        onClick={clearUploadedImage}
                        className="text-red-500 hover:text-red-600 p-1"
                      >
                        ✕
                      </button>
                    </div>
                  )}
                </div>
              </>
            ) : (
              <div className="flex-1 flex items-center justify-center flex-col text-center p-4">
                <div className={`w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-gradient-to-r ${theme.primary} opacity-20 flex items-center justify-center text-3xl sm:text-4xl mb-3 sm:mb-4 border ${isDark ? 'border-white/20' : 'border-primary-500/20'}`}>
                  💬
                </div>
                <h3 className={`font-heading text-base sm:text-xl font-semibold ${theme.text}`}>
                  Select a conversation
                </h3>
                <p className={`${theme.textSecondary} text-xs sm:text-sm max-w-xs mt-1 sm:mt-2`}>
                  Choose a user from the sidebar to start chatting
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Image Modal */}
      {selectedImage && (
        <ImageModal
          imageUrl={selectedImage}
          onClose={() => setSelectedImage(null)}
        />
      )}
      {showProfile && (
        <ProfileModal
          user={user}
          onClose={() => setShowProfile(false)}
          onSaved={(updatedUser) => setUser(updatedUser)}
          theme={theme}
          isDark={isDark}
        />
      )}
    </div>
  )
}

export default ChatPage