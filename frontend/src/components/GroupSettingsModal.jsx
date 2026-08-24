import React, { useMemo, useState } from 'react'
import toast from 'react-hot-toast'
import apiClient from '../api/client'
import { useTheme } from '../context/ThemeContext'
import Avatar from './Avatar'

const GroupSettingsModal = ({ group, users, currentUserId, onClose, onUpdated }) => {
  const { theme } = useTheme()
  const isDark = theme.name === 'Dark'
  const [name, setName] = useState(group.name)
  const [description, setDescription] = useState(group.description || '')
  const [memberId, setMemberId] = useState('')
  const [saving, setSaving] = useState(false)
  const membership = group.members?.find(member => String(member.user?._id || member.user) === String(currentUserId))
  const canManage = membership?.role === 'owner' || membership?.role === 'admin'
  const memberIds = useMemo(() => new Set((group.members || []).map(member => String(member.user?._id || member.user))), [group.members])
  const availableUsers = users.filter(user => !memberIds.has(String(user._id)))

  const fieldClass = `w-full rounded-xl border px-3 py-2 text-sm outline-none transition focus:ring-2 focus:ring-primary-500/40 disabled:cursor-not-allowed disabled:opacity-70 ${isDark
    ? 'border-slate-600 bg-[#172033] text-slate-50 placeholder:text-slate-300 focus:border-violet-300'
    : 'border-slate-300 bg-white text-slate-900 placeholder:text-slate-600 focus:border-primary-500'}`
  const buttonSecondary = isDark ? 'text-slate-300 hover:bg-white/10 hover:text-white' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-950'

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
      <div className={`w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl ${theme.card} ${isDark ? 'border border-slate-700/80' : 'border border-slate-200'} p-5 shadow-2xl space-y-5`}>
        <div className={`flex items-center justify-between border-b pb-3 ${isDark ? 'border-slate-700/80' : 'border-slate-200'}`}>
          <h2 className={`text-lg font-semibold ${theme.text}`}>Group settings</h2>
          <button type="button" onClick={onClose} className={`rounded-lg p-1 ${buttonSecondary}`} aria-label="Close">✕</button>
        </div>
        <form onSubmit={saveDetails} className="space-y-3">
          <label className="block"><span className={`mb-1 block text-xs font-medium ${theme.textSecondary}`}>Group name</span><input value={name} onChange={event => setName(event.target.value)} disabled={!canManage} maxLength={80} className={fieldClass} /></label>
          <label className="block"><span className={`mb-1 block text-xs font-medium ${theme.textSecondary}`}>Details</span><textarea value={description} onChange={event => setDescription(event.target.value)} disabled={!canManage} maxLength={500} rows={3} className={fieldClass} /></label>
          {canManage && <button type="submit" disabled={saving} className="rounded-xl bg-primary-500 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-primary-600 disabled:opacity-50">{saving ? 'Saving…' : 'Save details'}</button>}
        </form>
        {canManage && <div className={`border-t pt-4 ${isDark ? 'border-slate-700/80' : 'border-slate-200'}`}><p className={`text-sm font-semibold ${theme.text} mb-2`}>Add member</p><div className="flex gap-2"><select value={memberId} onChange={event => setMemberId(event.target.value)} style={{ colorScheme: isDark ? 'dark' : 'light' }} className={`${fieldClass} flex-1`}><option value="">Select a user</option>{availableUsers.map(user => <option key={user._id} value={user._id}>{user.name}</option>)}</select><button type="button" onClick={addMember} disabled={!memberId} className="rounded-xl bg-primary-500 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-primary-600 disabled:opacity-50">Add</button></div></div>}
        <div className={`border-t pt-4 ${isDark ? 'border-slate-700/80' : 'border-slate-200'}`}><p className={`text-sm font-semibold ${theme.text} mb-2`}>Members</p><div className="space-y-2">{(group.members || []).map(member => {
          const memberUser = member.user && typeof member.user === 'object' ? member.user : { _id: member.user, name: 'Member' }
          const memberIdValue = memberUser._id || member.user
          return <div key={memberIdValue} className={`flex items-center gap-2 rounded-lg px-2 py-1.5 ${isDark ? 'hover:bg-slate-800/70' : 'hover:bg-slate-50'}`}>
            <Avatar user={memberUser} size="sm" theme={theme} isDark={isDark} className="shrink-0" />
            <span className={`flex-1 min-w-0 text-sm ${theme.text}`}><span className="truncate">{memberUser.name || 'Member'}</span> <span className={`text-xs ${theme.textSecondary}`}>({member.role})</span></span>
            {canManage && member.role !== 'owner' && <span className="flex items-center gap-2"><button type="button" onClick={() => updateRole(memberIdValue, member.role === 'admin' ? 'member' : 'admin')} className={`rounded-md px-2 py-1 text-xs font-medium ${isDark ? 'text-violet-200 hover:bg-violet-900/40' : 'text-violet-700 hover:bg-violet-50'}`}>{member.role === 'admin' ? 'Demote' : 'Promote'}</button><button type="button" onClick={() => removeMember(memberIdValue)} className={`rounded-md px-2 py-1 text-xs font-medium ${isDark ? 'text-rose-300 hover:bg-rose-950/40' : 'text-rose-700 hover:bg-rose-50'}`}>Remove</button></span>}
          </div>
        })}</div></div>
        {!canManage && <p className={`text-xs ${theme.textSecondary}`}>Only group owners and admins can change group settings.</p>}
      </div>
    </div>
  )
}

export default GroupSettingsModal
