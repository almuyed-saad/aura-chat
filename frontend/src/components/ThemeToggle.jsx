import { useTheme } from '../context/ThemeContext'
import { motion, AnimatePresence } from 'framer-motion'
import { useEffect, useRef, useState } from 'react'

const ThemeToggle = () => {
  const { currentTheme, setCurrentTheme, theme } = useTheme()
  const [isOpen, setIsOpen] = useState(false)
  const menuRef = useRef(null)

  const themeList = [
    { key: 'purple', emoji: '💜', label: 'Purple' },
    { key: 'love', emoji: '❤️', label: 'Love' },
    { key: 'romantic', emoji: '🌸', label: 'Romantic' },
    { key: 'dark', emoji: '🌙', label: 'Dark' },
    { key: 'light', emoji: '☀️', label: 'Light' },
  ]

  const currentThemeEmoji = themeList.find(item => item.key === currentTheme)?.emoji || '💜'
  const isDark = currentTheme === 'dark'

  useEffect(() => {
    if (!isOpen) return undefined
    const handleOutsideClick = event => {
      if (!menuRef.current?.contains(event.target)) setIsOpen(false)
    }
    const handleEscape = event => {
      if (event.key === 'Escape') setIsOpen(false)
    }
    document.addEventListener('mousedown', handleOutsideClick)
    document.addEventListener('keydown', handleEscape)
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick)
      document.removeEventListener('keydown', handleEscape)
    }
  }, [isOpen])

  return (
    <div ref={menuRef} className="relative">
      <button
        type="button"
        onClick={() => setIsOpen(previous => !previous)}
        aria-label={`Change theme. Current theme: ${theme.name}`}
        aria-haspopup="menu"
        aria-expanded={isOpen}
        title={`Theme: ${theme.name}`}
        className={`w-10 h-10 rounded-full ${theme.card} border ${theme.border} flex items-center justify-center text-xl shadow-sm hover:scale-105 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-primary-500/60 transition-all`}
      >
        {currentThemeEmoji}
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.95 }}
            transition={{ duration: 0.15 }}
            role="menu"
            aria-label="Choose theme"
            className={`absolute right-0 mt-2 w-48 ${theme.card} backdrop-blur-xl rounded-2xl ${theme.shadow} border ${theme.border} overflow-hidden z-50 p-2`}
          >
            <p className={`text-xs ${theme.textSecondary} px-3 py-1.5 font-semibold uppercase tracking-wide`}>
              Choose theme
            </p>
            {themeList.map(item => {
              const selected = currentTheme === item.key
              return (
                <button
                  type="button"
                  role="menuitemradio"
                  aria-checked={selected}
                  key={item.key}
                  onClick={() => {
                    setCurrentTheme(item.key)
                    setIsOpen(false)
                  }}
                  className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/50 transition-all ${selected
                    ? (isDark ? 'bg-violet-900/50 text-violet-100 ring-1 ring-violet-400/40' : 'bg-primary-100 text-primary-800 ring-1 ring-primary-300')
                    : `${theme.text} ${isDark ? 'hover:bg-white/10' : 'hover:bg-slate-100'}`}`}
                >
                  <span className="text-lg" aria-hidden="true">{item.emoji}</span>
                  <span className="font-medium">{item.label}</span>
                  {selected && <span className="ml-auto text-sm font-bold text-primary-600 dark:text-violet-300" aria-label="Selected">✓</span>}
                </button>
              )
            })}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

export default ThemeToggle
