import React, { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { FiX } from 'react-icons/fi'
import { AVATAR_OPTIONS } from '../data/avatarOptions'
import Avatar from './Avatar'
import axios from 'axios'
import toast from 'react-hot-toast'
import { API_URL } from '../config'

// Lets the user pick one of 10 preset avatars and set a nickname shown in chat.
// Saves to the database (not just localStorage) so it survives refresh/logout.
const ProfileModal = ({ user, onClose, onSaved, theme, isDark }) => {
  const [nickname, setNickname] = useState(user?.name || '')
  const [selectedAvatar, setSelectedAvatar] = useState(user?.avatar || '')
  const [saving, setSaving] = useState(false)

  const handleSave = async () => {
    if (!nickname.trim()) {
      toast.error('Nickname cannot be empty')
      return
    }

    setSaving(true)
    try {
      const token = localStorage.getItem('token')
      const response = await axios.patch(
        `${API_URL}/api/users/profile`,
        { name: nickname.trim(), avatar: selectedAvatar },
        { headers: { Authorization: `Bearer ${token}` } }
      )

      // Persist to localStorage so it survives refresh, and update React state
      const updatedUser = { ...user, name: response.data.name, avatar: response.data.avatar }
      localStorage.setItem('user', JSON.stringify(updatedUser))
      onSaved(updatedUser)

      toast.success('Profile updated!')
      onClose()
    } catch (error) {
      console.error('Profile update error:', error)
      toast.error('Failed to update profile')
    } finally {
      setSaving(false)
    }
  }

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/60 z-[200] flex items-center justify-center p-4"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.9, opacity: 0 }}
          onClick={(e) => e.stopPropagation()}
          className={`w-full max-w-md rounded-2xl p-5 sm:p-6 ${isDark ? 'bg-[#111827] border border-slate-700/80' : 'bg-white border border-gray-200'}`}
        >
          <div className="flex items-center justify-between mb-5">
            <h2 className={`text-lg font-heading font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
              Edit Profile
            </h2>
            <button
              onClick={onClose}
              className={`p-1.5 rounded-full ${isDark ? 'text-slate-300 hover:text-white hover:bg-white/10' : 'text-slate-500 hover:text-slate-950 hover:bg-slate-100'}`}
            >
              <FiX className="w-5 h-5" />
            </button>
          </div>

          {/* Current avatar preview */}
          <div className="flex justify-center mb-5">
            <Avatar
              user={{ name: nickname, avatar: selectedAvatar }}
              size="lg"
              theme={theme}
              isDark={isDark}
            />
          </div>

          {/* Avatar picker grid */}
          <p className={`text-xs font-medium mb-2 ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
            Choose an avatar
          </p>
          <div className="grid grid-cols-5 gap-2 mb-5">
            {AVATAR_OPTIONS.map((opt) => (
              <button
                key={opt.id}
                onClick={() => setSelectedAvatar(opt.id)}
                className={`aspect-square rounded-xl bg-gradient-to-r ${opt.gradient} flex items-center justify-center text-xl transition
                  ${selectedAvatar === opt.id ? 'ring-2 ring-offset-2 ring-primary-500 ring-offset-transparent scale-105' : 'opacity-80 hover:opacity-100'}`}
              >
                {opt.emoji}
              </button>
            ))}
          </div>

          {/* Nickname input */}
          <p className={`text-xs font-medium mb-2 ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
            Nickname (shown in chats)
          </p>
          <input
            type="text"
            value={nickname}
            onChange={(e) => setNickname(e.target.value)}
            maxLength={20}
            placeholder="Your display name"
            className={`w-full px-3 py-2.5 rounded-xl border mb-5 ${isDark ? 'bg-[#172033] border-slate-600 text-slate-50 placeholder:text-slate-300' : 'bg-gray-50 border-gray-200 text-gray-900'} focus:outline-none focus:ring-2 focus:ring-primary-500`}
          />

          <div className="flex gap-2">
            <button
              onClick={onClose}
              className={`flex-1 py-2.5 rounded-xl font-medium text-sm ${isDark ? 'bg-slate-800 text-slate-50 hover:bg-slate-700' : 'bg-slate-100 text-slate-800 hover:bg-slate-200'} transition`}
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className={`flex-1 py-2.5 rounded-xl font-medium text-sm bg-gradient-to-r ${theme.button} text-white disabled:opacity-50 transition`}
            >
              {saving ? 'Saving...' : 'Save'}
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}

export default ProfileModal