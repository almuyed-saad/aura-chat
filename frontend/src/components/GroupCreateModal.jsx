import React, { useState } from 'react'
import toast from 'react-hot-toast'
import apiClient from '../api/client'

const GroupCreateModal = ({ users, onClose, onCreated }) => {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [memberIds, setMemberIds] = useState([])
  const [saving, setSaving] = useState(false)

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
      <form onSubmit={handleSubmit} className="w-full max-w-md rounded-2xl bg-white dark:bg-dark-surface p-5 shadow-2xl space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-dark-bg dark:text-white">Create group</h2>
          <button type="button" onClick={onClose} className="text-gray-400 hover:text-gray-700 dark:hover:text-white" aria-label="Close">✕</button>
        </div>
        <input value={name} onChange={event => setName(event.target.value)} maxLength={80} required placeholder="Group name" className="w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-transparent px-3 py-2 text-sm" />
        <textarea value={description} onChange={event => setDescription(event.target.value)} maxLength={500} placeholder="Description (optional)" className="w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-transparent px-3 py-2 text-sm" rows={3} />
        <div>
          <p className="text-sm font-medium text-dark-bg dark:text-white mb-2">Add members</p>
          <div className="max-h-40 overflow-y-auto space-y-1">
            {users.map(user => (
              <label key={user._id} className="flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-gray-100 dark:hover:bg-gray-800 cursor-pointer">
                <input type="checkbox" checked={memberIds.includes(user._id)} onChange={() => toggleMember(user._id)} />
                <span className="text-sm text-dark-bg dark:text-white">{user.name}</span>
              </label>
            ))}
          </div>
        </div>
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded-xl px-4 py-2 text-sm text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800">Cancel</button>
          <button type="submit" disabled={saving} className="rounded-xl bg-primary-500 px-4 py-2 text-sm text-white disabled:opacity-50">{saving ? 'Creating…' : 'Create group'}</button>
        </div>
      </form>
    </div>
  )
}

export default GroupCreateModal
