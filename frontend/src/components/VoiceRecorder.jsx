import React, { useEffect, useRef, useState } from 'react'
import { FiMic, FiSquare } from 'react-icons/fi'
import toast from 'react-hot-toast'
import { uploadMedia } from '../api/media'

const MAX_RECORDING_SECONDS = 120

const VoiceRecorder = ({ onMediaUpload, disabled }) => {
  const [recording, setRecording] = useState(false)
  const [seconds, setSeconds] = useState(0)
  const [uploading, setUploading] = useState(false)
  const recorderRef = useRef(null)
  const chunksRef = useRef([])
  const streamRef = useRef(null)
  const timerRef = useRef(null)
  const secondsRef = useRef(0)

  useEffect(() => () => {
    clearInterval(timerRef.current)
    streamRef.current?.getTracks().forEach(track => track.stop())
  }, [])

  const stopTracks = () => {
    streamRef.current?.getTracks().forEach(track => track.stop())
    streamRef.current = null
  }

  const stopRecording = () => {
    if (recorderRef.current?.state === 'recording') recorderRef.current.stop()
  }

  const startRecording = async () => {
    if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) {
      toast.error('Voice recording is not supported in this browser')
      return
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus') ? 'audio/webm;codecs=opus' : 'audio/webm'
      const recorder = new MediaRecorder(stream, { mimeType })
      streamRef.current = stream
      recorderRef.current = recorder
      chunksRef.current = []
      secondsRef.current = 0
      setSeconds(0)
      setRecording(true)

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunksRef.current.push(event.data)
      }
      recorder.onstop = async () => {
        clearInterval(timerRef.current)
        setRecording(false)
        stopTracks()
        const blob = new Blob(chunksRef.current, { type: mimeType })
        if (!blob.size) return

        setUploading(true)
        try {
          const file = new File([blob], `voice-note-${Date.now()}.webm`, { type: mimeType })
          const attachment = await uploadMedia(file)
          onMediaUpload({ ...attachment, duration: secondsRef.current })
          toast.success('Voice note ready')
        } catch (error) {
          toast.error(error.message || 'Voice note upload failed')
        } finally {
          setUploading(false)
        }
      }
      recorder.start()
      timerRef.current = setInterval(() => {
        setSeconds(previous => {
          const next = previous + 1
          secondsRef.current = next
          if (next >= MAX_RECORDING_SECONDS) stopRecording()
          return next
        })
      }, 1000)
    } catch {
      toast.error('Microphone permission is required')
      stopTracks()
    }
  }

  return (
    <button
      type="button"
      onClick={recording ? stopRecording : startRecording}
      disabled={disabled || uploading}
      title={recording ? 'Stop recording' : 'Record voice note'}
      aria-label={recording ? 'Stop recording' : 'Record voice note'}
      className={`p-2 rounded-xl transition-all ${recording ? 'text-red-500 bg-red-50 dark:bg-red-900/20' : 'text-light-text-secondary dark:text-dark-text-secondary hover:bg-light-card dark:hover:bg-dark-card'} disabled:opacity-50`}
    >
      {uploading ? <span className="text-xs">…</span> : recording ? <span className="flex items-center gap-1"><FiSquare className="w-4 h-4" /><span className="text-[10px] tabular-nums">{seconds}s</span></span> : <FiMic className="w-5 h-5" />}
    </button>
  )
}

export default VoiceRecorder
