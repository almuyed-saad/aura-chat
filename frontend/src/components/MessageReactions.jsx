import React, { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { FiSmile } from 'react-icons/fi'

const EMOJIS = ['❤️', '😂', '😮', '😢', '😡', '👍']
const PICKER_WIDTH = 220 // approx width of the 6-emoji row + padding

const MessageReactions = ({
  messageId,
  reactions,
  currentUserId,
  onReact,
  isMyMessage
}) => {
  const [showPicker, setShowPicker] = useState(false)
  const [coords, setCoords] = useState({ top: 0, left: 0 })
  const pickerRef = useRef(null)
  const buttonRef = useRef(null)

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (
        pickerRef.current && !pickerRef.current.contains(e.target) &&
        buttonRef.current && !buttonRef.current.contains(e.target)
      ) {
        setShowPicker(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Close on scroll/resize so the picker doesn't float over the wrong message
  useEffect(() => {
    if (!showPicker) return
    const close = () => setShowPicker(false)
    window.addEventListener('scroll', close, true)
    window.addEventListener('resize', close)
    return () => {
      window.removeEventListener('scroll', close, true)
      window.removeEventListener('resize', close)
    }
  }, [showPicker])

  const safeReactions = reactions && typeof reactions === 'object' ? reactions : {}
  const userReaction = safeReactions[currentUserId] || null

  const reactionCounts = {}
  Object.entries(safeReactions).forEach(([userId, emoji]) => {
    if (!reactionCounts[emoji]) reactionCounts[emoji] = []
    reactionCounts[emoji].push(userId)
  })

  const totalReactions = Object.keys(safeReactions).length

  const handleReaction = (emoji) => {
    const nextEmoji = emoji === userReaction ? null : emoji
    onReact(messageId, nextEmoji)
    setShowPicker(false)
  }

  const togglePicker = (e) => {
    e.stopPropagation()
    if (!showPicker && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect()

      // Anchor to the button, then clamp so it can never push the page
      // wider or get clipped off the left edge - this is what fixes
      // both the cutoff and the phantom horizontal scrollbar.
      let left = isMyMessage ? rect.right - PICKER_WIDTH : rect.left
      left = Math.max(8, Math.min(left, window.innerWidth - PICKER_WIDTH - 8))

      setCoords({
        top: rect.top - 8,
        left
      })
    }
    setShowPicker(prev => !prev)
  }

  return (
    <div className="relative inline-flex items-center gap-0.5">
      {/* Reaction chips */}
      {totalReactions > 0 && (
        <div className="flex items-center gap-0.5">
          {Object.entries(reactionCounts).slice(0, 3).map(([emoji, users]) => (
            <button
              key={emoji}
              onClick={() => handleReaction(emoji)}
              className={`flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded-full transition
                bg-gray-100 text-gray-700 border border-gray-300 hover:bg-gray-200
                dark:bg-[#2a2a2a] dark:text-white dark:border-white/20 dark:hover:bg-[#3a3a3a]
                ${users.includes(currentUserId) ? 'ring-1 ring-primary-500 dark:ring-primary-400' : ''}`}
            >
              <span>{emoji}</span>
              <span className="font-medium text-[9px]">{users.length}</span>
            </button>
          ))}
          {totalReactions > 3 && (
            <span className="text-[10px] text-gray-400 dark:text-gray-400 ml-0.5">
              +{totalReactions - 3}
            </span>
          )}
        </div>
      )}

      {/* Smiley button */}
      <button
        ref={buttonRef}
        onClick={togglePicker}
        className="p-0.5 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 transition text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300"
        title="Add reaction"
      >
        <FiSmile className="w-3.5 h-3.5" />
      </button>

      {/* Picker rendered via portal to document.body - escapes the scroll
          container's clipping AND can't push the page width out anymore,
          since coords are clamped to window.innerWidth above */}
      {createPortal(
        <AnimatePresence>
          {showPicker && (
            <motion.div
              ref={pickerRef}
              initial={{ opacity: 0, scale: 0.9, y: 5 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 5 }}
              transition={{ duration: 0.15 }}
              style={{
                position: 'fixed',
                top: coords.top,
                left: coords.left,
                transform: 'translateY(-100%)'
              }}
              className="bg-white dark:bg-[#1a1a1a] rounded-full shadow-xl border border-gray-200 dark:border-gray-700 px-1.5 py-1 flex items-center gap-0.5 z-[9999]"
            >
              {EMOJIS.map((emoji) => (
                <button
                  key={emoji}
                  onClick={() => handleReaction(emoji)}
                  className={`w-7 h-7 rounded-full hover:bg-gray-100 dark:hover:bg-[#2a2a2a] transition flex items-center justify-center text-base hover:scale-125 transform ${
                    userReaction === emoji ? 'bg-primary-100 dark:bg-primary-900/30 ring-1 ring-primary-500' : ''
                  }`}
                >
                  {emoji}
                </button>
              ))}
            </motion.div>
          )}
        </AnimatePresence>,
        document.body
      )}
    </div>
  )
}

export default MessageReactions