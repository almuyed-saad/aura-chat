import React, { createContext, useState, useContext, useEffect } from 'react'

const ThemeContext = createContext()

// Each theme now has a genuinely distinct tinted background/card/border,
// a REAL working shadow (previously `shadow-${theme.shadow}` produced an
// invalid double-prefixed class like `shadow-shadow-primary-500/30` that
// silently rendered nothing - `shadow` below is now a complete, ready-to-use
// class string, e.g. `shadow-xl shadow-primary-500/20`).
// The app keeps a data-theme attribute for theme-aware design tokens and also
// toggles Tailwind's `dark` class so every dark: utility stays synchronized
// with the selected Dark theme.
const themes = {
  purple: {
    name: 'Purple',
    primary: 'from-violet-500 via-purple-600 to-fuchsia-600',
    primaryLight: 'from-violet-400 via-purple-500 to-fuchsia-500',
    background: 'bg-gradient-to-br from-violet-50 via-white to-purple-50',
    card: 'bg-white/90 backdrop-blur-sm',
    cardHover: 'hover:bg-violet-50/80',
    border: 'border-violet-200',
    text: 'text-slate-900',
    textSecondary: 'text-slate-600',
    accent: 'text-purple-600',
    button: 'from-violet-500 via-purple-600 to-fuchsia-600',
    shadow: 'shadow-xl shadow-purple-500/20',
    avatar: 'from-violet-500 to-fuchsia-600',
    userCard: 'border-violet-100 hover:border-violet-300',
    inputBg: 'bg-white',
    logo: 'bg-gradient-to-r from-violet-600 to-fuchsia-600 bg-clip-text text-transparent',
    emoji: '💜'
  },
  love: {
    name: 'Love',
    primary: 'from-rose-500 via-red-500 to-pink-600',
    primaryLight: 'from-rose-400 via-red-400 to-pink-500',
    background: 'bg-gradient-to-br from-rose-50 via-white to-red-50',
    card: 'bg-white/90 backdrop-blur-sm',
    cardHover: 'hover:bg-rose-50/80',
    border: 'border-rose-200',
    text: 'text-slate-900',
    textSecondary: 'text-slate-600',
    accent: 'text-rose-600',
    button: 'from-rose-500 via-red-500 to-pink-600',
    shadow: 'shadow-xl shadow-rose-500/20',
    avatar: 'from-rose-500 to-pink-600',
    userCard: 'border-rose-100 hover:border-rose-300',
    inputBg: 'bg-white',
    logo: 'bg-gradient-to-r from-rose-600 to-pink-600 bg-clip-text text-transparent',
    emoji: '❤️'
  },
  romantic: {
    name: 'Romantic',
    primary: 'from-pink-400 via-fuchsia-400 to-rose-400',
    primaryLight: 'from-pink-300 via-fuchsia-300 to-rose-300',
    background: 'bg-gradient-to-br from-pink-50 via-white to-fuchsia-50',
    card: 'bg-white/90 backdrop-blur-sm',
    cardHover: 'hover:bg-pink-50/80',
    border: 'border-pink-200',
    text: 'text-slate-900',
    textSecondary: 'text-slate-600',
    accent: 'text-pink-500',
    button: 'from-pink-400 via-fuchsia-400 to-rose-400',
    shadow: 'shadow-xl shadow-pink-400/20',
    avatar: 'from-pink-400 to-rose-400',
    userCard: 'border-pink-100 hover:border-pink-300',
    inputBg: 'bg-white',
    logo: 'bg-gradient-to-r from-pink-500 to-fuchsia-500 bg-clip-text text-transparent',
    emoji: '🌸'
  },
  dark: {
    name: 'Dark',
    primary: 'from-violet-500 via-fuchsia-500 to-pink-500',
    primaryLight: 'from-violet-400 via-fuchsia-400 to-pink-400',
    background: 'bg-[#080d19]',
    card: 'bg-[#111827]/95',
    cardHover: 'hover:bg-[#1f2937]',
    border: 'border-slate-700/80',
    borderLight: 'border-slate-700/60',
    text: 'text-slate-50',
    textSecondary: 'text-slate-300',
    accent: 'text-violet-300',
    button: 'from-violet-500 via-fuchsia-500 to-pink-500',
    shadow: 'shadow-2xl shadow-violet-500/20',
    emoji: '🌙',
    logo: 'text-white',
    avatar: 'from-violet-500 to-fuchsia-600',
    userCard: 'border-slate-700/70 hover:border-violet-400/70',
    inputBg: 'bg-[#172033]',
  },
  light: {
    name: 'Light',
    primary: 'from-sky-400 via-blue-500 to-cyan-500',
    primaryLight: 'from-sky-300 via-blue-400 to-cyan-400',
    background: 'bg-gradient-to-br from-sky-50 via-white to-blue-50',
    card: 'bg-white/90 backdrop-blur-sm',
    cardHover: 'hover:bg-sky-50/80',
    border: 'border-sky-200',
    text: 'text-slate-900',
    textSecondary: 'text-slate-600',
    accent: 'text-blue-600',
    button: 'from-sky-400 via-blue-500 to-cyan-500',
    shadow: 'shadow-xl shadow-blue-400/20',
    avatar: 'from-sky-400 to-blue-600',
    userCard: 'border-sky-100 hover:border-sky-300',
    inputBg: 'bg-white',
    logo: 'bg-gradient-to-r from-sky-500 to-blue-600 bg-clip-text text-transparent',
    emoji: '☀️'
  }
}

export const ThemeProvider = ({ children }) => {
  const [currentTheme, setCurrentTheme] = useState(() => {
    const saved = localStorage.getItem('theme')
    return themes[saved] ? saved : 'purple'
  })

  useEffect(() => {
    localStorage.setItem('theme', currentTheme)
    document.documentElement.setAttribute('data-theme', currentTheme)
    document.documentElement.classList.toggle('dark', currentTheme === 'dark')
    document.documentElement.style.colorScheme = currentTheme === 'dark' ? 'dark' : 'light'
  }, [currentTheme])

  const theme = themes[currentTheme] || themes.purple

  return (
    <ThemeContext.Provider value={{ currentTheme, setCurrentTheme, theme, themes }}>
      {children}
    </ThemeContext.Provider>
  )
}

export const useTheme = () => {
  const context = useContext(ThemeContext)
  if (!context) throw new Error('useTheme must be used within ThemeProvider')
  return context
}