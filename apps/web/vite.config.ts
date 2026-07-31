import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

function stripZxingCdnDefault() {
  return {
    name: 'strip-zxing-cdn-default',
    enforce: 'pre' as const,
    transform(code: string, id: string) {
      if (!id.includes('zxing-wasm') || !code.includes('fastly.jsdelivr.net/npm/zxing-wasm')) return null
      return code.replace(
        '`https://fastly.jsdelivr.net/npm/zxing-wasm@3.1.2/dist/${n[1]}/${e}`',
        't + e',
      )
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  resolve: {
    preserveSymlinks: true,
  },
  optimizeDeps: {
    exclude: ['qrrrgh-safety-wasm'],
  },
  plugins: [
    stripZxingCdnDefault(),
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: [],
      manifest: {
        name: 'qrrrgh – QR code safety',
        short_name: 'qrrrgh',
        description:
          'Security professionals never scan QR codes. See where one really leads before you open it, checked on your own device.',
        theme_color: '#fafaf8',
        background_color: '#fafaf8',
        display: 'standalone',
        start_url: '/',
        icons: [
          { src: '/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          // Kept separate from the "any" icons: a maskable icon needs its own
          // safe-zone padding, and reusing one file for both crops the mark.
          { src: '/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
          { src: '/favicon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
        ],
      },
      workbox: {
        navigateFallback: '/index.html',
        // The privacy policy is a standalone document, not an SPA route. Without
        // this the service worker would answer a navigation to /privacy with the
        // app shell, and the policy would be unreachable for anyone who had
        // already visited the site.
        navigateFallbackDenylist: [/^\/privacy(\.html)?$/, /^\/personvern$/],
        globPatterns: ['**/*.{js,css,html,svg,png,wasm}'],
      },
    }),
  ],
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    css: true,
    exclude: ['node_modules/**', 'dist/**', 'e2e/**'],
  },
})
