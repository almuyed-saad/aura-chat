import React, { useRef, useState } from 'react'
import { FiPaperclip, FiUploadCloud } from 'react-icons/fi'
import toast from 'react-hot-toast'
import { uploadMedia, validateMediaFile } from '../api/media'

const ACCEPTED_FILES = [
  'image/*',
  'video/mp4',
  'video/webm',
  'video/quicktime',
  'audio/*',
  '.pdf',
  '.txt',
  '.rtf',
  '.doc',
  '.docx',
  '.xls',
  '.xlsx',
  '.ppt',
  '.pptx'
].join(',')

const MediaUpload = ({ onMediaUpload, disabled }) => {
  const [uploading, setUploading] = useState(false)
  const [dragging, setDragging] = useState(false)
  const fileInputRef = useRef(null)

  const processFile = async (file) => {
    if (!file || uploading) return
    const validation = validateMediaFile(file)
    if (!validation.valid) {
      toast.error(validation.message)
      return
    }

    setUploading(true)
    try {
      const attachment = await uploadMedia(file)
      onMediaUpload(attachment)
      toast.success('Attachment uploaded')
    } catch (error) {
      toast.error(error.message || 'Attachment upload failed')
    } finally {
      setUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const handleInput = (event) => processFile(event.target.files?.[0])

  const handleDrop = (event) => {
    event.preventDefault()
    setDragging(false)
    processFile(event.dataTransfer.files?.[0])
  }

  return (
    <div
      onDragOver={(event) => { event.preventDefault(); setDragging(true) }}
      onDragLeave={() => setDragging(false)}
      onDrop={handleDrop}
      className={dragging ? 'rounded-xl ring-2 ring-primary-500' : ''}
    >
      <input
        ref={fileInputRef}
        type="file"
        accept={ACCEPTED_FILES}
        onChange={handleInput}
        className="hidden"
        disabled={disabled || uploading}
      />
      <button
        type="button"
        onClick={() => fileInputRef.current?.click()}
        disabled={disabled || uploading}
        className={`p-2 rounded-xl transition-all ${disabled || uploading ? 'opacity-50 cursor-not-allowed' : 'hover:bg-light-card dark:hover:bg-dark-card'}`}
        title="Attach image, video, audio, or document"
        aria-label="Attach file"
      >
        {uploading ? <FiUploadCloud className="w-5 h-5 text-primary-500 animate-pulse" /> : <FiPaperclip className="w-5 h-5 text-light-text-secondary dark:text-dark-text-secondary" />}
      </button>
    </div>
  )
}

export default MediaUpload
