import React, { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { FiBell, FiX } from 'react-icons/fi'

const NotificationBanner = () => {
  const [showBanner, setShowBanner] = useState(false)

  useEffect(() => {
    const hasBeenShown = localStorage.getItem('notification_banner_shown')
    if (!hasBeenShown) {
      setShowBanner(true)
    }
  }, [])

  const handleDismiss = () => {
    setShowBanner(false)
    localStorage.setItem('notification_banner_shown', 'true')
  }

  const handleEnable = () => {
    // Request notification permission
    if ('Notification' in window) {
      Notification.requestPermission().then(permission => {
        if (permission === 'granted') {
          // Subscribe to push notifications
          // ...
        }
      })
    }
    handleDismiss()
  }

return (
  <AnimatePresence>
    {showBanner && (
      <div className="fixed top-20 sm:top-24 left-1/2 -translate-x-1/2 z-[60] w-[92%] max-w-md px-2">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
        >
          <div className="bg-white dark:bg-dark-surface rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-700 p-4 flex items-center gap-3">
            <div className="flex-shrink-0 w-10 h-10 rounded-full bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center">
              <FiBell className="w-5 h-5 text-primary-500" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-dark-bg dark:text-white">
                Turn on notifications
              </p>
              <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary truncate">
                Get notified about new messages
              </p>
            </div>
            <button
              onClick={handleEnable}
              className="px-3 py-1.5 bg-primary-500 text-white text-xs font-medium rounded-full hover:bg-primary-600 transition whitespace-nowrap"
            >
              Enable
            </button>
            <button
              onClick={handleDismiss}
              className="p-1.5 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition text-gray-400 hover:text-gray-600"
            >
              <FiX className="w-4 h-4" />
            </button>
          </div>
        </motion.div>
      </div>
    )}
  </AnimatePresence>
)
}

export default NotificationBanner