import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

// Configuration PWA :
// - autoUpdate : le SW se met à jour en arrière-plan, prompt de reload léger
// - NetworkFirst sur index.html (garde la dernière version servie)
// - CacheFirst sur assets (JS/CSS/fonts/images) pour usage offline
// - Le mode local (localStorage) fonctionne déjà 100% hors ligne
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg'],
      manifest: {
        name: 'IEF Audit',
        short_name: 'IEF Audit',
        description: "Audit menuiseries & équipements — IEF & CO",
        theme_color: '#0f1117',
        background_color: '#0f1117',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/',
        scope: '/',
        // TODO prod : ajouter icon-192.png + icon-512.png (maskable) pour
        // passer le critère d'installabilité Chrome. Le SVG suffit pour l'UX
        // et le service worker (offline) fonctionne sans.
        icons: [
          { src: '/favicon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,ico,woff2}'],
        navigateFallback: '/index.html',
        runtimeCaching: [
          {
            urlPattern: ({ url }) => url.origin === 'https://fonts.googleapis.com',
            handler: 'StaleWhileRevalidate',
            options: { cacheName: 'google-fonts-stylesheets' },
          },
          {
            urlPattern: ({ url }) => url.origin === 'https://fonts.gstatic.com',
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts-webfonts',
              expiration: { maxEntries: 30, maxAgeSeconds: 60 * 60 * 24 * 365 },
            },
          },
        ],
      },
      devOptions: { enabled: false },
    }),
  ],
  server: { port: 5173, host: true },
});
