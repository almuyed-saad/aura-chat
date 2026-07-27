import React from 'react'
import { getAvatarById } from '../data/avatarOptions'

// Reusable avatar circle - shows the chosen emoji avatar if the user has
// picked one, otherwise falls back to their name's first letter (old behavior).
// Use this everywhere an avatar circle currently renders (navbar, sidebar,
// chat header) so avatar choice shows up consistently across the whole app.
const SIZES = {
  sm: 'w-8 h-8 sm:w-9 sm:h-9 text-sm sm:text-base',
  md: 'w-9 h-9 sm:w-10 sm:h-10 text-base sm:text-lg',
  lg: 'w-16 h-16 sm:w-20 sm:h-20 text-3xl sm:text-4xl'
}

const Avatar = ({ user, size = 'md', theme, isDark, className = '' }) => {
  const preset = user?.avatar ? getAvatarById(user.avatar) : null
  const sizeClasses = SIZES[size] || SIZES.md

  if (preset) {
    return (
      <div
        className={`${sizeClasses} rounded-full bg-gradient-to-r ${preset.gradient} flex items-center justify-center border ${isDark ? 'border-white/30' : 'border-white/50'} ${className}`}
      >
        <span>{preset.emoji}</span>
      </div>
    )
  }

  // Fallback: first letter of name, same as the original design
  return (
    <div
      className={`${sizeClasses} rounded-full bg-gradient-to-r ${isDark ? 'from-gray-600 to-gray-800' : theme?.primary || 'from-primary-500 to-purple-600'} flex items-center justify-center text-white font-semibold border ${isDark ? 'border-white/30' : 'border-white/50'} ${className}`}
    >
      {user?.name?.charAt(0)?.toUpperCase() || 'U'}
    </div>
  )
}

export default Avatar