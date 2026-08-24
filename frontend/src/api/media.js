import axios from 'axios'
import { CLOUDINARY_CLOUD_NAME, CLOUDINARY_UPLOAD_PRESET } from '../config'

export const MEDIA_LIMITS = {
  image: 10 * 1024 * 1024,
  video: 25 * 1024 * 1024,
  audio: 10 * 1024 * 1024,
  raw: 10 * 1024 * 1024
}

const documentTypes = new Set([
  'application/pdf',
  'text/plain',
  'application/rtf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation'
])

export const getResourceType = (mimeType = '') => {
  if (mimeType.startsWith('image/')) return 'image'
  if (mimeType.startsWith('video/')) return 'video'
  if (mimeType.startsWith('audio/')) return 'audio'
  if (documentTypes.has(mimeType)) return 'raw'
  return null
}

export const validateMediaFile = (file) => {
  const resourceType = getResourceType(file?.type)
  if (!resourceType) return { valid: false, message: 'This file type is not supported' }
  if (file.size > MEDIA_LIMITS[resourceType]) {
    const limitMb = MEDIA_LIMITS[resourceType] / (1024 * 1024)
    return { valid: false, message: `This file must be ${limitMb}MB or smaller` }
  }
  return { valid: true, resourceType }
}

export const uploadMedia = async (file) => {
  const validation = validateMediaFile(file)
  if (!validation.valid) throw new Error(validation.message)
  if (!CLOUDINARY_CLOUD_NAME || !CLOUDINARY_UPLOAD_PRESET) {
    throw new Error('Media upload is not configured')
  }

  const formData = new FormData()
  formData.append('file', file)
  formData.append('upload_preset', CLOUDINARY_UPLOAD_PRESET)

  const cloudinaryResourceType = validation.resourceType === 'image'
    ? 'image'
    : validation.resourceType === 'raw'
      ? 'raw'
      : 'video'
  const response = await axios.post(
    `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/${cloudinaryResourceType}/upload`,
    formData,
    { headers: { 'Content-Type': 'multipart/form-data' } }
  )

  return {
    url: response.data.secure_url,
    publicId: response.data.public_id,
    resourceType: validation.resourceType,
    mimeType: file.type,
    fileName: file.name,
    fileSize: file.size,
    duration: response.data.duration || null,
    width: response.data.width || null,
    height: response.data.height || null
  }
}
