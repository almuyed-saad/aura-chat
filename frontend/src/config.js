// ===== API CONFIGURATION =====
// This file centralizes all API URLs so you only need to change one place

export const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000'
export const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || API_URL
export const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY || ''
export const CLOUDINARY_CLOUD_NAME = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME || ''
export const CLOUDINARY_UPLOAD_PRESET = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET || ''
export const CLOUDINARY_UPLOAD_URL = CLOUDINARY_CLOUD_NAME
  ? `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`
  : ''
