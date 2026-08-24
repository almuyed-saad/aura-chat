import React, { useState } from 'react'
import toast from 'react-hot-toast'
import apiClient from '../api/client'
import { useTheme } from '../context/ThemeContext'

const GroupCreateModal = ({ users, onClose, onCreated }) => {
  const { theme } = useTheme()
  const isDark = theme.name === 'Dark'
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [memberIds, setMemberIds] = useState([])
  const [saving, setSaving] = useState(false)

  const fieldClass = `w-full rounded-xl border px-3 py-2 text-sm outline-none transition focus:ring-2 focus:ring-primary-500/40 ${isDark
    ? 'border-white/20 bg-[#1a1a1a] text-white placeholder:text-gray-400 focus:border-primary-400'
    : 'border-slate-300 bg-white text-slate-900 placeholder:text-slate-500 focus:border-primary-500'}`

  const toggleMember = (userId) => {
    setMemberIds(previous => previous.includes(userId)
      ? previous.filter(id => id !== userId)
      : [...previous, userId]
    )
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    if (name.trim().length < 2) return toast.error('Group name must be at least 2 characters')
    setSaving(true)
    try {
      const response = await apiClient.post('/api/groups', { name, description, memberIds })
      onCreated(response.data)
      onClose()
    } catch (error) {
      toast.error(error.response?.data?.error || 'Could not create group')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[80] bg-black/50 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-label="Create group">
      <form onSubmit={handleSubmit} className={`w-full max-w-md rounded-2xl ${theme.card} ${isDark ? 'border border-white/15' : 'border border-slate-200'} p-5 shadow-2xl space-y-4`}>
        <div className={`flex items-center justify-between border-b pb-3 ${isDark ? 'border-white/15' : 'border-slate-200'}`}>
          <h2 className={`text-lg font-semibold ${theme.text}`}>Create group</h2>
          <button type="button" onClick={onClose} className={`rounded-lg p-1 ${isDark ? 'text-gray-400 hover:bg-white/10 hover:text-white' : 'text-slate-500 hover:bg-slate-100 hover:text-slate-900'}`} aria-label="Close">✕</button>
        </div>
        <label className="block">
          <span className={`mb-1 block text-xs font-medium ${theme.textSecondary}`}>Group name</span>
          <input value={name} onChange={event => setName(event.target.value)} maxLength={80} required placeholder="Enter a group name" className={fieldClass} />
        </label>
        <label className="block">
          <span className={`mb-1 block text-xs font-medium ${theme.textSecondary}`}>Details</span>
          <textarea value={description} onChange={event => setDescription(event.target.value)} maxLength={500} placeholder="Add a description (optional)" className={fieldClass} rows={3} />
        </label>
        <div>
          <p className={`text-sm font-medium ${theme.text} mb-2`}>Add members</p>
          <div className={`max-h-40 overflow-y-auto space-y-1 rounded-xl border p-1 ${isDark ? 'border-white/15 bg-black/20' : 'border-slate-200 bg-slate-50'}`}>
            {users.map(user => (
              <label key={user._id} className={`flex items-center gap-2 rounded-lg px-2 py-1.5 cursor-pointer ${isDark ? 'hover:bg-white/10' : 'hover:bg-white'}`}>
                <input type="checkbox" checked={memberIds.includes(user._id)} onChange={() => toggleMember(user._id)} className={`h-4 w-4 rounded accent-primary-500 ${isDark ? 'border-white/30 bg-[#1a1a1a]' : 'border-slate-300 bg-white'}`} />
                <span className={`text-sm ${theme.text}`}>{user.name}</span>
              </label>
            ))}
          </div>
        </div>
        <div className={`flex justify-end gap-2 border-t pt-3 ${isDark ? 'border-white/15' : 'border-slate-200'}`}>
          <button type="button" onClick={onClose} className={`rounded-xl px-4 py-2 text-sm font-medium ${isDark ? 'text-gray-300 hover:bg-white/10' : 'text-slate-600 hover:bg-slate-100'}`}>Cancel</button>
          <button type="submit" disabled={saving} className="rounded-xl bg-primary-500 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-primary-600 disabled:opacity-50">{saving ? 'Creating…' : 'Create group'}</button>
        </div>
      </form>
    </div>
  )
}

export default GroupCreateModal
