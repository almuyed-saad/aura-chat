import React, { createContext, useContext, useEffect, useState, useRef } from 'react'
import io from 'socket.io-client'

const SocketContext = createContext()

export const SocketProvider = ({ children }) => {
  const [socket, setSocket] = useState(null)
  const [onlineUsers, setOnlineUsers] = useState([])
  const [typingUsers, setTypingUsers] = useState([])
  const [isConnected, setIsConnected] = useState(false)
  const [unreadCounts, setUnreadCounts] = useState({})
  const socketRef = useRef(null)

  useEffect(() => {
    const token = localStorage.getItem('token')
    console.log('🔑 Token for socket:', token ? 'Yes' : 'No')
    
    if (!token) {
      console.log('❌ No token, skipping socket connection')
      return
    }

    // ✅ Use environment variable for production, fallback to localhost for development
const SOCKET_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000'

const socketInstance = io(SOCKET_URL, {
  auth: { token },
  transports: ['websocket', 'polling'],
  reconnection: true,
  reconnectionAttempts: 10,
  reconnectionDelay: 1000,
  timeout: 10000,
  forceNew: true
});

    socketRef.current = socketInstance
    setSocket(socketInstance)

    socketInstance.on('connect', () => {
      console.log('🟢 Socket connected successfully!')
      console.log('🔌 Transport:', socketInstance.io?.engine?.transport?.name)
      setIsConnected(true)
      
      const user = JSON.parse(localStorage.getItem('user') || '{}')
      if (user._id) {
        socketInstance.emit('joinRoom', user._id)
        console.log('📌 Joined room:', user._id)
        
        // ✅ Fetch initial unread counts
        fetchUnreadCounts(socketInstance)
      }
    })

    socketInstance.on('connect_error', (error) => {
      console.error('❌ Socket connection error:', error.message)
      setIsConnected(false)
    })

    socketInstance.on('disconnect', (reason) => {
      console.log('🔴 Socket disconnected:', reason)
      setIsConnected(false)
    })

    socketInstance.on('reconnect', (attempt) => {
      console.log('🔄 Socket reconnected after', attempt, 'attempts')
      setIsConnected(true)
      const user = JSON.parse(localStorage.getItem('user') || '{}')
      if (user._id) {
        socketInstance.emit('joinRoom', user._id)
        // ✅ Fetch unread counts on reconnect
        fetchUnreadCounts(socketInstance)
      }
    })

    socketInstance.on('getOnlineUsers', (users) => {
      console.log('📡 Online users updated:', users.map(u => u.name))
      setOnlineUsers(users)
    })

    socketInstance.on('typing', (data) => {
      console.log('⌨️ Typing event:', data)
      if (data.isTyping) {
        setTypingUsers(prev => [...new Set([...prev, data.userId])])
      } else {
        setTypingUsers(prev => prev.filter(id => id !== data.userId))
      }
    })

    socketInstance.on('receiveMessage', (message) => {
      console.log('📩 Socket received message:', message.text || 'image')
    })

    socketInstance.on('reactionUpdated', (message) => {
      console.log('👍 Socket received reaction update')
    })

    // ✅ Handle unread count updates
    socketInstance.on('unreadCount', (data) => {
      console.log('🔴 Unread count update:', data)
      setUnreadCounts(prev => ({
        ...prev,
        [data.senderId]: data.count
      }))
    })

    return () => {
      console.log('🧹 Cleaning up socket connection')
      socketInstance.disconnect()
    }
  }, [])

  // ✅ Function to fetch unread counts
  const fetchUnreadCounts = async (socketInstance) => {
    try {
      const token = localStorage.getItem('token')
      const response = await fetch('http://localhost:5000/api/messages/unread/count', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })
      const data = await response.json()
      console.log('📊 Initial unread counts:', data)
      
      const counts = {}
      data.forEach(item => {
        counts[item._id] = item.count
      })
      setUnreadCounts(counts)
    } catch (error) {
      console.error('❌ Error fetching unread counts:', error)
    }
  }

  // ✅ Function to clear unread count for a user
  const clearUnreadCount = (userId) => {
    console.log('🧹 Clearing unread count for user:', userId)
    setUnreadCounts(prev => ({
      ...prev,
      [userId]: 0
    }))
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