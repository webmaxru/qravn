/**
 * The app states that the Microsoft Store screenshots are taken from.
 *
 * Every payload here is a golden test vector or a direct sibling of one, so a
 * screenshot can never show a verdict the engine does not actually produce.
 * The `url` channel is the same one `apps/web/src/lib/linkParams.ts` documents:
 * a payload carried in a link is assessed exactly like a scan, so driving the
 * app this way exercises the shipping path rather than a screenshot-only one.
 *
 * Per-state options:
 *   payload      what arrives in the link, or null for the first screen
 *   theme        'light' (default) or 'dark'; the app follows the system
 *   online       leave redirect expansion switched on (default off, which is
 *                the app's quietest state and keeps the frame on the findings)
 *   expand       click the expansion opt-in and wait for the resolved chain
 *   openSettings open the settings disclosure
 *   scrollTo     put this selector at the top of the frame before the shutter
 *   captureScale render at 1/scale the frame size, so a taller page fits
 */

/**
 * Stub answer for the one screen that shows online redirect expansion.
 *
 * Copied from test-vectors/golden/redirect-chains.json →
 * `redirect-shortener-to-brand-subdomain`, so the verdict in the picture is one
 * the core is tested to produce. It is stubbed for the reason the e2e suite
 * stubs it: photographing a hostile short link must not contact the shortener,
 * or the destination behind it.
 */
export const RESOLVER_STUB = {
  chain: [
    { url: 'https://tinyurl.com/y2', status: 301, via: 'http_status' },
    { url: 'https://dnb.no.sikker-innlogging.example/', status: 200 },
  ],
  finalUrl: 'https://dnb.no.sikker-innlogging.example/',
  outcome: 'resolved',
  elapsedMs: 39,
  resolver: 'qravn-resolver/1',
}

export const STATES = [
  {
    id: 'scan',
    // The first screen, untouched: viewfinder, paste field, the whole task.
    payload: null,
    captureScale: 0.82,
  },
  {
    id: 'clear',
    payload: 'https://www.skatteetaten.no/skattemelding/',
  },
  {
    id: 'lookalike',
    // test-vectors/golden/identity-attacks.json → cyrillic-a-apple.
    payload: 'https://\u0430pple.com/',
  },
  {
    id: 'credentials',
    // test-vectors/golden/deceptive-urls.json → credentials in the authority.
    payload: 'https://trusted.no@evil.example/login',
  },
  {
    id: 'blocked',
    payload: 'javascript:alert(1)',
  },
  {
    id: 'redirect',
    payload: 'https://tinyurl.com/y2',
    online: true,
    expand: true,
  },
  {
    id: 'payload',
    // A QR code that is not a link at all: an open guest network.
    payload: 'WIFI:S:Gjestenett;T:nopass;;',
  },
  {
    id: 'checks',
    // The tally, counted from the contract at build time.
    payload: null,
    scrollTo: '.how',
  },
  {
    id: 'privacy',
    // Dark, because the app follows the system theme and one frame should say
    // so without spending a caption on it.
    payload: null,
    theme: 'dark',
    online: true,
    openSettings: true,
    scrollTo: 'details.settings',
  },
]
