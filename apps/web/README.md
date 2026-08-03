# QRavn for the web

The progressive web application at <https://qravn.isainative.dev>. It is the
same engine as the iOS and Android clients — the Rust core in [`core/`](../../core)
compiled to WebAssembly — behind a React surface.

It is also the surface that is packaged for the Microsoft Store, so a change
here can reach three places: the web, an installed PWA, and a Store listing.

## What it does and does not do

- It **never opens a scanned link by itself**. Opening is a separate, deliberate
  press, and only when the core permits it.
- The browser **never contacts the scanned destination**. The only request the
  app can make to a scanned address is through the isolated resolver in
  [`services/resolver/`](../../services/resolver), and only after an explicit
  per-check consent.
- Every verdict, finding, limitation and recommended action comes from the core.
  This app renders; it does not decide.
- There is no unqualified "Safe". The four verdicts are the only vocabulary.
- Decoding is local. The browser's `BarcodeDetector` is used when it exists and
  `zxing-wasm` is the fallback, because `BarcodeDetector` is unavailable in
  Safari and Firefox. The wasm decoder is bundled rather than fetched, so a
  first scan works offline.

## Layout

| Path | Purpose |
| --- | --- |
| `src/engine/` | The engine boundary: the wasm engine, a mock for tests, the catalog, and the golden conformance runner. |
| `src/contracts/` | The v1 contract projected into TypeScript. Generated — see below. |
| `src/components/` | The surface. `ResultPanel` and its children render an assessment; nothing here interprets one. |
| `src/lib/` | Decoding, the `?url=`/`#url=` link channel, the resolver client, assessment helpers, UI text. |
| `scripts/inject-resolver-csp.mjs` | Rewrites `connect-src` in the built CSP so the resolver origin is allowed and nothing else is. |
| `scripts/prod-smoke.mjs` | `npm run test:prod` — a manual smoke test against a deployed origin. |
| `e2e/` | Playwright: behaviour across Chromium, Firefox and WebKit, plus axe accessibility checks. |
| `public/` | Manifest icons, `privacy.html`, `robots.txt`, `sitemap.xml`, `llms.txt`, and the Static Web Apps config. |

## Building

The wasm package is a local file dependency (`qravn-safety-wasm`), so the core
must be built before `npm install` can resolve it:

```sh
cd core/bindings/wasm && wasm-pack build --target web --out-dir pkg
cd apps/web && npm install && npm run dev
```

`pkg/` is generated and git-ignored: a committed wasm binary cannot be reviewed
as a diff, and one that drifts from the Rust source is worse than none.

## Checks

```sh
npx tsc --noEmit          # types
npm run lint              # oxlint, including the jsx-a11y rules
npm run test -- --run     # vitest
npm run build             # tsc -b, vite build, then the CSP injection
npx playwright test --workers=1
```

`npm run lint` is a separate CI step and enforces accessibility rules that
neither `tsc` nor vitest sees. Run it before pushing any JSX change.

Two of the vitest suites are worth naming, because they are contract gates
rather than unit tests:

- `src/engine/wasmGoldenConformance.test.ts` runs `test-vectors/golden/` through
  the compiled WebAssembly in a real browser, the same corpus the Rust
  conformance test runs. It parses `FIXED_NOW_MS` out of the Rust source so the
  two clocks cannot drift, and asserts a minimum vector count so a corpus that
  silently shrinks fails the build.
- `src/test/discovery.test.ts` covers what other machines read rather than what
  a person sees: the JSON-LD on every page, canonical and social metadata, and
  that the structured data never claims a verdict the product refuses to give.

## Handing a link to the app

The app accepts a link in its own URL so an address can be assessed without a
camera. The rules the implementation enforces, and why the fragment form is
preferred, are documented in the [root README](../../README.md#handing-a-link-to-the-web-app).
The parsing itself is [`src/lib/linkParams.ts`](src/lib/linkParams.ts).

## Generated files

Neither is hand-edited, and both are derived from the frozen contract:

| File | From |
| --- | --- |
| `src/contracts/assessment.ts` | `contracts/v1/`, written by `node tools/sync-contract.mjs`; CI fails on drift |
| `src/checkCount.ts` | imports `contracts/v1/finding-codes.json` and counts it at build time |

The check count is derived rather than typed because it is a claim about a
security product. Surfaces that state it as a literal instead — all three store
listings, the Android string resources, the three localization catalogs, the
root README, and this app's `public/llms.txt` — are asserted against the
registry by `tools/check-claimed-checks.mjs`, so adding a finding code cannot
leave a stale figure on a store page. The hero here is absent from that list
precisely because it counts rather than claims.

## Deployment

`.github/workflows/deploy-web.yml` builds and publishes to Azure Static Web
Apps. Hosting configuration — headers, the CSP, routing — is
`public/staticwebapp.config.json`. The resolver origin is injected into the CSP
at build time rather than written into the file, so the allowed origin cannot
drift from the one the client actually calls.
