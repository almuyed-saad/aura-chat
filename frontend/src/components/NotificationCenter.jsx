import React, { useEffect, useState } from 'react'
import { FiBell, FiCheck, FiX } from 'react-icons/fi'
import apiClient from '../api/client'

const NotificationCenter = ({ open, onClose, onUnreadChange }) => {
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

  return (
    <div className="fixed inset-0 z-[70]" role="dialog" aria-modal="true" aria-label="Notifications">
      <button type="button" className="absolute inset-0 bg-black/30" onClick={onClose} aria-label="Close notifications" />
      <div className="absolute top-16 right-3 sm:right-6 w-[calc(100%-1.5rem)] sm:w-96 max-h-[70vh] overflow-hidden rounded-2xl bg-white dark:bg-dark-surface border border-gray-200 dark:border-gray-700 shadow-2xl">
        <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-200 dark:border-gray-700">
          <FiBell className="text-primary-500" />
          <h2 className="flex-1 font-semibold text-dark-bg dark:text-white">Notifications</h2>
          <button type="button" onClick={markAllRead} title="Mark all as read" aria-label="Mark all as read" className="p-1.5 rounded-lg text-gray-400 hover:text-primary-500 hover:bg-gray-100 dark:hover:bg-gray-800"><FiCheck className="w-4 h-4" /></button>
          <button type="button" onClick={onClose} title="Close" aria-label="Close" className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 dark:hover:text-white"><FiX className="w-4 h-4" /></button>
        </div>
        <div className="overflow-y-auto max-h-[calc(70vh-3.5rem)] p-2">
          {loading ? <p className="p-4 text-sm text-gray-500">Loading notifications…</p> : notifications.length === 0 ? <p className="p-4 text-sm text-gray-500">You are all caught up.</p> : notifications.map(notification => (
            <button type="button" key={notification._id} onClick={() => markRead(notification)} className={`w-full text-left flex gap-3 rounded-xl p-3 mb-1 transition ${notification.read ? 'opacity-70 hover:bg-gray-100 dark:hover:bg-gray-800' : 'bg-primary-50 dark:bg-primary-900/20 hover:bg-primary-100 dark:hover:bg-primary-900/30'}`}>
              <div className="w-2 h-2 mt-2 rounded-full bg-primary-500 flex-shrink-0 opacity-70" />
              <div className="min-w-0"><p className="text-sm text-dark-bg dark:text-white">{notification.text}</p><p className="text-xs text-gray-500 mt-1">{new Date(notification.createdAt).toLocaleString()}</p></div>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

export default NotificationCenter
