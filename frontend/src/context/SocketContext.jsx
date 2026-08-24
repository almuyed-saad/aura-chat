import React, { createContext, useContext, useEffect, useState, useRef } from 'react'
import io from 'socket.io-client'
import { SOCKET_URL, API_URL } from '../config'

const SocketContext = createContext()

export const SocketProvider = ({ children }) => {
  const [socket, setSocket] = useState(null)
  const [onlineUsers, setOnlineUsers] = useState([])
  const [typingUsers, setTypingUsers] = useState([])
  const [isConnected, setIsConnected] = useState(false)
  const [unreadCounts, setUnreadCounts] = useState({})
  const socketRef = useRef(null)

  const getStoredUserId = () => {
    try {
      const user = JSON.parse(localStorage.getItem('user') || '{}')
      return String(user._id || user.id || '')
    } catch {
      return ''
    }
  }

  const fetchUnreadCounts = async () => {
    try {
      const token = localStorage.getItem('token')
      const response = await fetch(`${API_URL}/api/messages/unread/count`, {
        headers: { 'Authorization': `Bearer ${token}` }
      })
            const data = await response.json()
      if (!response.ok || !Array.isArray(data)) throw new Error('Unable to load unread counts')
      const counts = {}
      data.forEach(item => { counts[String(item._id)] = item.count })

      setUnreadCounts(counts)
    } catch (error) {
      console.error('❌ Error fetching unread counts:', error)
    }
  }

  useEffect(() => {
    let socketInstance = null

    const connectSocket = () => {
      const token = localStorage.getItem('token')
      console.log('🔑 Token for socket:', token ? 'Yes' : 'No')

      if (!token) {
        console.log('❌ No token, skipping socket connection')
        return null
      }

      const instance = io(SOCKET_URL, {
        auth: { token },
        transports: ['websocket', 'polling'],
        reconnection: true,
        reconnectionAttempts: 10,
        reconnectionDelay: 1000,
        timeout: 10000,
        forceNew: true
      })

      socketRef.current = instance
      setSocket(instance)

      instance.on('connect', () => {
        console.log('🟢 Socket connected successfully!')
        setIsConnected(true)
        const userId = getStoredUserId()
        if (userId) {
          instance.emit('joinRoom')
          fetchUnreadCounts()
        }
      })

      instance.on('connect_error', (error) => {
        console.error('❌ Socket connection error:', error.message)
        setIsConnected(false)
      })

      instance.on('disconnect', (reason) => {
        console.log('🔴 Socket disconnected:', reason)
        setIsConnected(false)
      })

      instance.on('reconnect', (attempt) => {
        console.log('🔄 Socket reconnected after', attempt, 'attempts')
        setIsConnected(true)
        const userId = getStoredUserId()
        if (userId) {
          instance.emit('joinRoom')
          fetchUnreadCounts()
        }
      })

      instance.on('getOnlineUsers', (users) => {
        console.log('📡 Online users updated:', users.map(u => u.name))
        setOnlineUsers(users)
      })

      instance.on('typing', (data) => {
        const entry = { userId: String(data.userId), groupId: data.groupId ? String(data.groupId) : null }
        if (data.isTyping) {
          setTypingUsers(prev => [...prev.filter(item => item.userId !== entry.userId || item.groupId !== entry.groupId), entry])
        } else {
          setTypingUsers(prev => prev.filter(item => item.userId !== entry.userId || item.groupId !== entry.groupId))
        }
      })

      instance.on('receiveMessage', (message) => {
        console.log('📩 Socket received message:', message.text || 'image')
      })

      instance.on('reactionUpdated', () => {
        console.log('👍 Socket received reaction update')
      })

      instance.on('unreadCount', (data) => {
        console.log('🔴 Unread count update:', data)
        setUnreadCounts(prev => ({ ...prev, [data.senderId]: data.count }))
      })

      return instance
    }

    socketInstance = connectSocket()

    const handleAuthChange = () => {
      if (socketInstance) socketInstance.disconnect()
      socketRef.current = null
      setSocket(null)
      setOnlineUsers([])
      setTypingUsers([])
      setUnreadCounts({})
      socketInstance = connectSocket()
    }

    window.addEventListener('authChanged', handleAuthChange)

    return () => {
      window.removeEventListener('authChanged', handleAuthChange)
      if (socketInstance) socketInstance.disconnect()
      socketRef.current = null
      setSocket(null)
    }
  }, [])

  const clearUnreadCount = (userId) => {
    setUnreadCounts(prev => ({ ...prev, [userId]: 0 }))
  }

  return (
    <SocketContext.Provider value={{
      socket: socketRef.current,
      onlineUsers,
      typingUsers,
      isConnected,
      unreadCounts,
      setUnreadCounts,
      clearUnreadCount
    }}>
      {children}
    </SocketContext.Provider>
  )
}

export const useSocket = () => {
  const context = useContext(SocketContext)
  if (!context) {
    throw new Error('useSocket must be used within SocketProvider')
  }
  return context
}