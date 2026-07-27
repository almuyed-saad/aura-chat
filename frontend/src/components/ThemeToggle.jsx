import { useTheme } from '../context/ThemeContext'
import { motion, AnimatePresence } from 'framer-motion'
import { useState } from 'react'

const ThemeToggle = () => {
  // ✅ now also pulling `theme` itself, not just currentTheme/setCurrentTheme -
  // previously this component never used `theme` at all, so the button and
  // dropdown were hardcoded to one fixed look regardless of which theme
  // was actually selected
  const { currentTheme, setCurrentTheme, theme } = useTheme()
  const [isOpen, setIsOpen] = useState(false)

  const themeList = [
    { key: 'purple', emoji: '💜', label: 'Purple' },
    { key: 'love', emoji: '❤️', label: 'Love' },
    { key: 'romantic', emoji: '🌸', label: 'Romantic' },
    { key: 'dark', emoji: '🌙', label: 'Dark' },
    { key: 'light', emoji: '☀️', label: 'Light' },
  ]

  const currentThemeEmoji = themeList.find(t => t.key === currentTheme)?.emoji || '💜'
  const isDark = currentTheme === 'dark'

  return (
    <div className="relative">
      {/* Theme Button - now uses theme.card/border instead of a fixed
          light/dark pair, so it actually matches whatever theme is active */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`w-10 h-10 rounded-full ${theme.card} backdrop-blur-sm border ${theme.border} flex items-center justify-center text-xl hover:scale-110 transition-transform`}
      >
        {currentThemeEmoji}
      </button>

      {/* Theme Dropdown */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.95 }}
            transition={{ duration: 0.15 }}
            className={`absolute right-0 mt-2 w-48 ${theme.card} backdrop-blur-xl rounded-2xl ${theme.shadow} border ${theme.border} overflow-hidden z-50`}
          >
            <div className="p-2">
              <p className={`text-xs ${theme.textSecondary} px-3 py-1 font-medium`}>
                Choose Theme
              </p>
              {themeList.map((t) => (
                <button
                  key={t.key}
                  onClick={() => {
                    setCurrentTheme(t.key)
                    setIsOpen(false)
                  }}
                  className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-sm transition-all ${
                    currentTheme === t.key
                      ? `bg-gradient-to-r ${theme.button} bg-opacity-10 ${theme.accent} font-medium`
                      : `${theme.cardHover} ${theme.text}`
                  }`}
                >
                  <span className="text-lg">{t.emoji}</span>
                  <span>{t.label}</span>
                  {currentTheme === t.key && (
                    <span className={`ml-auto ${theme.accent}`}>✓</span>
                  )}
                </button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

export default ThemeToggle