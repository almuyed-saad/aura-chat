// import { precacheAndRoute } from 'workbox-precaching'
// precacheAndRoute(self.__WB_MANIFEST || [])

self.addEventListener('install', () => {
  console.log('[SW] Installed')
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  console.log('[SW] Activated')
  event.waitUntil(self.clients.claim())
})

self.addEventListener('push', (event) => {
  let data = {}
  try {
    data = event.data ? event.data.json() : {}
  } catch (e) {
    data = { title: 'New message', body: event.data ? event.data.text() : '' }
  }

  const title = data.title || 'New message'
  const options = {
    body: data.body || '',
    icon: '/icons/icon-192.png',
    badge: '/icons/icon-192.png',
    tag: data.senderId || 'chateau-message',
    renotify: true,
    data: {
      senderId: data.senderId || null,
      url: data.url || '/'
    },
    vibrate: [100, 50, 100]
  }

  event.waitUntil(self.registration.showNotification(title, options))
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const targetUrl = event.notification.data?.url || '/'

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          client.postMessage({ type: 'NOTIFICATION_CLICK', senderId: event.notification.data?.senderId })
          return client.focus()
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl)
      }
    })
  )
})