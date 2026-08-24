import React, { useMemo, useState } from 'react'
import toast from 'react-hot-toast'
import apiClient from '../api/client'

const GroupSettingsModal = ({ group, users, currentUserId, onClose, onUpdated }) => {
  const [name, setName] = useState(group.name)
  const [description, setDescription] = useState(group.description || '')
  const [memberId, setMemberId] = useState('')
  const [saving, setSaving] = useState(false)
  const membership = group.members?.find(member => String(member.user?._id || member.user) === String(currentUserId))
  const canManage = membership?.role === 'owner' || membership?.role === 'admin'
  const memberIds = useMemo(() => new Set((group.members || []).map(member => String(member.user?._id || member.user))), [group.members])
  const availableUsers = users.filter(user => !memberIds.has(String(user._id)))

  const saveDetails = async (event) => {
    event.preventDefault()
    setSaving(true)
    try {
      await apiClient.patch(`/api/groups/${group._id}`, { name, description })
      const response = await apiClient.get('/api/groups')
      onUpdated(response.data.find(item => item._id === group._id) || group)
      toast.success('Group updated')
    } catch (error) {
      toast.error(error.response?.data?.error || 'Could not update group')
    } finally {
      setSaving(false)
    }
  }

  const addMember = async () => {
    if (!memberId) return
    try {
      await apiClient.post(`/api/groups/${group._id}/members`, { userId: memberId })
      const response = await apiClient.get('/api/groups')
      onUpdated(response.data.find(item => item._id === group._id) || group)
      setMemberId('')
      toast.success('Member added')
    } catch (error) {
      toast.error(error.response?.data?.error || 'Could not add member')
    }
  }

  const updateRole = async (userId, role) => {
    try {
      await apiClient.patch(`/api/groups/${group._id}/members/${userId}/role`, { role })
      const response = await apiClient.get('/api/groups')
      onUpdated(response.data.find(item => item._id === group._id) || group)
      toast.success('Role updated')
    } catch (error) {
      toast.error(error.response?.data?.error || 'Could not update role')
    }
  }

  const removeMember = async (userId) => {
    try {
      await apiClient.delete(`/api/groups/${group._id}/members/${userId}`)
      const response = await apiClient.get('/api/groups')
      onUpdated(response.data.find(item => item._id === group._id) || group)
      toast.success('Member removed')
    } catch (error) {
      toast.error(error.response?.data?.error || 'Could not remove member')
    }
  }

  return (
    <div className="fixed inset-0 z-[80] bg-black/50 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-label="Group settings">
      <div className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl bg-white dark:bg-dark-surface p-5 shadow-2xl space-y-5">
        <div className="flex items-center justify-between"><h2 className="text-lg font-semibold text-dark-bg dark:text-white">Group settings</h2><button type="button" onClick={onClose} className="text-gray-400">✕</button></div>
        <form onSubmit={saveDetails} className="space-y-3">
          <input value={name} onChange={event => setName(event.target.value)} disabled={!canManage} maxLength={80} className="w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-transparent px-3 py-2 text-sm" />
          <textarea value={description} onChange={event => setDescription(event.target.value)} disabled={!canManage} maxLength={500} rows={3} className="w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-transparent px-3 py-2 text-sm" />
          {canManage && <button type="submit" disabled={saving} className="rounded-xl bg-primary-500 px-4 py-2 text-sm text-white disabled:opacity-50">{saving ? 'Saving…' : 'Save details'}</button>}
        </form>
        {canManage && <div className="border-t border-gray-200 dark:border-gray-700 pt-4"><p className="text-sm font-semibold text-dark-bg dark:text-white mb-2">Add member</p><div className="flex gap-2"><select value={memberId} onChange={event => setMemberId(event.target.value)} className="flex-1 rounded-xl border border-gray-200 dark:border-gray-700 bg-transparent px-3 py-2 text-sm"><option value="">Select a user</option>{availableUsers.map(user => <option key={user._id} value={user._id}>{user.name}</option>)}</select><button type="button" onClick={addMember} className="rounded-xl bg-primary-500 px-3 py-2 text-sm text-white">Add</button></div></div>}
        <div className="border-t border-gray-200 dark:border-gray-700 pt-4"><p className="text-sm font-semibold text-dark-bg dark:text-white mb-2">Members</p><div className="space-y-2">{(group.members || []).map(member => <div key={member.user?._id || member.user} className="flex items-center gap-2"><span className="flex-1 text-sm text-dark-bg dark:text-white">{member.user?.name || 'Member'} <span className="text-xs text-gray-500">({member.role})</span></span>{canManage && member.role !== 'owner' && <span className="flex items-center gap-2"><button type="button" onClick={() => updateRole(member.user?._id || member.user, member.role === 'admin' ? 'member' : 'admin')} className="text-xs text-primary-500">{member.role === 'admin' ? 'Demote' : 'Promote'}</button><button type="button" onClick={() => removeMember(member.user?._id || member.user)} className="text-xs text-red-500">Remove</button></span>}
</div>)}</div></div>
        {!canManage && <p className="text-xs text-gray-500">Only group owners and admins can change group settings.</p>}
      </div>
    </div>
  )
}

export default GroupSettingsModal
