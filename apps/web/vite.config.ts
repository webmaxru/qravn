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
        name: 'qrrrgh QR Safety Checker',
        short_name: 'qrrrgh',
        description: 'Privacy-first QR code safety checker for Norway.',
        theme_color: '#0b5d55',
        background_color: '#f7f3ea',
        display: 'standalone',
        start_url: '/',
        icons: [
          {
            src: '/pwa-192.svg',
            sizes: '192x192',
            type: 'image/svg+xml',
            purpose: 'any maskable',
          },
        ],
      },
      workbox: {
        navigateFallback: '/index.html',
        globPatterns: ['**/*.{js,css,html,svg,wasm}'],
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
