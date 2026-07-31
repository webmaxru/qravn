# QRavn

A free, privacy-first QR code safety application for Norway.

Scan a QR code, see exactly what is inside it, and get an evidence-based safety assessment **before** anything opens.

> **Status:** early implementation. The shared core, the web surface and the redirect resolver are live. The Android application is implemented against the same core and is not yet published; iOS has not started.
>
> **Web app:** <https://qravn.isainative.dev>
>
> **Resolver:** <https://qravn-api.isainative.dev> — used only when you explicitly ask to expand a shortened link. It scales to zero, so it costs nothing while idle.

---

## Why

Neither the iOS Camera app nor Google Lens investigates a QR code's destination before you tap it. They show the link and let you open it. Safari's Fraudulent Website Warning and Chrome Safe Browsing only act *after* navigation is attempted.

This project closes that gap:

- Decodes locally and **never opens a link automatically**.
- Shows the complete payload before any external action.
- Expands shortened URLs and redirect chains **on isolated server infrastructure**, never from the user's device.
- Combines deterministic rules with a compact on-device classifier.
- Works offline by default; online mode is explicit and opt-in.
- Explains its evidence in Bokmål, Nynorsk, and English.
- Uses generative AI only to *explain* evidence, never to decide the verdict.

### Verdicts

The interface never shows an unqualified "Safe". The four verdicts are:

| Verdict | Meaning |
|---|---|
| `known_malicious` | Matches known-bad evidence |
| `suspicious` | Structural or behavioural indicators of risk |
| `insufficient_evidence` | Not enough signal to judge |
| `no_known_threat_found` | Nothing found — which is not the same as safe |

---

## Architecture

One Rust core, compiled four ways. The security logic exists exactly once.

```text
                    ┌───────────────────────────┐
                    │   core/  (Rust)           │
                    │   payload, URL policy,    │
                    │   IDN, confusables, PSL,  │
                    │   rules, classifier,      │
                    │   verdict, explanations   │
                    └─────────────┬─────────────┘
                                  │
        ┌──────────────┬──────────┴──────────┬──────────────┐
        │ UniFFI       │ JNI                 │ wasm-bindgen │ direct
        ▼              ▼                     ▼              ▼
    iOS (Swift)   Android (Kotlin)      Web (TypeScript)  Backend
    SwiftUI       Compose               Vite + PWA        Rust service
    VisionKit     CameraX + ML Kit      WASM QR decoder
```

The core owns **security meaning**. Each application owns **platform lifecycle and presentation**. The core contains no UI, no camera, no I/O, no networking — which is exactly why it ports everywhere.

### Non-negotiable invariants

1. A scan never triggers navigation or a network request by itself.
2. The user's device never contacts the scanned destination.
3. Offline is the default; online is explicit, revocable, and disclosed.
4. Generative AI can never change a verdict.
5. The core must build for `wasm32-unknown-unknown` in CI, from the first commit.

---

## Repository layout

```text
core/            Rust workspace — the shared safety core
  crates/        payload, url-policy, verdict, rules, classifier, evidence
  bindings/wasm/ wasm-bindgen wrapper published to the web app
  bindings/android/  JNI wrapper loaded by the Android app
apps/web/        Vite + TypeScript progressive web application
apps/android/    Kotlin + Compose application — see apps/android/README.md
brand/           Logo, app icons and store artwork — the visual source of truth
contracts/       Versioned schemas shared by every surface
localization/    nb, nn, en catalogs keyed by finding code
test-vectors/    Golden corpora, including decoder conformance
planning/        Market research, technical research, implementation plan
tools/           Contract checks and the brand asset renderer
.github/         CI and deployment workflows
```

---

## Brand

The scams this product exists to catch work by impersonating institutions you
trust. So the identity refuses the visual language of borrowed trust: no
shields, no padlocks, no green ticks, no bank blue. It should read as an
instrument that measures and reports, not an authority that blesses.

**Colour is a verdict.** The base palette is QR black and white, the only two
colours a QR code may have. Colour enters only when there is something to warn
about, and it gets louder as the news gets worse:

| Verdict | Voice | Light | Dark |
|---|---|---|---|
| `no_known_threat_found` | silence — no hue at all | `#F0F1EF` on `#111315` | `#1E2123` on `#E6E7E5` |
| `insufficient_evidence` | a murmur | `#E2E2F4` on `#1E2050` | `#23264F` on `#D5D6F2` |
| `suspicious` | a raised voice | `#FFEBC7` on `#4A2A02` | `#422703` on `#FFE0AE` |
| `known_malicious` | a shout | `#FFE1DA` on `#5E1608` | `#4E150B` on `#FFD9D0` |

A clean result is therefore monochrome. That is the point: it makes the system
structurally incapable of rendering "safe", because safety here is an absence,
not a finding. Every pair above is verified against WCAG AA, and colour is
never the only signal — each verdict also carries its own icon and the written
verdict text from the shared catalog.

**The mark** is a single QR finder pattern with the ring left open at one
corner. The 7×7 ring, 1-module gap and 3×3 core give the 1:1:3:1:1 run of
modules a decoder hunts for along any scan line, and both centre lines still
read that way, so this is not a shape inspired by a QR code — it is what "QR
code" means to a machine. Cutting the corner leaves the ring unclosed, which
carries the same idea as the palette: the app reports what it found and never
closes the loop by calling something safe. It also kills the rotational
symmetry, the job a real code gives its missing fourth finder. The clear
verdict icon follows the rule — an empty ring, not a tick.

**Ground.** Icons and store surfaces are bone `#F1EDE6` on night petrol
`#0C1519`, the inverse of a printed code: every other QR utility is ink on
paper behind a shield, and the moment this app is for happens in a car park or
a stairwell. `frost #86B2C0` is the one accent the brand owns and it appears
only on marketing surfaces, never in the interface, where a colour is a
verdict. The product UI keeps its own ink-on-paper palette for that reason.

**Type.** Human-facing prose uses the platform system face, because native feel
matters more than a bundled display font and because Android downloadable fonts
would need the network. Monospace is the machine's voice: the wordmark, field
labels, payloads, hosts and codes. That is functional rather than stylistic —
the app's central act is showing a URL precisely enough that you can tell `rn`
from `m` or spot a Cyrillic `а`, and a proportional face hides exactly that.

On Android this means Material You dynamic colour is **off by default**, since
it would repaint the app in whatever hue the wallpaper happens to be. It stays
available as a setting, and verdict colours sit outside the Material scheme
regardless, so no wallpaper can tint a verdict either way.

`brand/` holds the SVG sources. The PNGs used by the web manifest and the Play
Console are committed and regenerated only when a source changes:

```bash
cd tools/brand-render && npm install && node render.mjs
```

| File | Use |
|---|---|
| `brand/mark.svg` | The mark on its own, on a 7-module field. Needs a 1-module quiet zone at minimum, 2 is better |
| `brand/lockup.svg` | Mark plus wordmark, for headers and documents |
| `brand/app-icon.svg` | Rounded tile — favicon, PWA `any`, apple-touch, Play listing |
| `brand/app-icon-maskable.svg` | Full-bleed square with the launcher safe zone honoured |
| `brand/og.svg` | Open Graph and social card |
| `brand/play/feature-graphic.svg` | Play Store feature graphic, 1024×500 |

Android does not consume these files directly — a `VectorDrawable` cannot
reference an SVG. The launcher, monochrome, splash and tile drawables in
`apps/android/app/src/main/res/drawable/` are hand-written ports of the same
geometry, sized so the mark survives every launcher mask.

---

## Getting started

Requires Rust (stable), Node 20+, and `wasm-pack`.

```bash
# Core
cd core && cargo test
cargo build --target wasm32-unknown-unknown -p safety-core

# Web
cd apps/web && npm install && npm run dev
```

The Android application additionally needs the Android SDK, the NDK and
`cargo-ndk`. See [`apps/android/README.md`](apps/android/README.md).

```bash
cd apps/android && ./gradlew assembleDebug
```

CI (`.github/workflows/ci.yml`) gates every push and pull request on five jobs:
the Rust core including the `wasm32` build, the web app, browser tests across
Chromium, Firefox and WebKit, the Android app including instrumented tests on an
emulator, and the shared contract.

---

## Documentation

All research and planning lives in [`planning/`](planning/). Start with [`planning/README.md`](planning/README.md).

| Document | Purpose |
|---|---|
| `qr-safety-market-research-norway.md` | Competition, Norway demand, positioning, legal constraints |
| `qr-safety-technical-research.md` | Security architecture, URL processing, redirect isolation, offline AI |
| `qr-safety-unified-core-and-web-surface.md` | Why one Rust core serves all surfaces; web platform limits |
| `qr-safety-implementation-plan.md` | Phased implementation plan — the source of truth |
| `qr-safety-ios-development-start-guide.md` | Apple licensing, Xcode setup, App Store path |
| `qr-safety-android-development-start-guide.md` | Play licensing, Android Studio setup, release path |

---

## License

Not yet determined. See `planning/qr-safety-implementation-plan.md` open decisions.
