import React, { useEffect, useState } from 'react'
import { FiBell, FiCheck, FiX } from 'react-icons/fi'
import apiClient from '../api/client'
import { useTheme } from '../context/ThemeContext'

const NotificationCenter = ({ open, onClose, onUnreadChange }) => {
  const { theme } = useTheme()
  const isDark = theme.name === 'Dark'
  const [notifications, setNotifications] = useState([])
  const [loading, setLoading] = useState(false)

  const loadNotifications = async () => {
    setLoading(true)
    try {
      const response = await apiClient.get('/api/notifications?limit=50')
      setNotifications(response.data.notifications || [])
      onUnreadChange(response.data.unreadCount || 0)
    } catch {
      // The notification center is optional and should not interrupt chat.
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (open) loadNotifications()
  }, [open])

  const markRead = async (notification) => {
    if (notification.read) return
    try {
      await apiClient.patch(`/api/notifications/${notification._id}/read`)
      setNotifications(previous => previous.map(item => item._id === notification._id ? { ...item, read: true } : item))
      onUnreadChange(previous => Math.max(0, previous - 1))
    } catch {
      // Ignore optional read-state failures.
    }
  }

  const markAllRead = async () => {
    try {
      await apiClient.post('/api/notifications/read-all')
      setNotifications(previous => previous.map(item => ({ ...item, read: true })))
      onUnreadChange(0)
    } catch {
      // Ignore optional read-state failures.
    }
  }

  if (!open) return null

  const mutedText = isDark ? 'text-gray-400' : 'text-slate-600'
  const panelBorder = isDark ? 'border-white/15' : 'border-slate-200'
  const hover = isDark ? 'hover:bg-white/10' : 'hover:bg-slate-100'

  return (
    <div className="fixed inset-0 z-[70]" role="dialog" aria-modal="true" aria-label="Notifications">
      <button type="button" className="absolute inset-0 bg-black/30" onClick={onClose} aria-label="Close notifications" />
      <div className={`absolute top-16 right-3 sm:right-6 w-[calc(100%-1.5rem)] sm:w-96 max-h-[70vh] overflow-hidden rounded-2xl ${theme.card} border ${panelBorder} shadow-2xl`}>
        <div className={`flex items-center gap-2 px-4 py-3 border-b ${panelBorder}`}>
          <FiBell className={theme.accent} />
          <h2 className={`flex-1 font-semibold ${theme.text}`}>Notifications</h2>
          <button type="button" onClick={markAllRead} title="Mark all as read" aria-label="Mark all as read" className={`p-1.5 rounded-lg ${mutedText} ${hover} hover:text-primary-500`}><FiCheck className="w-4 h-4" /></button>
          <button type="button" onClick={onClose} title="Close" aria-label="Close" className={`p-1.5 rounded-lg ${mutedText} ${hover} hover:text-red-500`}><FiX className="w-4 h-4" /></button>
        </div>
        <div className="overflow-y-auto max-h-[calc(70vh-3.5rem)] p-2">
          {loading ? <p className={`p-4 text-sm ${mutedText}`}>Loading notifications…</p> : notifications.length === 0 ? <p className={`p-4 text-sm ${mutedText}`}>You are all caught up.</p> : notifications.map(notification => (
            <button type="button" key={notification._id} onClick={() => markRead(notification)} className={`w-full text-left flex gap-3 rounded-xl p-3 mb-1 transition ${notification.read ? `${isDark ? 'opacity-80' : 'opacity-90'} ${hover}` : (isDark ? 'bg-violet-950/50 hover:bg-violet-900/50' : 'bg-violet-50 hover:bg-violet-100')}`}>
              <div className="w-2 h-2 mt-2 rounded-full bg-primary-500 flex-shrink-0" />
              <div className="min-w-0"><p className={`text-sm ${theme.text}`}>{notification.text}</p><p className={`text-xs ${mutedText} mt-1`}>{new Date(notification.createdAt).toLocaleString()}</p></div>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

export default NotificationCenter
