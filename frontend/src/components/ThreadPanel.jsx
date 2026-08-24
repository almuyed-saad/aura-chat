import React, { useEffect, useState } from 'react'
import { FiX } from 'react-icons/fi'
import apiClient from '../api/client'

const ThreadPanel = ({ rootMessage, onClose, onReply }) => {
  const [messages, setMessages] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true
    apiClient.get(`/api/messages/${rootMessage._id}/thread`)
      .then(response => { if (active) setMessages(response.data || []) })
      .catch(() => {})
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [rootMessage._id])

  return (
    <div className="fixed inset-y-0 right-0 z-[75] w-full sm:w-96 bg-white dark:bg-dark-surface border-l border-gray-200 dark:border-gray-700 shadow-2xl flex flex-col" role="dialog" aria-label="Message thread">
      <div className="flex items-center gap-2 p-4 border-b border-gray-200 dark:border-gray-700"><h2 className="font-semibold text-dark-bg dark:text-white flex-1">Thread</h2><button type="button" onClick={onClose} aria-label="Close thread"><FiX /></button></div>
      <div className="p-4 border-b border-gray-200 dark:border-gray-700 text-sm text-dark-bg dark:text-white"><p className="font-medium">{rootMessage.sender?.name || 'Message'}</p><p className="mt-1 text-gray-600 dark:text-gray-300 break-words">{rootMessage.text || 'Attachment'}</p></div>
      <div className="flex-1 overflow-y-auto p-4 space-y-3">{loading ? <p className="text-sm text-gray-500">Loading thread…</p> : messages.slice(1).map(message => <div key={message._id} className="rounded-xl bg-gray-100 dark:bg-gray-800 p-3"><p className="text-xs font-medium text-gray-500">{message.sender?.name || 'Member'}</p><p className="text-sm text-dark-bg dark:text-white mt-1 break-words">{message.text || 'Attachment'}</p></div>)}</div>
      <button type="button" onClick={() => { onReply(rootMessage); onClose() }} className="m-4 rounded-xl bg-primary-500 px-4 py-2 text-sm text-white">Reply in thread</button>
    </div>
  )
}

export default ThreadPanel
