import { useEffect, useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { FiLogOut, FiMessageCircle, FiSend, FiMenu, FiX, FiStar, FiVolumeX, FiArchive, FiBell } from 'react-icons/fi'
import ThemeToggle from '../components/ThemeToggle'
import MediaUpload from '../components/MediaUpload'
import VoiceRecorder from '../components/VoiceRecorder'
import ImageModal from '../components/ImageModal'
import MessageReactions from '../components/MessageReactions'
import MessageMenu from '../components/MessageMenu'
import MessageStatus from '../components/MessageStatus'
import { useTheme } from '../context/ThemeContext'
import { useSocket } from '../context/SocketContext'
import apiClient from '../api/client'
import toast from 'react-hot-toast'
import { useNotifications } from '../hooks/useNotifications'
import NotificationBanner from '../components/NotificationBanner'
import ProfileModal from '../components/ProfileModal'
import GroupCreateModal from '../components/GroupCreateModal'
import NotificationCenter from '../components/NotificationCenter'
import SafetyActions from '../components/SafetyActions'
import GroupSettingsModal from '../components/GroupSettingsModal'
import ThreadPanel from '../components/ThreadPanel'
import AIAssist from '../components/AIAssist'
import Avatar from '../components/Avatar'

const formatFileSize = (bytes = 0) => {
  if (!bytes) return ''
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

const formatDuration = (seconds = 0) => {
  if (!seconds) return ''
  const minutes = Math.floor(seconds / 60)
  const remaining = Math.round(seconds % 60).toString().padStart(2, '0')
  return `${minutes}:${remaining}`
}

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

const extractMentionIds = (text, group) => {
  if (!group || !Array.isArray(group.members)) return []
  const lowerText = text.toLowerCase()
  return group.members
    .filter(member => member.user && lowerText.includes(`@${member.user.name.toLowerCase().replace(/\s+/g, '')}`))
    .map(member => member.user._id)
}

const ChatPage = () => {
  const navigate = useNavigate()
  const [user, setUser] = useState(null)
  const [users, setUsers] = useState([])
  const [groups, setGroups] = useState([])
  const [showGroupCreator, setShowGroupCreator] = useState(false)
  const [showNotifications, setShowNotifications] = useState(false)
  const [showGroupSettings, setShowGroupSettings] = useState(false)
  const [threadRoot, setThreadRoot] = useState(null)
  const [notificationUnreadCount, setNotificationUnreadCount] = useState(0)
  const [conversationSummaries, setConversationSummaries] = useState([])
  const [conversationSearch, setConversationSearch] = useState('')
  const [conversationFilter, setConversationFilter] = useState('active')
  const [selectedUser, setSelectedUser] = useState(null)
  const [selectedGroup, setSelectedGroup] = useState(null)
  const [messages, setMessages] = useState([])
  const [newMessage, setNewMessage] = useState('')
  const [loading, setLoading] = useState(true)
  const [uploadedAttachment, setUploadedAttachment] = useState(null)
  const [selectedImage, setSelectedImage] = useState(null)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [replyToMessage, setReplyToMessage] = useState(null)
  const [editingMessageId, setEditingMessageId] = useState(null)
  // ✅ Scroll button states
  const [showScrollButton, setShowScrollButton] = useState(false)
  const [unreadCount, setUnreadCount] = useState(0)
  const scrollContainerRef = useRef(null)
  const { theme } = useTheme()
  const { socket, onlineUsers, typingUsers, isConnected, unreadCounts, clearUnreadCount } = useSocket()
  const messagesEndRef = useRef(null)
  const typingTimeoutRef = useRef(null)
  const previousMessageCountRef = useRef(0)
  const { enableNotifications } = useNotifications()
  const [showProfile, setShowProfile] = useState(false)

  const token = localStorage.getItem('token')

  const fetchConversationSummaries = async () => {
    if (!token) return
    try {
      const response = await apiClient.get('/api/conversations')
      setConversationSummaries(Array.isArray(response.data) ? response.data : [])
    } catch (error) {
      console.error('Error fetching conversation summaries:', error)
    }
  }

  const fetchGroups = async () => {
    if (!token) return
    try {
      const response = await apiClient.get('/api/groups')
      setGroups(Array.isArray(response.data) ? response.data : [])
    } catch (error) {
      console.error('Error fetching groups:', error)
    }
  }

  const updateConversationPreference = async (userId, preference, enabled) => {
    try {
      await apiClient.put(`/api/conversations/${userId}/preferences`, { preference, enabled })
      await fetchConversationSummaries()
    } catch (error) {
      toast.error(error.response?.data?.error || 'Could not update conversation')
    }
  }

  const getConversationSummary = (userId) => conversationSummaries.find(
    summary => String(summary.user?._id) === String(userId)
  )

  const filteredUsers = users
    .filter(chatUser => {
      const summary = getConversationSummary(chatUser._id)
      const normalizedSearch = conversationSearch.trim().toLowerCase()
      const matchesSearch = !normalizedSearch || chatUser.name.toLowerCase().includes(normalizedSearch) || chatUser.email.toLowerCase().includes(normalizedSearch)
      const matchesFilter = conversationFilter === 'all'
        || (conversationFilter === 'archived' && summary?.isArchived)
        || (conversationFilter === 'active' && !summary?.isArchived)
      return matchesSearch && matchesFilter
    })
    .sort((a, b) => {
      const aSummary = getConversationSummary(a._id)
      const bSummary = getConversationSummary(b._id)
      return Number(Boolean(bSummary?.isPinned)) - Number(Boolean(aSummary?.isPinned))
    })

  const filteredGroups = groups.filter(group => {
    const normalizedSearch = conversationSearch.trim().toLowerCase()
    const matchesSearch = !normalizedSearch || group.name.toLowerCase().includes(normalizedSearch)
    return matchesSearch && conversationFilter !== 'archived'
  })

  useEffect(() => {
    fetchConversationSummaries()
    fetchGroups()
  }, [token])

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // ✅ Scroll listener for showing/hiding buttons
  useEffect(() => {
    const container = scrollContainerRef.current
    if (!container) return

    const handleScroll = () => {
      const { scrollTop, scrollHeight, clientHeight } = container
      const isNearBottom = scrollHeight - scrollTop - clientHeight < 100
      setShowScrollButton(!isNearBottom)
    }

    container.addEventListener('scroll', handleScroll)
    return () => container.removeEventListener('scroll', handleScroll)
  }, [selectedUser])

  // ✅ Track unread messages when scrolled up
  useEffect(() => {
    const previousMessageCount = previousMessageCountRef.current
    previousMessageCountRef.current = messages.length
    if (!messages.length || messages.length <= previousMessageCount) return

    const container = scrollContainerRef.current
    if (!container) return

    const { scrollTop, scrollHeight, clientHeight } = container
    const isNearBottom = scrollHeight - scrollTop - clientHeight < 200

    if (isNearBottom) {
      // Auto-scroll to bottom if already near bottom
      scrollToBottom()
      setUnreadCount(0)
    } else {
      // Increment unread count if new message arrives while scrolled up
      setUnreadCount(prev => prev + 1)
    }
  }, [messages])

  // ✅ Handle browser back button
  useEffect(() => {
    const handlePopState = () => {
      if (selectedUser) {
        setSelectedUser(null)
      }
    }
    window.addEventListener('popstate', handlePopState)
    return () => window.removeEventListener('popstate', handlePopState)
  }, [selectedUser])

  // ✅ Check auth with token expiry
  useEffect(() => {
    if (!token) {
      navigate('/login')
      return
    }

    // ✅ Check if token is expired
    try {
      const payload = JSON.parse(atob(token.split('.')[1]))
      const expiryTime = payload.exp * 1000
      
      if (expiryTime < Date.now()) {
        console.log('⏰ Token expired, logging out...')
        localStorage.removeItem('token')
        localStorage.removeItem('user')
        localStorage.removeItem('selectedUserId')
        toast.error('Session expired. Please login again.')
        navigate('/login')
        return
      }

      // ✅ Auto-refresh token 5 minutes before expiry
      const timeUntilExpiry = expiryTime - Date.now()
      const refreshThreshold = 5 * 60 * 1000 // 5 minutes

      if (timeUntilExpiry > 0 && timeUntilExpiry < refreshThreshold) {
        console.log('🔄 Token expiring soon...')
        toast.warning('Your session will expire soon.')
      }
    } catch (error) {
      console.error('❌ Token decode error:', error)
      localStorage.removeItem('token')
      localStorage.removeItem('user')
      navigate('/login')
      return
    }

    const userData = JSON.parse(localStorage.getItem('user') || '{}')
    setUser(normalizeUser(userData))
  }, [navigate, token])

  // ✅ Fetch all users & restore selected conversation
  useEffect(() => {
    const fetchUsers = async () => {
      if (!token) return
      setLoading(true)
      try {
        const response = await apiClient.get('/api/users')
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
        if (error.response?.status === 401) {
          toast.error('Session expired. Please login again.')
          localStorage.removeItem('token')
          localStorage.removeItem('user')
          navigate('/login')
        } else {
          toast.error('Failed to load users')
        }
      } finally {
        setLoading(false)
      }
    }
    fetchUsers()
  }, [token, navigate])

  useEffect(() => {
    const savedGroupId = localStorage.getItem('selectedGroupId')
    if (!selectedUser && savedGroupId) {
      const restoredGroup = groups.find(group => String(group._id) === String(savedGroupId))
      if (restoredGroup) setSelectedGroup(restoredGroup)
    }
  }, [groups, selectedUser])

  useEffect(() => {
    if (socket) groups.forEach(group => socket.emit('joinGroup', { groupId: group._id }))
  }, [socket, groups])

  // Fetch messages for the selected direct or group conversation
  useEffect(() => {
    if ((!selectedUser && !selectedGroup) || !token) return

    const fetchMessages = async () => {
      try {
        const response = await apiClient.get(selectedGroup
          ? `/api/groups/${selectedGroup._id}/messages`
          : `/api/messages/${selectedUser._id}`
        )
        const normalized = response.data.map(msg => ({
          ...msg,
          sender: normalizeSender(msg.sender),
          receiver: normalizeSender(msg.receiver),
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
  }, [selectedUser, selectedGroup, token])

  // Listen for incoming messages
  useEffect(() => {
    if (!socket) return

    const handleReceiveMessage = (message) => {
      const normalized = {
        ...message,
        sender: normalizeSender(message.sender),
        receiver: normalizeSender(message.receiver),
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

      fetchConversationSummaries()
      const messageGroupId = normalized.group?._id || normalized.group
      if (messageGroupId) {
        setGroups(previous => previous.map(group => String(group._id) === String(messageGroupId)
          ? { ...group, lastMessageText: normalized.text || (normalized.attachment?.resourceType === 'audio' ? 'Voice note' : normalized.attachment?.resourceType === 'raw' ? 'Document' : 'Attachment'), lastMessageAt: normalized.createdAt }
          : group
        ))
      }
      if (selectedGroup && String(messageGroupId) === String(selectedGroup._id)) {
        setMessages(prev => prev.some(item => item._id === normalized._id) ? prev : [...prev, normalized])
      } else if (selectedUser) {
        if (normalized.sender === selectedUser._id && normalized.receiver === user?._id) {
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

    const handleMessageAcknowledged = ({ clientMessageId, message } = {}) => {
      if (!message) return
      const normalized = {
        ...message,
        clientMessageId: message.clientMessageId || clientMessageId,
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

      fetchConversationSummaries()
      setMessages(prev => {
        const index = prev.findIndex(item => item.clientMessageId === clientMessageId || item._id === clientMessageId)
        if (index === -1) return [...prev, normalized]
        const next = [...prev]
        next[index] = normalized
        return next
      })
    }

    const handleMessageError = ({ clientMessageId, error } = {}) => {
      if (clientMessageId) {
        setMessages(prev => prev.map(item => item.clientMessageId === clientMessageId
          ? { ...item, failed: true, status: 'failed' }
          : item
        ))
      }
      toast.error(error || 'Failed to send message')
    }

    const handleNotificationCreated = () => {
      setNotificationUnreadCount(previous => previous + 1)
    }

    const handleMessageStarUpdated = (updatedMessage) => {
      setMessages(previous => previous.map(message => message._id === updatedMessage._id
        ? { ...message, ...updatedMessage, isStarred: Boolean(updatedMessage.isStarred || updatedMessage.starredBy?.includes(user?._id)) }
        : message
      ))
    }

    const handleMessageUpdated = (updatedMessage) => {
      fetchConversationSummaries()
      setMessages(prev => prev.map(msg => msg._id === updatedMessage._id
        ? {
            ...updatedMessage,
            sender: normalizeSender(updatedMessage.sender),
            receiver: normalizeSender(updatedMessage.receiver),
            reactions: normalizeReactions(updatedMessage.reactions),
            deleted: updatedMessage.deleted || false,
            edited: updatedMessage.edited || false,
            editedAt: updatedMessage.editedAt || null
          }
        : msg
      ))
    }

    const handleReactionUpdated = (updatedMessage) => {
      setMessages(prev => prev.map(msg =>
        msg._id === updatedMessage._id ? {
          ...updatedMessage,
          sender: normalizeSender(updatedMessage.sender),
          receiver: normalizeSender(updatedMessage.receiver),
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
      fetchConversationSummaries()
      setMessages(prev => prev.map(msg =>
        msg._id === updatedMessage._id ? {
          ...updatedMessage,
          sender: normalizeSender(updatedMessage.sender),
          receiver: normalizeSender(updatedMessage.receiver),
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
    socket.on('messageAcknowledged', handleMessageAcknowledged)
    socket.on('messageError', handleMessageError)
    socket.on('messageUpdated', handleMessageUpdated)
    socket.on('messageStarUpdated', handleMessageStarUpdated)
    socket.on('notificationCreated', handleNotificationCreated)
    socket.on('reactionUpdated', handleReactionUpdated)
    socket.on('messageDeleted', handleMessageDeleted)
    socket.on('messagesDelivered', handleMessagesDelivered)
    socket.on('messagesRead', handleMessagesRead)

    return () => {
      socket.off('receiveMessage', handleReceiveMessage)
      socket.off('messageAcknowledged', handleMessageAcknowledged)
      socket.off('messageError', handleMessageError)
      socket.off('messageUpdated', handleMessageUpdated)
      socket.off('messageStarUpdated', handleMessageStarUpdated)
      socket.off('notificationCreated', handleNotificationCreated)
      socket.off('reactionUpdated', handleReactionUpdated)
      socket.off('messageDeleted', handleMessageDeleted)
      socket.off('messagesDelivered', handleMessagesDelivered)
      socket.off('messagesRead', handleMessagesRead)
    }
  }, [socket, selectedUser, user])

  const handleMediaUpload = (attachment) => {
    setUploadedAttachment(attachment)
  }

  const clearUploadedAttachment = () => {
    setUploadedAttachment(null)
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

  const openThread = (message) => setThreadRoot(message)

  const starMessage = (message) => {
    if (!socket || !message?._id) return
    socket.emit('starMessage', { messageId: message._id, starred: !message.isStarred })
  }

  const editMessage = (message) => {
    if (!socket || !message?.text || message.deleted) return
    const editedText = window.prompt('Edit message', message.text)
    if (!editedText || editedText.trim() === message.text.trim()) return
    setEditingMessageId(message._id)
    socket.emit('editMessage', { messageId: message._id, text: editedText })
    setTimeout(() => setEditingMessageId(null), 1000)
  }

  const retryMessage = (message) => {
    if (!socket || !message?.messagePayload) return
    setMessages(prev => prev.map(item => item._id === message._id
      ? { ...item, failed: false, status: 'sent' }
      : item
    ))
    socket.emit('sendMessage', message.messagePayload)
  }

  // ✅ Scroll functions
  const scrollToBottom = () => {
    setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
      setUnreadCount(0)
      setShowScrollButton(false)
    }, 100)
  }

  const scrollToTop = () => {
    scrollContainerRef.current?.scrollTo({ top: 0, behavior: 'smooth' })
  }

  // ✅ SELECT USER - Persist to localStorage
  const selectUser = (chatUser) => {
    setSelectedGroup(null)
    setSelectedUser(chatUser)
    window.history.pushState({ chatOpen: true }, '')
    localStorage.setItem('selectedUserId', chatUser._id)
    
    const knownUnreadCount = unreadCounts?.[chatUser._id] ?? getConversationSummary(chatUser._id)?.unreadCount ?? 0
    if (knownUnreadCount > 0 || socket) {
      clearUnreadCount(chatUser._id)
      socket?.emit('markAsRead', { senderId: chatUser._id })
    }
    
    if (window.innerWidth < 1024) {
      setSidebarOpen(false)
    }
  }

  const selectGroup = (group) => {
    setSelectedUser(null)
    setSelectedGroup(group)
    window.history.pushState({ chatOpen: true }, '')
    localStorage.setItem('selectedGroupId', group._id)
    localStorage.removeItem('selectedUserId')
    socket?.emit('joinGroup', { groupId: group._id })
    if (window.innerWidth < 1024) setSidebarOpen(false)
  }

  const sendMessage = async (e) => {
    e.preventDefault()
    if (!newMessage.trim() && !uploadedAttachment) return
    if ((!selectedUser && !selectedGroup) || !socket) return

    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current)
    }
    if (selectedUser || selectedGroup) socket.emit('typing', { receiverId: selectedUser?._id || null, groupId: selectedGroup?._id || null, isTyping: false })

    const clientMessageId = typeof crypto?.randomUUID === 'function'
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`

    const messageData = {
      clientMessageId,
      receiverId: selectedUser?._id || null,
      groupId: selectedGroup?._id || null,
      text: newMessage,
      image: uploadedAttachment?.resourceType === 'image' ? uploadedAttachment.url : '',
      imagePublicId: uploadedAttachment?.resourceType === 'image' ? uploadedAttachment.publicId : '',
      video: uploadedAttachment?.resourceType === 'video' ? uploadedAttachment.url : '',
      videoPublicId: uploadedAttachment?.resourceType === 'video' ? uploadedAttachment.publicId : '',
      attachment: uploadedAttachment || null,
      replyTo: replyToMessage?._id || null,
      replyToText: replyToMessage?.text || '',
      replyToSender: replyToMessage?.sender || null,
      threadRoot: selectedGroup ? (replyToMessage?.threadRoot || replyToMessage?._id || null) : null,
      mentions: extractMentionIds(newMessage, selectedGroup)
    }

    const tempMessage = {
      _id: clientMessageId,
      clientMessageId,
      sender: user._id,
      receiver: selectedUser?._id || null,
      group: selectedGroup?._id || null,
      text: newMessage,
      image: uploadedAttachment?.resourceType === 'image' ? uploadedAttachment.url : '',
      video: uploadedAttachment?.resourceType === 'video' ? uploadedAttachment.url : '',
      attachment: uploadedAttachment || null,
      createdAt: new Date().toISOString(),
      reactions: {},
      deleted: false,
      deletedBy: null,
      replyTo: replyToMessage?._id || null,
      replyToText: replyToMessage?.text || '',
      replyToSender: replyToMessage?.sender || null,
      threadRoot: messageData.threadRoot || null,
      mentions: messageData.mentions || [],
      status: 'sent',
      failed: false,
      messagePayload: messageData,
      read: false,
      readAt: null,
      deliveredAt: null
    }
    setMessages(prev => [...prev, tempMessage])

    socket.emit('sendMessage', messageData)
    setNewMessage('')
    setUploadedAttachment(null)
    setReplyToMessage(null)

    if (window.innerWidth < 1024) {
      setSidebarOpen(false)
    }
  }

  const handleTyping = (e) => {
    setNewMessage(e.target.value)
    if ((!selectedUser && !selectedGroup) || !socket) return

    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current)

    socket.emit('typing', { receiverId: selectedUser?._id || null, groupId: selectedGroup?._id || null, isTyping: true })

    typingTimeoutRef.current = setTimeout(() => {
      socket.emit('typing', { receiverId: selectedUser?._id || null, groupId: selectedGroup?._id || null, isTyping: false })
    }, 1500)
  }

  const isOnline = (userId) => {
    return onlineUsers.some(u => u._id === userId)
  }

  const isUserTyping = typingUsers.some(entry => {
    if (selectedGroup) return entry.groupId === String(selectedGroup._id)
    return !entry.groupId && entry.userId !== String(user?._id) && entry.userId === String(selectedUser?._id)
  })
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
              <button type="button" onClick={() => setShowNotifications(true)} className="relative p-2 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800 transition" aria-label="Open notifications" title="Notifications">
                <FiBell className="w-5 h-5 text-light-text-secondary dark:text-dark-text-secondary" />
                {notificationUnreadCount > 0 && <span className="absolute -top-0.5 -right-0.5 min-w-4 h-4 px-1 rounded-full bg-red-500 text-white text-[9px] flex items-center justify-center">{notificationUnreadCount > 9 ? '9+' : notificationUnreadCount}</span>}
              </button>
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
                  localStorage.removeItem('selectedUserId')
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
                        {filteredUsers.length}
                      </span>
                      {!isConnected && <span className="text-xs text-red-500 ml-2">⚡</span>}
                    </div>
                    <div className="space-y-2 mb-3">
                      <input
                        value={conversationSearch}
                        onChange={(event) => setConversationSearch(event.target.value)}
                        placeholder="Search chats..."
                        aria-label="Search chats"
                        className={`w-full rounded-lg border px-3 py-2 text-xs ${isDark ? 'bg-black/20 border-white/20 text-white' : 'bg-white border-gray-200'} focus:outline-none focus:ring-2 focus:ring-primary-500`}
                      />
                      <select value={conversationFilter} onChange={(event) => setConversationFilter(event.target.value)} aria-label="Filter chats" className={`w-full rounded-lg border px-3 py-2 text-xs ${isDark ? 'bg-black/20 border-white/20 text-white' : 'bg-white border-gray-200'}`}>
                        <option value="active">Active chats</option>
                        <option value="all">All chats</option>
                        <option value="archived">Archived chats</option>
                      </select>
                    </div>
                    <div className="mb-4 border-b pb-3 border-gray-200 dark:border-white/10">
                      <div className="flex items-center justify-between mb-2">
                        <span className={`text-xs font-semibold uppercase tracking-wide ${theme.textSecondary}`}>Groups</span>
                        <button type="button" onClick={() => setShowGroupCreator(true)} className="text-xs text-primary-500 hover:text-primary-600">+ New</button>
                      </div>
                      <div className="space-y-1">
                        {filteredGroups.map(group => (
                          <button type="button" key={group._id} onClick={() => selectGroup(group)} className={`w-full text-left flex items-center gap-2 rounded-lg px-2 py-2 text-sm ${selectedGroup?._id === group._id ? 'bg-primary-100 dark:bg-primary-900/30' : 'hover:bg-gray-100 dark:hover:bg-gray-800'}`}>
                            <span className="w-7 h-7 rounded-full bg-primary-500 text-white flex items-center justify-center text-xs font-bold">{group.name.slice(0, 1).toUpperCase()}</span>
                            <span className={`truncate ${theme.text}`}>{group.name}</span>
                          </button>
                        ))}
                      </div>
                    </div>

                    {loading ? (
                      <div className="text-center text-gray-500 py-4 text-sm">Loading...</div>
                    ) : filteredUsers.length === 0 ? (
                      <div className="text-center text-gray-500 py-4 text-sm">No users found.</div>
                    ) : (
                      <div className="space-y-1.5">
                        {filteredUsers.map((chatUser) => {
                          const summary = getConversationSummary(chatUser._id)
                          const unreadCount = unreadCounts?.[chatUser._id] ?? summary?.unreadCount ?? 0
                          const latestMessage = summary?.lastMessage
                          const isLatestFromThisUser = Boolean(latestMessage)

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
                                    {latestMessage.senderId === user._id ? 'You: ' : ''}
                                    {latestMessage.text}
                                  </p>
                                )}
                              </div>
                              <div className="flex items-center gap-1 opacity-70 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                                <button type="button" title={summary?.isPinned ? 'Unpin chat' : 'Pin chat'} aria-label={summary?.isPinned ? 'Unpin chat' : 'Pin chat'} onClick={(event) => { event.stopPropagation(); updateConversationPreference(chatUser._id, 'pinnedBy', !summary?.isPinned) }} className={`p-1 rounded ${summary?.isPinned ? 'text-amber-500' : 'text-gray-400 hover:text-amber-500'}`}>
                                  <FiStar className="w-3.5 h-3.5" />
                                </button>
                                <button type="button" title={summary?.isMuted ? 'Unmute chat' : 'Mute chat'} aria-label={summary?.isMuted ? 'Unmute chat' : 'Mute chat'} onClick={(event) => { event.stopPropagation(); updateConversationPreference(chatUser._id, 'mutedBy', !summary?.isMuted) }} className={`p-1 rounded ${summary?.isMuted ? 'text-blue-500' : 'text-gray-400 hover:text-blue-500'}`}>
                                  <FiVolumeX className="w-3.5 h-3.5" />
                                </button>
                                <button type="button" title={summary?.isArchived ? 'Unarchive chat' : 'Archive chat'} aria-label={summary?.isArchived ? 'Unarchive chat' : 'Archive chat'} onClick={(event) => { event.stopPropagation(); updateConversationPreference(chatUser._id, 'archivedBy', !summary?.isArchived) }} className={`p-1 rounded ${summary?.isArchived ? 'text-green-500' : 'text-gray-400 hover:text-green-500'}`}>
                                  <FiArchive className="w-3.5 h-3.5" />
                                </button>
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
                {filteredUsers.length}
              </span>

              {!isConnected && <span className="text-xs text-red-500 ml-2">⚡ Disconnected</span>}
            </div>
            <div className="space-y-2 mb-3">
              <input
                value={conversationSearch}
                onChange={(event) => setConversationSearch(event.target.value)}
                placeholder="Search chats..."
                aria-label="Search chats"
                className={`w-full rounded-lg border px-3 py-2 text-xs ${isDark ? 'bg-black/20 border-white/20 text-white' : 'bg-white border-gray-200'} focus:outline-none focus:ring-2 focus:ring-primary-500`}
              />
              <select value={conversationFilter} onChange={(event) => setConversationFilter(event.target.value)} aria-label="Filter chats" className={`w-full rounded-lg border px-3 py-2 text-xs ${isDark ? 'bg-black/20 border-white/20 text-white' : 'bg-white border-gray-200'}`}>
                <option value="active">Active chats</option>
                <option value="all">All chats</option>
                <option value="archived">Archived chats</option>
              </select>
            </div>
            <div className="mb-4 border-b pb-3 border-gray-200 dark:border-white/10">
              <div className="flex items-center justify-between mb-2">
                <span className={`text-xs font-semibold uppercase tracking-wide ${theme.textSecondary}`}>Groups</span>
                <button type="button" onClick={() => setShowGroupCreator(true)} className="text-xs text-primary-500 hover:text-primary-600">+ New</button>
              </div>
              <div className="space-y-1">
                {filteredGroups.map(group => (
                  <button type="button" key={group._id} onClick={() => selectGroup(group)} className={`w-full text-left flex items-center gap-2 rounded-lg px-2 py-2 text-sm ${selectedGroup?._id === group._id ? 'bg-primary-100 dark:bg-primary-900/30' : 'hover:bg-gray-100 dark:hover:bg-gray-800'}`}>
                    <span className="w-7 h-7 rounded-full bg-primary-500 text-white flex items-center justify-center text-xs font-bold">{group.name.slice(0, 1).toUpperCase()}</span>
                    <span className={`truncate ${theme.text}`}>{group.name}</span>
                  </button>
                ))}
              </div>
            </div>

            {loading ? (
              <div className="text-center text-gray-500 py-4 text-sm">Loading users...</div>
            ) : filteredUsers.length === 0 ? (
              <div className="text-center text-gray-500 py-4 text-sm">No users found.</div>
            ) : (
              <div className="space-y-1.5">
                {filteredUsers.map((chatUser) => {
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
            {(selectedUser || selectedGroup) ? (
              <>
                {/* Chat Header */}
                <div className={`flex items-center gap-2 sm:gap-3 pb-2 sm:pb-3 border-b ${isDark ? 'border-white/20' : theme.border} mb-2 sm:mb-4`}>
                  <Avatar user={selectedUser || selectedGroup} size="md" theme={theme} isDark={isDark} />
                  <div className="flex-1 min-w-0">
                    <h3 className={`font-heading font-semibold ${theme.text} text-sm sm:text-base truncate`}>
                      {(selectedUser || selectedGroup).name}
                    </h3>
                    <p className={`text-[10px] sm:text-xs ${theme.textSecondary}`}>
                      {selectedGroup ? `${selectedGroup.members?.length || 0} members` : (isOnline(selectedUser._id) ? '🟢 Online' : '⚪ Offline')}
                    </p>
                  </div>
                  {selectedUser && <SafetyActions user={selectedUser} />}
                  {selectedGroup && <button type="button" onClick={() => setShowGroupSettings(true)} className="rounded-lg px-2 py-1 text-xs text-primary-500 hover:bg-primary-50 dark:hover:bg-primary-900/20">Settings</button>}
                </div>

                {/* ✅ Messages with scroll container ref */}
                <div
                  ref={scrollContainerRef}
                  className="flex-1 overflow-y-auto mb-2 sm:mb-4 space-y-2 sm:space-y-3 min-h-0"
                >
                  {messages.map((msg, index) => {
                    const senderId = normalizeSender(msg.sender)
                    const isMyMessage = String(senderId) === String(user?._id)
                    const isDeleted = msg.deleted === true
                    const hasReply = msg.replyTo || msg.replyToText
                    const replySenderName = msg.replyToSender?.name || 'Someone'
                    const attachment = msg.attachment || null

                    return (
                                              <div key={msg._id || msg.clientMessageId || index} className={`flex ${isMyMessage ? 'justify-end' : 'justify-start'}`}>

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
                                  : `${(selectedUser || selectedGroup)?.name || 'Someone'} deleted a message`}
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

                              {(msg.image || attachment?.resourceType === 'image') && (
                                <img
                                  src={msg.image || attachment.url}
                                  alt={attachment?.fileName || 'Shared image'}
                                  className="max-w-full rounded-lg mb-1 sm:mb-2 cursor-pointer hover:opacity-90 transition"
                                  onClick={() => setSelectedImage(msg.image || attachment.url)}
                                />
                              )}
                              {attachment?.resourceType === 'video' && (
                                <video controls preload="metadata" src={attachment.url || msg.video} className="max-w-full rounded-lg mb-1 sm:mb-2" />
                              )}
                              {attachment?.resourceType === 'audio' && (
                                <div className="min-w-[220px] py-1">
                                  <audio controls preload="metadata" src={attachment.url} className="w-full" />
                                  {attachment.duration && <span className="text-xs opacity-70">Voice note · {formatDuration(attachment.duration)}</span>}
                                </div>
                              )}
                              {attachment?.resourceType === 'raw' && (
                                <a href={attachment.url} target="_blank" rel="noreferrer" download={attachment.fileName} className="flex items-center gap-2 rounded-lg border border-current/20 px-3 py-2 hover:bg-black/10 transition">
                                  <span className="text-lg">▣</span>
                                  <span className="min-w-0"><span className="block truncate text-sm font-medium">{attachment.fileName || 'Download document'}</span><span className="block text-xs opacity-70">{formatFileSize(attachment.fileSize)} · Open document</span></span>
                                </a>
                              )}
                              {msg.text && <p className="text-sm sm:text-base break-words">{msg.text}</p>}
                              
                              <span className="text-[9px] sm:text-[10px] opacity-70 mt-0.5 sm:mt-1 flex items-center gap-1">
                                {new Date(msg.createdAt).toLocaleTimeString()}
                                {msg.edited && <span className="ml-1 italic">edited</span>}
                                {editingMessageId === msg._id && <span className="ml-1 italic">saving…</span>}
                                {isMyMessage && !msg.failed && <MessageStatus status={msg.status || 'sent'} />}
                                {msg.failed && (
                                  <button type="button" onClick={() => retryMessage(msg)} className="ml-1 text-red-500 underline hover:text-red-600">
                                    Retry
                                  </button>
                                )}
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
                                  onEdit={() => editMessage(msg)}
                                  onStar={() => starMessage(msg)}
                                  isStarred={msg.isStarred}
                                  onThread={() => openThread(msg)}
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

                {/* ✅ Floating Scroll Buttons */}
                {showScrollButton && (
                  <>
                    {/* Bottom button with unread count */}
                    <motion.button
                      initial={{ opacity: 0, scale: 0.8 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.8 }}
                      onClick={scrollToBottom}
                      className="fixed bottom-24 right-4 sm:bottom-6 sm:right-6 z-50 w-12 h-12 rounded-full bg-primary-500 text-white shadow-lg hover:bg-primary-600 transition-all flex items-center justify-center"
                      title="Jump to latest messages"
                    >
                      {unreadCount > 0 ? (
                        <span className="relative">
                          <span className="absolute -top-2 -right-2 w-5 h-5 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                            {unreadCount > 9 ? '9+' : unreadCount}
                          </span>
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                          </svg>
                        </span>
                      ) : (
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                        </svg>
                      )}
                    </motion.button>

                    {/* Top button */}
                    <motion.button
                      initial={{ opacity: 0, scale: 0.8 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.8 }}
                      onClick={scrollToTop}
                      className="fixed top-20 right-4 sm:top-24 sm:right-6 z-50 w-10 h-10 rounded-full bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300 shadow-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-all flex items-center justify-center"
                      title="Scroll to top"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18" />
                      </svg>
                    </motion.button>
                  </>
                )}

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
                      <span>{selectedGroup ? 'Someone' : selectedUser.name} is typing...</span>
                    </div>
                  )}

                  <AIAssist messages={messages} draft={newMessage} onDraftChange={setNewMessage} />
                  <form onSubmit={sendMessage} className={`flex gap-1 sm:gap-2 pt-2 sm:pt-3 border-t ${isDark ? 'border-white/20' : theme.border}`}>
                    <div className="flex-1 flex items-center gap-1 sm:gap-2">
                      <input
                        type="text"
                        value={newMessage}
                        onChange={handleTyping}
                        placeholder={replyToMessage ? "Write a reply..." : uploadedAttachment ? "Add caption..." : "Type a message..."}
                        className={`flex-1 px-3 sm:px-4 py-2.5 sm:py-3 rounded-xl text-sm sm:text-base border ${isDark ? 'border-white/20' : theme.border} ${isDark ? 'bg-[#1a1a1a]' : 'bg-light-surface'} ${theme.text} focus:outline-none focus:ring-2 focus:ring-primary-500 transition-all font-input placeholder:${theme.textSecondary} min-h-[44px]`}
                      />
                      <MediaUpload
                        onMediaUpload={handleMediaUpload}
                        disabled={!selectedUser && !selectedGroup}
                      />
                      <VoiceRecorder
                        onMediaUpload={handleMediaUpload}
                        disabled={!selectedUser && !selectedGroup}
                      />
                    </div>
                    <button
                      type="submit"
                      disabled={!newMessage.trim() && !uploadedAttachment}
                      className={`px-4 sm:px-6 py-2.5 sm:py-3 bg-gradient-to-r ${theme.button} text-white rounded-xl font-btn font-semibold ${theme.shadow} hover:shadow-xl transition-all hover:scale-[1.02] disabled:opacity-50 disabled:cursor-not-allowed min-h-[44px] min-w-[44px] flex items-center justify-center`}
                    >
                      <FiSend className="w-4 h-4 sm:w-5 sm:h-5" />
                    </button>
                  </form>

                  {uploadedAttachment && (
                    <div className="mt-2 p-2 bg-light-card dark:bg-dark-card rounded-lg flex items-center gap-2 sm:gap-3">
                      {uploadedAttachment.resourceType === 'image' ? (
                        <img src={uploadedAttachment.url} alt="Attachment preview" className="w-10 h-10 sm:w-12 sm:h-12 object-cover rounded" />
                      ) : (
                        <div className="w-10 h-10 sm:w-12 sm:h-12 rounded bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center text-primary-500 text-xs font-semibold">{uploadedAttachment.resourceType === 'audio' ? 'AUDIO' : uploadedAttachment.resourceType === 'video' ? 'VIDEO' : 'FILE'}</div>
                      )}
                      <span className="text-xs sm:text-sm text-light-text-secondary dark:text-dark-text-secondary flex-1 min-w-0 truncate">
                        {uploadedAttachment.fileName || 'Attachment ready'} {formatFileSize(uploadedAttachment.fileSize)}
                      </span>
                      <button type="button" onClick={clearUploadedAttachment} className="text-red-500 hover:text-red-600 p-1" aria-label="Remove attachment">✕</button>
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
      <NotificationCenter open={showNotifications} onClose={() => setShowNotifications(false)} onUnreadChange={setNotificationUnreadCount} />
      {showGroupCreator && (
        <GroupCreateModal
          users={users}
          onClose={() => setShowGroupCreator(false)}
          onCreated={(group) => {
            setGroups(previous => [group, ...previous.filter(item => item._id !== group._id)])
            selectGroup(group)
          }}
        />
      )}
      {threadRoot && <ThreadPanel rootMessage={threadRoot} onClose={() => setThreadRoot(null)} onReply={handleReply} />}
      {showGroupSettings && selectedGroup && (
        <GroupSettingsModal
          group={selectedGroup}
          users={users}
          currentUserId={user._id}
          onClose={() => setShowGroupSettings(false)}
          onUpdated={(updatedGroup) => {
            setSelectedGroup(updatedGroup)
            setGroups(previous => previous.map(group => group._id === updatedGroup._id ? updatedGroup : group))
          }}
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