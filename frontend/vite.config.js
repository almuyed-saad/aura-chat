import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.js',
      registerType: 'autoUpdate',
        devOptions: {
    enabled: true          // ✅ new - makes the SW work during npm run dev
  },
      injectManifest: {
        injectionPoint: undefined
      },
      includeAssets: ['favicon.ico', 'robots.txt', 'icons/*.png'],
      manifest: {
          name: 'Aura - Premium Chat',
  short_name: 'Aura',
        description: 'A premium, private chat app',
        theme_color: '#8b5cf6',
        background_color: '#0a0a0a',
        display: 'standalone',
        icons: [
          { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' }
        ]
      }
    })
  ],
  server: {
    port: 5173
  }
})