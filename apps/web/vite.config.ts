import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import findingCodes from '../../contracts/v1/finding-codes.json' with { type: 'json' }

const CHECK_COUNT = Object.keys(findingCodes.findings).length

/**
 * The same split the in-app copy quotes: how many checks look at the address,
 * at what the code really is, and at where it sends you next. Derived from the
 * code prefix so a finding added to one group cannot leave the breakdown in
 * the page metadata adding up to something other than the total.
 */
const GROUP_COUNTS = Object.keys(findingCodes.findings).reduce<Record<string, number>>(
  (acc, code) => {
    const group = code.split('.', 1)[0]
    acc[group] = (acc[group] ?? 0) + 1
    return acc
  },
  {},
)

/**
 * The number of checks is quoted in the page title, the meta description, the
 * card metadata, the structured data, the no-JavaScript fallback and the
 * installed app's manifest. Injecting it from the contract means adding a
 * finding code updates all of them at once, rather than leaving copies of a
 * claim about a security product to drift out of date.
 */
function injectCheckCount() {
  return {
    name: 'inject-check-count',
    transformIndexHtml(html: string) {
      return html
        .replaceAll('%CHECK_COUNT%', String(CHECK_COUNT))
        .replaceAll('%CHECK_COUNT_URL%', String(GROUP_COUNTS.url ?? 0))
        .replaceAll('%CHECK_COUNT_PAYLOAD%', String(GROUP_COUNTS.payload ?? 0))
        .replaceAll('%CHECK_COUNT_REDIRECT%', String(GROUP_COUNTS.redirect ?? 0))
    },
  }
}

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
    exclude: ['qravn-safety-wasm'],
  },
  plugins: [
    stripZxingCdnDefault(),
    injectCheckCount(),
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: [],
      manifest: {
        // A stable id means a later change to start_url cannot make an
        // installed copy look like a different application to the browser.
        id: '/',
        name: 'QRavn – QR code safety',
        short_name: 'QRavn',
        description:
          `Reads a QR code and runs ${CHECK_COUNT} checks on it for the tricks scammers use — lookalike domains, hidden redirects, invisible characters — before anything opens.`,
        lang: 'nb-NO',
        dir: 'ltr',
        categories: ['utilities', 'security', 'productivity'],
        theme_color: '#fafaf8',
        background_color: '#fafaf8',
        display: 'standalone',
        start_url: '/',
        scope: '/',
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
        // Documents that are not SPA routes. Without this the service worker
        // would answer a navigation to any of them with the app shell: the
        // privacy policy would be unreachable for anyone who had already
        // visited the site, and a reader who followed the link to /llms.txt
        // would be handed the application instead of the file. Crawlers never
        // register a service worker, so this only ever affects people.
        navigateFallbackDenylist: [
          /^\/privacy(\.html)?$/,
          /^\/personvern$/,
          /^\/robots\.txt$/,
          /^\/sitemap\.xml$/,
          /^\/llms(-full)?\.txt$/,
        ],
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
