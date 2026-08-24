import React, { useState } from 'react'
import toast from 'react-hot-toast'
import apiClient from '../api/client'

const SafetyActions = ({ user }) => {
  const [blocked, setBlocked] = useState(false)

  const toggleBlock = async () => {
    try {
      if (blocked) {
        await apiClient.delete(`/api/safety/blocks/${user._id}`)
        setBlocked(false)
        toast.success('User unblocked')
      } else {
        await apiClient.post(`/api/safety/blocks/${user._id}`)
        setBlocked(true)
        toast.success('User blocked')
      }
    } catch (error) {
      toast.error(error.response?.data?.error || 'Could not update block status')
    }
  }

  const reportUser = async () => {
    const reason = window.prompt('Reason: spam, harassment, abuse, illegal, or other', 'other')
    if (!reason) return
    const normalizedReason = reason.trim().toLowerCase()
    if (!['spam', 'harassment', 'abuse', 'illegal', 'other'].includes(normalizedReason)) {
      toast.error('Invalid report reason')
      return
    }
    try {
      await apiClient.post('/api/safety/reports', { targetUserId: user._id, reason: normalizedReason })
      toast.success('Report submitted')
    } catch (error) {
      toast.error(error.response?.data?.error || 'Could not submit report')
    }
  }

  return (
    <div className="flex items-center gap-1">
      <button type="button" onClick={toggleBlock} className="rounded-lg px-2 py-1 text-xs text-orange-500 hover:bg-orange-50 dark:hover:bg-orange-900/20" title={blocked ? 'Unblock user' : 'Block user'}>{blocked ? 'Unblock' : 'Block'}</button>
      <button type="button" onClick={reportUser} className="rounded-lg px-2 py-1 text-xs text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20" title="Report user">Report</button>
    </div>
  )
}

export default SafetyActions
