import { useEffect, useCallback } from 'react'
import { API_URL } from '../config'

const VAPID_PUBLIC_KEY = 'BGQWfUUj9JMFkTuiswqbjf3iDQKdD88Ppe7YsuYDmPI6IJ_Fm8ilGv01wGrnIFQ9H9EKm6i2zFD7ntBxZhFVj4E'

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

// Does the actual subscribe + save-to-backend work. Separated from
// enableNotifications so it can run WITHOUT requesting permission first -
// browsers allow subscribing silently if permission is already granted,
// no fresh user click required for that part.
async function subscribeAndSave() {
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
}

export const useNotifications = () => {
  // ✅ NEW: if permission was already granted in a PAST session, silently
  // re-subscribe on every app load. This is what fixes the gap where
  // permission=granted but the actual subscription got deleted server-side
  // (e.g. by our stale-subscription cleanup) - previously there was no way
  // to recover from that state since the banner only shows when permission
  // is still unset, so a granted-but-unsubscribed user had no path back in.
  useEffect(() => {
    if (!('Notification' in window) || !('serviceWorker' in navigator)) return
    if (Notification.permission === 'granted') {
      subscribeAndSave()
    }
  }, [])

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

    return subscribeAndSave()
  }, [])

  return { enableNotifications }
}