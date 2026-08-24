import React, { useEffect, useRef, useState } from 'react'
import apiClient from '../api/client'
import toast from 'react-hot-toast'

const AIAssist = ({ messages, draft, onDraftChange }) => {
  const [status, setStatus] = useState(null)
  const [busy, setBusy] = useState(false)
  const [replies, setReplies] = useState([])
  const [summary, setSummary] = useState('')
  const [tone, setTone] = useState('friendly')
  const [language, setLanguage] = useState('Spanish')
  const draftRef = useRef(draft)
  const requestIdRef = useRef(0)

  useEffect(() => {
    draftRef.current = draft
  }, [draft])

  useEffect(() => {
    let active = true
    const loadStatus = async () => {
      try {
        const response = await apiClient.get('/api/ai/status')
        if (active) setStatus(response.data)
      } catch {
        if (active) setStatus(null)
      }
    }
    loadStatus()
    return () => { active = false }
  }, [])

  useEffect(() => {
    requestIdRef.current += 1
    setReplies([])
    setSummary('')
    setBusy(false)
  }, [messages])

  const updateConsent = async (enabled) => {
    requestIdRef.current += 1
    setBusy(true)
    try {
      const response = await apiClient.patch('/api/ai/preferences', { enabled })
      setStatus(previous => ({ ...previous, consent: response.data.aiEnabled }))
      if (!enabled) {
        setReplies([])
        setSummary('')
      }
    } catch (error) {
      toast.error(error.response?.data?.error || 'Could not update AI preference')
    } finally {
      setBusy(false)
    }
  }

  const enable = async () => {
    await updateConsent(true)
  }

  const run = async (action) => {
    const requestId = ++requestIdRef.current
    const sourceDraft = draftRef.current
    const sourceMessages = messages
    setBusy(true)
    try {
      if (action === 'replies') {
        const response = await apiClient.post('/api/ai/smart-replies', { messages: sourceMessages })
        if (requestId === requestIdRef.current) setReplies(Array.isArray(response.data.replies) ? response.data.replies : [])
      } else if (action === 'summary') {
        const response = await apiClient.post('/api/ai/summarize', { messages: sourceMessages })
        if (requestId === requestIdRef.current) setSummary(response.data.summary || '')
      } else if (action === 'rewrite') {
        const response = await apiClient.post('/api/ai/rewrite', { text: sourceDraft, tone })
        if (requestId === requestIdRef.current && draftRef.current === sourceDraft) onDraftChange(response.data.text || sourceDraft)
      } else if (action === 'translate') {
        const response = await apiClient.post('/api/ai/translate', { text: sourceDraft, targetLanguage: language })
        if (requestId === requestIdRef.current && draftRef.current === sourceDraft) onDraftChange(response.data.text || sourceDraft)
      }
    } catch (error) {
      if (requestId === requestIdRef.current) toast.error(error.response?.data?.error || error.response?.data?.message || 'AI request failed')
    } finally {
      if (requestId === requestIdRef.current) setBusy(false)
    }
  }

  const hasMessages = Array.isArray(messages) && messages.length > 0
  if (!status?.enabled) return null

  if (!status.consent) return (
    <div className="mb-2 rounded-xl border border-primary-200 dark:border-primary-900/40 bg-primary-50 dark:bg-primary-900/20 px-3 py-2 text-xs text-primary-700 dark:text-primary-200">
      <div className="flex items-center gap-2"><span className="flex-1">AI assistance is optional. Conversation text is sent only after you enable it.</span><button type="button" onClick={enable} disabled={busy} className="rounded-lg bg-primary-500 px-2 py-1 text-white">{busy ? 'Enabling…' : 'Enable'}</button></div>
    </div>
  )

  return (
    <div className="mb-2 rounded-xl border border-gray-200 dark:border-white/10 bg-white/60 dark:bg-white/5 p-2 space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-semibold text-primary-500">AI assist</span>
        <button type="button" disabled={busy} onClick={() => updateConsent(false)} className="ml-auto text-[10px] text-gray-500 hover:text-red-500">Disable</button>
        <button type="button" disabled={busy || !hasMessages} onClick={() => run('replies')} className="rounded-lg px-2 py-1 text-xs bg-primary-50 dark:bg-primary-900/30 text-primary-600 disabled:opacity-50">Smart replies</button>
        <button type="button" disabled={busy || !hasMessages} onClick={() => run('summary')} className="rounded-lg px-2 py-1 text-xs bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-200 disabled:opacity-50">Summarize</button>
        <select value={tone} onChange={event => setTone(event.target.value)} className="rounded-lg border-0 bg-gray-100 dark:bg-gray-800 px-2 py-1 text-xs"><option value="friendly">Friendly</option><option value="professional">Professional</option><option value="concise">Concise</option><option value="empathetic">Empathetic</option></select>
        <button type="button" disabled={busy || !draft.trim()} onClick={() => run('rewrite')} className="rounded-lg px-2 py-1 text-xs bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-200 disabled:opacity-50">Rewrite</button>
        <select value={language} onChange={event => setLanguage(event.target.value)} className="rounded-lg border-0 bg-gray-100 dark:bg-gray-800 px-2 py-1 text-xs"><option>Spanish</option><option>French</option><option>Hindi</option><option>German</option><option>English</option></select>
        <button type="button" disabled={busy || !draft.trim()} onClick={() => run('translate')} className="rounded-lg px-2 py-1 text-xs bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-200 disabled:opacity-50">Translate</button>
      </div>
      {replies.length > 0 && <div className="flex flex-wrap gap-1">{replies.map(reply => <button type="button" key={reply} onClick={() => onDraftChange(reply)} className="rounded-full border border-primary-200 dark:border-primary-800 px-3 py-1 text-xs text-primary-600 dark:text-primary-300 hover:bg-primary-50 dark:hover:bg-primary-900/30">{reply}</button>)}</div>}
      {summary && <p className="text-xs text-gray-600 dark:text-gray-300 border-t border-gray-200 dark:border-white/10 pt-2">{summary}</p>}
    </div>
  )
}

export default AIAssist
