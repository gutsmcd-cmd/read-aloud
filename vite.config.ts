import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  base: './',
  plugins: [
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icon.svg', 'icons/*.png'],
      manifest: {
        id: '/read-aloud/',
        name: '読みきかせ',
        short_name: '読みきかせ',
        description: '文章・PDF・ウェブページを声で読み上げる。Your phone reads text, PDFs and web pages out loud.',
        lang: 'ja',
        start_url: './',
        scope: './',
        display: 'standalone',
        orientation: 'any',
        share_target: { action: './', method: 'GET', params: { title: 'title', text: 'text', url: 'url' } },
        background_color: '#f6f1e7',
        theme_color: '#1c3d32',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: 'icons/icon-maskable-192.png', sizes: '192x192', type: 'image/png', purpose: 'maskable' },
          { src: 'icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,webmanifest,mjs}'],
        navigateFallback: 'index.html',
        cleanupOutdatedCaches: true,
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
      },
    }),
  ],
})
