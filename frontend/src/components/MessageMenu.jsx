import React, { useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { FiMoreVertical, FiTrash2, FiCopy, FiCornerUpLeft, FiEdit3 } from 'react-icons/fi'

const MessageMenu = ({
  messageId,
  isMyMessage,
  onDelete,
  onEdit,
  onCopy,
  onReply
}) => {
  const [isOpen, setIsOpen] = useState(false)
  const [coords, setCoords] = useState({ top: 0, left: 0 })
  const buttonRef = useRef(null)
  const menuRef = useRef(null)

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (
        buttonRef.current && !buttonRef.current.contains(e.target) &&
        menuRef.current && !menuRef.current.contains(e.target)
      ) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  useEffect(() => {
    if (!isOpen) return
    const close = () => setIsOpen(false)
    window.addEventListener('scroll', close, true)
    window.addEventListener('resize', close)
    return () => {
      window.removeEventListener('scroll', close, true)
      window.removeEventListener('resize', close)
    }
  }, [isOpen])

  const toggleMenu = (e) => {
    e.stopPropagation()
    if (!isOpen && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect()
      const menuWidth = 150
      let left = isMyMessage ? rect.right - menuWidth : rect.left
      left = Math.max(8, Math.min(left, window.innerWidth - menuWidth - 8))
      setCoords({
        top: rect.top - 4,
        left
      })
    }
    setIsOpen(prev => !prev)
  }

  const handleDelete = () => {
    if (window.confirm('Delete this message?')) {
      onDelete(messageId)
      setIsOpen(false)
    }
  }

  const handleCopy = () => {
    onCopy()
    setIsOpen(false)
  }

  const handleReply = () => {
    onReply()
    setIsOpen(false)
  }

  return (
    <div className="relative inline-flex items-center">
      <button
        ref={buttonRef}
        onClick={toggleMenu}
        className="p-0.5 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 transition text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300"
        title="Message options"
      >
        <FiMoreVertical className="w-3.5 h-3.5" />
      </button>

      {createPortal(
        <AnimatePresence>
          {isOpen && (
            <motion.div
              ref={menuRef}
              initial={{ opacity: 0, scale: 0.95, y: 5 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 5 }}
              transition={{ duration: 0.15 }}
              style={{
                position: 'fixed',
                top: coords.top,
                left: coords.left,
                transform: 'translateY(-100%)'
              }}
              className="bg-white dark:bg-dark-surface rounded-xl shadow-xl border border-gray-200 dark:border-gray-700 py-1 z-[9999] min-w-[140px]"
            >
              <button
                onClick={handleReply}
                className="w-full flex items-center gap-3 px-4 py-2 text-sm text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition"
              >
                <FiCornerUpLeft className="w-4 h-4" />
                Reply
              </button>

              <button
                onClick={handleCopy}
                className="w-full flex items-center gap-3 px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition"
              >
                <FiCopy className="w-4 h-4" />
                Copy
              </button>

              {isMyMessage && onEdit && (
                <button
                  onClick={() => {
                    onEdit()
                    setIsOpen(false)
                  }}
                  className="w-full flex items-center gap-3 px-4 py-2 text-sm text-purple-500 hover:bg-purple-50 dark:hover:bg-purple-900/20 transition"
                >
                  <FiEdit3 className="w-4 h-4" />
                  Edit
                </button>
              )}

              {isMyMessage && (
                <button
                  onClick={handleDelete}
                  className="w-full flex items-center gap-3 px-4 py-2 text-sm text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition"
                >
                  <FiTrash2 className="w-4 h-4" />
                  Delete
                </button>
              )}
            </motion.div>
          )}
        </AnimatePresence>,
        document.body
      )}
    </div>
  )
}

export default MessageMenu