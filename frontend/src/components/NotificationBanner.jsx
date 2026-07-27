import React, { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { FiBell, FiX } from 'react-icons/fi'

// Shows once per login session, ONLY if the user hasn't already answered
// the browser's real permission prompt (Notification.permission === 'default').
// - Dismiss (X) -> hides for this session, will show again next login
// - "Enable" -> triggers the real browser popup; once they answer (Allow
//   or Block), this banner never shows again, since there's nothing left to ask
const NotificationBanner = ({ enableNotifications, theme, isDark }) => {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (!('Notification' in window)) return // browser doesn't support it at all

    // Only show if permission hasn't been decided yet, and the user
    // hasn't dismissed it already THIS session
    const dismissedThisSession = sessionStorage.getItem('notifBannerDismissed')
    if (Notification.permission === 'default' && !dismissedThisSession) {
      // small delay so it doesn't slam the user the instant the page loads
      const timer = setTimeout(() => setVisible(true), 1200)
      return () => clearTimeout(timer)
    }
  }, [])

  const handleDismiss = () => {
    sessionStorage.setItem('notifBannerDismissed', 'true')
    setVisible(false)
  }

  const handleEnable = async () => {
    await enableNotifications()
    setVisible(false) // hide regardless of Allow/Block - the answer is now final
  }

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ y: -60, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -60, opacity: 0 }}
          transition={{ type: 'spring', damping: 22 }}
          className={`fixed top-16 sm:top-20 left-1/2 -translate-x-1/2 z-[100] w-[92%] sm:w-auto max-w-md
            ${isDark ? 'bg-[#1a1a1a] border border-white/20' : 'bg-white border border-gray-200'}
            rounded-2xl shadow-2xl px-4 py-3 flex items-center gap-3`}
        >
          <div className={`w-9 h-9 rounded-full bg-gradient-to-r ${theme.primary} flex items-center justify-center flex-shrink-0`}>
            <FiBell className="w-4 h-4 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <p className={`text-sm font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>
              Turn on notifications?
            </p>
            <p className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
              Get notified about new messages
            </p>
          </div>
          <button
            onClick={handleEnable}
            className={`text-xs font-semibold px-3 py-1.5 rounded-lg bg-gradient-to-r ${theme.primary} text-white whitespace-nowrap`}
          >
            Enable
          </button>
          <button
            onClick={handleDismiss}
            className={`p-1 rounded-full flex-shrink-0 ${isDark ? 'text-gray-500 hover:text-gray-300' : 'text-gray-400 hover:text-gray-600'}`}
          >
            <FiX className="w-4 h-4" />
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

export default NotificationBanner