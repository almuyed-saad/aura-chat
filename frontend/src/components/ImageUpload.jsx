import React, { useRef, useState } from 'react'
import { FiImage, FiX } from 'react-icons/fi'
import toast from 'react-hot-toast'
import axios from 'axios'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000'

const ImageUpload = ({ onImageUpload, disabled }) => {
  const [uploading, setUploading] = useState(false)
  const fileInputRef = useRef(null)

  const handleImageSelect = async (e) => {
    const file = e.target.files[0]
    if (!file) return

    // Validate file type
    const validTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp']
    if (!validTypes.includes(file.type)) {
      toast.error('Please upload a valid image (JPEG, PNG, GIF, WEBP)')
      return
    }

    // Validate file size (10MB max)
    if (file.size > 10 * 1024 * 1024) {
      toast.error('Image must be less than 10MB')
      return
    }

    setUploading(true)

    const formData = new FormData()
    formData.append('image', file)

    try {
      const token = localStorage.getItem('token')
      const response = await axios.post(`${API_URL}/api/upload/image`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
          Authorization: `Bearer ${token}`
        }
      })

      onImageUpload(response.data.imageUrl, response.data.imagePublicId)
      toast.success('Image uploaded!')
    } catch (error) {
      console.error('Upload error:', error)
      toast.error('Failed to upload image')
    } finally {
      setUploading(false)
      fileInputRef.current.value = ''
    }
  }

  return (
    <div>
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleImageSelect}
        accept="image/*"
        className="hidden"
        disabled={disabled || uploading}
      />
      <button
        type="button"
        onClick={() => fileInputRef.current?.click()}
        disabled={disabled || uploading}
        className={`p-2 rounded-xl transition-all ${
          disabled || uploading
            ? 'opacity-50 cursor-not-allowed'
            : 'hover:bg-light-card dark:hover:bg-dark-card'
        }`}
        title="Upload image"
      >
        {uploading ? (
          <div className="w-5 h-5 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
        ) : (
          <FiImage className="w-5 h-5 text-light-text-secondary dark:text-dark-text-secondary" />
        )}
      </button>
    </div>
  )
}

export default ImageUpload