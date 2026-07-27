import { useEffect, useCallback } from 'react'
import { API_URL } from '../config'

const API_URL = `${API_URL}/api/push/subscribe`

const VAPID_PUBLIC_KEY = 'BMBSOYrxtcg6jmxYBdVAwKlY9IPVfZ-fflePibP3apHwsWvLQanT0wEh9YowCVIwOrqdIci2P67LEaxFG794Maw'

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = window.atob(base64)
  const outputArray = new Uint8Array(rawData.length)
  for (let i = 0; i < rawData.length; i++) {
    outputArray[i] = rawData.charCodeAt(i)
  }
  return outputArray
}

export const useNotifications = () => {
//   useEffect(() => {
//     if ('serviceWorker' in navigator) {
//       navigator.serviceWorker.register('/sw.js')
//         .then(reg => console.log('✅ Service worker registered:', reg.scope))
//         .catch(err => console.error('❌ Service worker registration failed:', err))
//     }
//   }, [])

  const enableNotifications = useCallback(async () => {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      console.warn('Push notifications not supported in this browser')
      return false
    }

    const permission = await Notification.requestPermission()
    if (permission !== 'granted') {
      console.log('🔕 Notification permission denied')
      return false
    }

    try {
      const registration = await navigator.serviceWorker.ready

      let subscription = await registration.pushManager.getSubscription()
      if (!subscription) {
        subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY)
        })
      }

      const token = localStorage.getItem('token')
      await fetch(`${API_URL}/api/push/subscribe`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(subscription.toJSON())
      })

      console.log('✅ Push subscription saved')
      return true
    } catch (error) {
      console.error('❌ Failed to subscribe to push:', error)
      return false
    }
  }, [])

  return { enableNotifications }
}