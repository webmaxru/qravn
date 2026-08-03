#!/usr/bin/env node
/**
 * Microsoft Store screenshots for the QRavn PWA.
 *
 * The Store shows these at up to 4K next to the listing copy, so a bare
 * viewport grab of a 928px-wide app column on a 1920px canvas would be mostly
 * empty background. Each screenshot is therefore a composition: the real app,
 * captured live from the running PWA, framed in the window chrome it actually
 * runs in, with the claim it demonstrates set beside it.
 *
 * Nothing here fakes a result. Every frame is driven through the shipping link
 * channel and rendered by the real WebAssembly analyser; the only stub is the
 * redirect resolver, which is stubbed for the same reason the e2e suite stubs
 * it — so that taking a screenshot of a hostile short link does not contact the
 * shortener or the destination behind it.
 *
 *   node tools/store-shots/capture.mjs
 *
 * Requires apps/web dependencies and the wasm package to be built:
 *   npm --prefix apps/web ci
 *   cd core/bindings/wasm && wasm-pack build --target web --out-dir pkg
 */

import { spawn } from 'node:child_process'
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { dirname, join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createRequire } from 'node:module'

import { RESOLVER_STUB, STATES } from './states.mjs'
import { CAPTIONS, LOCALES } from './copy.mjs'

const here = dirname(fileURLToPath(import.meta.url))
const root = join(here, '..', '..')
const webApp = join(root, 'apps', 'web')
const outRoot = join(root, 'brand', 'microsoft-store', 'screenshots')

// Playwright and its browsers already live in apps/web for the e2e suite.
// Resolving from there keeps this tool from pulling a second copy of Chromium.
const requireFromWeb = createRequire(join(webApp, 'package.json'))
const { chromium } = requireFromWeb('playwright')

const PORT = 5199
const ORIGIN = `http://127.0.0.1:${PORT}`

/** Store canvas. 1920x1080 is the 16:9 size the Store renders these at. */
const CANVAS = { width: 1920, height: 1080 }

/** The app window inside the canvas, in canvas pixels. */
const WINDOW = { width: 860, height: 940, titleBar: 40 }

const RAW_ONLY = process.argv.includes('--raw')
const rawDir = join(here, '.raw')

/* ------------------------------------------------------------ dev server */

async function waitForServer(url, timeoutMs = 180_000) {
  const deadline = Date.now() + timeoutMs
  for (;;) {
    try {
      const response = await fetch(url)
      if (response.ok) return
    } catch {
      // Not listening yet.
    }
    if (Date.now() > deadline) throw new Error(`Timed out waiting for ${url}`)
    await new Promise((resolve) => setTimeout(resolve, 400))
  }
}

function startDevServer() {
  const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm'
  const child = spawn(
    npm,
    ['run', 'dev', '--', '--host', '127.0.0.1', '--port', String(PORT), '--strictPort'],
    {
      cwd: webApp,
      // Online mode has to be *configured* for the expansion screen to offer
      // the opt-in at all. It points at the app's own origin, and the request
      // is fulfilled by page.route below, so no service is ever contacted.
      env: { ...process.env, VITE_RESOLVER_URL: ORIGIN },
      stdio: 'ignore',
      shell: process.platform === 'win32',
    },
  )
  child.on('error', (error) => {
    console.error('Failed to start the Vite dev server:', error)
    process.exit(1)
  })
  return child
}

/* ---------------------------------------------------------- app captures */

/**
 * Drive the running app into `state` and return a PNG of the app viewport at
 * 2x, ready to be placed in the window frame.
 */
async function captureApp(browser, state, locale) {
  // CSS pixels equal to the frame it will be placed in, captured at 2x so the
  // 1:1 placement on the canvas is fed by a source with pixels to spare. A
  // state with more to say than fits renders at 1/scale the frame and is put
  // back down at `scale`, which keeps the whole page in one picture.
  const scale = state.captureScale ?? 1
  const real = await browser.newContext({
    viewport: {
      width: Math.round(WINDOW.width / scale),
      height: Math.round((WINDOW.height - WINDOW.titleBar) / scale),
    },
    deviceScaleFactor: 2,
    colorScheme: state.theme === 'dark' ? 'dark' : 'light',
    locale: locale === 'nb' ? 'nb-NO' : 'en-US',
    serviceWorkers: 'block',
    reducedMotion: 'reduce',
  })

  await real.addInitScript(
    ({ chosen, offline }) => {
      try {
        window.localStorage.setItem('qravn.locale', chosen)
        window.localStorage.setItem('qravn.offlineMode', String(offline))
      } catch {
        // Storage is a convenience here; the UI toggle still works without it.
      }
    },
    { chosen: locale, offline: !state.online },
  )

  const page = await real.newPage()

  await page.route('**/*', (route) => {
    const url = new URL(route.request().url())
    // The product invariant, enforced while taking the picture: no scanned host
    // is ever contacted, not even to render a screenshot of it.
    if (
      url.hostname.endsWith('.example') ||
      url.hostname === 'tinyurl.com' ||
      url.hostname === 'bit.ly'
    ) {
      return route.abort()
    }
    if (url.pathname === '/v1/resolve') {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(RESOLVER_STUB),
      })
    }
    return route.continue()
  })

  const target = state.payload === null ? '/' : `/?url=${encodeURIComponent(state.payload)}`
  await page.goto(`${ORIGIN}${target}`, { waitUntil: 'domcontentloaded' })

  if (state.payload === null) {
    await page.locator('.check-form button:not([disabled])').waitFor({ timeout: 60_000 })
  } else {
    await page.getByTestId('result-region').waitFor({ state: 'visible', timeout: 60_000 })
  }

  if (state.expand) {
    await page.locator('.redirect-optin-actions button').click({ timeout: 30_000 })
    await page.locator('.redirect-final-host__value').waitFor({ timeout: 30_000 })
  }

  if (state.openSettings) {
    await page.locator('details.settings > summary').click()
    await page.locator('details.settings[open]').waitFor()
  }

  if (state.scrollTo) {
    // Put the section just under the sticky app bar, rather than wherever a
    // minimal "scroll into view" happens to leave it.
    await page.evaluate((selector) => {
      const element = document.querySelector(selector)
      if (!element) throw new Error(`No element matches ${selector}`)
      const top = element.getBoundingClientRect().top + window.scrollY - 72
      window.scrollTo({ top, behavior: 'instant' })
    }, state.scrollTo)
  }

  // A dev banner means the WebAssembly analyser did not load and the mock is
  // answering. That must never reach a store listing.
  if (await page.locator('.dev-banner').count()) {
    throw new Error(`${state.id}/${locale}: the WebAssembly analyser did not load (mock fallback active)`)
  }

  await page.evaluate(() => document.fonts.ready)
  await page.waitForTimeout(250)

  const png = await page.screenshot({ type: 'png' })
  const height = await page.evaluate(() => document.documentElement.scrollHeight)
  await real.close()
  return { png, scrollHeight: height }
}

/* ------------------------------------------------------------ compositor */

const GROUND = '#0C1519'
const BONE = '#F1EDE6'
const FROST = '#86B2C0'

const MARK_PATH = 'M0,0 H7 V5.5 H6 V1 H1 V6 H5.5 V7 H0 Z M2,2 H5 V5 H2 Z'

function markSvg(size, fill = BONE) {
  const scale = size / 7
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 7 7" width="${size}" height="${size}" aria-hidden="true"><path fill="${fill}" fill-rule="evenodd" d="${MARK_PATH}"/></svg>`
}

function escapeHtml(value) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function compositionHtml({ caption, appDataUri, index, total, theme }) {
  const headline = escapeHtml(caption.headline).replace(/\n/g, '<br>')
  // The chrome is drawn in the app's own palette, so a dark-theme frame does
  // not sit inside a light window it would never really have.
  const chrome =
    theme === 'dark'
      ? { page: '#0e1012', bar: '#1a1d1f', line: '#333739', ink: '#e6e7e5' }
      : { page: '#f2f3f1', bar: '#e9eae7', line: '#dcdfe0', ink: '#111315' }
  return `<!doctype html>
<html lang="${caption.lang}">
<head>
<meta charset="utf-8">
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  html, body {
    width: ${CANVAS.width}px;
    height: ${CANVAS.height}px;
    overflow: hidden;
    background: ${GROUND};
    color: ${BONE};
    font: 16px/1.5 "Segoe UI Variable Display", "Segoe UI", system-ui, -apple-system, sans-serif;
    -webkit-font-smoothing: antialiased;
    text-rendering: optimizeLegibility;
  }
  .stage {
    position: relative;
    display: grid;
    grid-template-columns: 1fr ${WINDOW.width}px;
    align-items: center;
    gap: 72px;
    width: 100%;
    height: 100%;
    padding: 0 96px;
  }
  /* No ornament. The brand does not use one — see brand/og.svg — and on a
     1920px field any decoration would be the loudest thing in the frame. */
  .copy { position: relative; max-width: 760px; }
  .lockup {
    display: flex;
    align-items: center;
    gap: 12px;
    margin-bottom: 56px;
  }
  .lockup__word {
    font-family: Consolas, "Cascadia Mono", ui-monospace, monospace;
    font-size: 26px;
    letter-spacing: -0.03em;
    color: ${BONE};
  }
  .kicker {
    display: flex;
    align-items: center;
    gap: 14px;
    margin-bottom: 22px;
    color: ${FROST};
    font-family: Consolas, "Cascadia Mono", ui-monospace, monospace;
    font-size: 17px;
    font-weight: 700;
    letter-spacing: 0.22em;
    text-transform: uppercase;
  }
  .kicker__rule {
    width: 44px;
    height: 2px;
    background: ${FROST};
    opacity: 0.55;
  }
  h1 {
    font-size: 60px;
    font-weight: 650;
    line-height: 1.06;
    letter-spacing: -0.028em;
    text-wrap: balance;
  }
  .sub {
    max-width: 30em;
    margin-top: 28px;
    color: ${FROST};
    font-size: 24px;
    line-height: 1.5;
    letter-spacing: -0.006em;
  }
  .index {
    position: absolute;
    bottom: 54px;
    left: 96px;
    color: ${FROST};
    opacity: 0.5;
    font-family: Consolas, "Cascadia Mono", ui-monospace, monospace;
    font-size: 15px;
    letter-spacing: 0.18em;
  }
  /* The window the PWA actually runs in: title bar, app icon, caption buttons. */
  .window {
    position: relative;
    width: ${WINDOW.width}px;
    height: ${WINDOW.height}px;
    border: 1px solid ${theme === 'dark' ? 'rgba(241, 237, 230, 0.24)' : 'rgba(241, 237, 230, 0.16)'};
    border-radius: 12px;
    overflow: hidden;
    background: ${chrome.page};
    box-shadow:
      0 2px 4px rgba(0, 0, 0, 0.28),
      0 40px 90px rgba(0, 0, 0, 0.55);
  }
  .titlebar {
    display: flex;
    align-items: center;
    gap: 10px;
    height: ${WINDOW.titleBar}px;
    padding-left: 16px;
    border-bottom: 1px solid ${chrome.line};
    background: ${chrome.bar};
  }
  .titlebar__name {
    flex: 1;
    font-family: Consolas, "Cascadia Mono", ui-monospace, monospace;
    font-size: 13px;
    letter-spacing: -0.01em;
    color: ${chrome.ink};
  }
  .titlebar__buttons { display: flex; height: 100%; }
  .titlebar__button {
    display: grid;
    place-items: center;
    width: 46px;
    height: 100%;
  }
  .titlebar__button i {
    display: block;
    background: ${chrome.ink};
  }
  .btn-min i { width: 10px; height: 1px; }
  .btn-max i { width: 9px; height: 9px; background: none; border: 1px solid ${chrome.ink}; }
  .btn-close { position: relative; }
  .btn-close i {
    position: absolute;
    width: 12px;
    height: 1px;
  }
  .btn-close i:first-child { transform: rotate(45deg); }
  .btn-close i:last-child { transform: rotate(-45deg); }
  .viewport {
    position: relative;
    height: ${WINDOW.height - WINDOW.titleBar}px;
    overflow: hidden;
  }
  .viewport img {
    display: block;
    width: ${WINDOW.width}px;
    height: ${WINDOW.height - WINDOW.titleBar}px;
    object-fit: cover;
    object-position: top center;
  }
  /* What a pane with more content below actually looks like. */
  .scroll-hint {
    position: absolute;
    right: 0;
    bottom: 0;
    left: 0;
    height: 26px;
    background: linear-gradient(to top, ${theme === 'dark' ? 'rgba(0, 0, 0, 0.35)' : 'rgba(17, 19, 21, 0.12)'}, rgba(17, 19, 21, 0));
  }
</style>
</head>
<body>
  <div class="stage">
    <div class="copy">
      <div class="lockup">${markSvg(30)}<span class="lockup__word">QRavn</span></div>
      <p class="kicker"><span class="kicker__rule"></span>${escapeHtml(caption.kicker)}</p>
      <h1>${headline}</h1>
      <p class="sub">${escapeHtml(caption.sub)}</p>
    </div>
    <div class="window">
      <div class="titlebar">
        ${markSvg(15, chrome.ink)}
        <span class="titlebar__name">QRavn</span>
        <div class="titlebar__buttons">
          <span class="titlebar__button btn-min"><i></i></span>
          <span class="titlebar__button btn-max"><i></i></span>
          <span class="titlebar__button btn-close"><i></i><i></i></span>
        </div>
      </div>
      <div class="viewport">
        <img src="${appDataUri}" alt="">
        <div class="scroll-hint"></div>
      </div>
    </div>
    <p class="index">${String(index).padStart(2, '0')} / ${String(total).padStart(2, '0')}</p>
  </div>
</body>
</html>`
}

/* ----------------------------------------------------------------- main */

async function main() {
  const registry = JSON.parse(
    await readFile(join(root, 'contracts', 'v1', 'finding-codes.json'), 'utf8'),
  )
  const checkCount = Object.keys(registry.findings).length

  const server = startDevServer()
  let browser
  try {
    await waitForServer(ORIGIN)
    browser = await chromium.launch()

    if (RAW_ONLY) await mkdir(rawDir, { recursive: true })

    for (const locale of LOCALES) {
      const dir = join(outRoot, locale.dir)
      await rm(dir, { recursive: true, force: true })
      await mkdir(dir, { recursive: true })

      let index = 0
      for (const state of STATES) {
        index += 1
        const { png, scrollHeight } = await captureApp(browser, state, locale.code)

        if (RAW_ONLY) {
          const rawPath = join(rawDir, `${locale.dir}-${index}-${state.id}.png`)
          await writeFile(rawPath, png)
          console.log(`raw  ${relative(root, rawPath).replaceAll('\\', '/')}  (content ${scrollHeight}px)`)
          continue
        }

        const caption = CAPTIONS[locale.code][state.id]
        if (!caption) throw new Error(`No ${locale.code} caption for state "${state.id}"`)

        const html = compositionHtml({
          caption: {
            ...caption,
            lang: locale.code,
            headline: caption.headline.replaceAll('{{checks}}', String(checkCount)),
            sub: caption.sub.replaceAll('{{checks}}', String(checkCount)),
          },
          appDataUri: `data:image/png;base64,${png.toString('base64')}`,
          index,
          total: STATES.length,
          theme: state.theme === 'dark' ? 'dark' : 'light',
        })

        const context = await browser.newContext({
          viewport: CANVAS,
          deviceScaleFactor: 1,
          colorScheme: 'dark',
        })
        const page = await context.newPage()
        await page.setContent(html, { waitUntil: 'load' })
        await page.evaluate(() => document.fonts.ready)
        const shot = await page.screenshot({ type: 'png' })
        await context.close()

        const file = join(dir, `${String(index).padStart(2, '0')}-${state.id}.png`)
        await writeFile(file, shot)
        console.log(
          `${locale.dir}  ${relative(root, file).replaceAll('\\', '/')}  ${CANVAS.width}x${CANVAS.height}`,
        )
      }
    }
  } finally {
    if (browser) await browser.close()
    server.kill()
  }
}

await main()
