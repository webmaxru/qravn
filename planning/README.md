# QR Safety Application: Planning and Research Index

**Consolidated:** 26 July 2026
**Last updated:** 27 July 2026 — added the offline-mode and redirect-expansion cross-platform plan
**Location:** `qrrrgh/planning/`
**Status:** Research complete. Web implementation in progress. Native implementations planned.

This folder is the single source of truth for the product's market research, technical research, platform start guides, and the implementation plan.

---

## 1. Product summary

A free, privacy-first QR code safety application for Norway, delivered as native iOS and Android applications plus a web application, all sharing one compiled security core.

The application:

- Decodes QR codes locally and never opens a link automatically.
- Shows the complete payload before any external action.
- Expands shortened URLs and redirect chains through isolated server infrastructure after explicit per-check consent, never from the user's device.
- Combines deterministic rules with a compact on-device classifier.
- Runs every check locally first; the offline mode toggle is off by default, and turning it on disables all network calls including redirect expansion.
- Explains evidence in Bokmål and Nynorsk.
- Uses generative AI only to explain evidence, never to decide the verdict.

Public verdict labels are fixed:

- `known_malicious`
- `suspicious`
- `insufficient_evidence`
- `no_known_threat_found`

The interface never shows an unqualified **Safe** label.

---

## 2. Documents

| File | Purpose | Size |
|---|---|---|
| `qr-safety-market-research-norway.md` | Competition, Norway demand, threat evidence, positioning, legal constraints, business model, go-to-market | ~48 KB |
| `qr-safety-technical-research.md` | Security architecture, URL processing, redirect isolation, AI strategy, offline-first design, native integrations, testing | ~101 KB |
| `qr-safety-ios-development-start-guide.md` | Apple licensing, Xcode setup, first milestones, App Store path, GitHub Copilot use | ~32 KB |
| `qr-safety-android-development-start-guide.md` | Google Play licensing, Android Studio setup, CameraX/ML Kit, Play release path, GitHub Copilot use | ~59 KB |
| `qr-safety-unified-core-and-web-surface.md` | Whether iOS, Android, and web can share one core; Rust/WASM evidence; web platform limits; recommended stack | ~29 KB |
| `qr-safety-implementation-plan.md` | iOS-first, platform-agnostic-core implementation plan with phased todos | ~36 KB |
| `qr-safety-offline-mode-and-redirect-expansion-plan.md` | Cross-platform offline-mode toggle, shortener registry, redirect warning, final-destination display, and per-platform checklists | ~32 KB |

---

## 3. Reading order

### For product and marketing work

1. `qr-safety-market-research-norway.md` sections 1, 3, 5, 7, 9, 10, 11.
2. `qr-safety-technical-research.md` sections 2, 28.
3. `qr-safety-implementation-plan.md` product invariants.

### For engineering work

1. `qr-safety-implementation-plan.md` in full.
2. `qr-safety-unified-core-and-web-surface.md` in full — it revises the plan's classifier and core-portability decisions.
3. `qr-safety-offline-mode-and-redirect-expansion-plan.md` before changing offline mode, redirect expansion, shortener warnings, rule updates, or related platform entry points.
4. `qr-safety-technical-research.md` sections 4-13 for detection design.
5. `qr-safety-technical-research.md` sections 14-17 for native integration.
6. `qr-safety-technical-research.md` sections 27-39 for offline AI.
7. Platform start guide for whichever client is being built.

### For legal and compliance work

1. `qr-safety-market-research-norway.md` section 13.
2. `qr-safety-technical-research.md` sections 11, 19.
3. Both start guides for store account, privacy declaration, and data-safety requirements.

---

## 4. Key findings that shape the product

### Market

- No verified Norway-focused incumbent combines local decoding, redirect-chain expansion, transparent evidence, and Norwegian explanations.
- Kaspersky's standalone Android QR scanner ended development in 2022 and support in 2023.
- Trend Micro's verified direct proposition is primarily Android.
- McAfee QR feature availability specifically in Norway could not be verified.

### Native platform protection

- Apple Camera/Photos and Google Lens show the link but do not document QR-specific pre-opening investigation.
- Safari Fraudulent Website Warning and Chrome Safe Browsing act after navigation is attempted.
- Default photo/camera apps ship no QR-specific redirect expansion or evidence-based explanation.
- This gap is the core market claim.

### Technical

- Redirect expansion must run in an SSRF-resistant worker with manual redirects, global-IP validation before every connection, no cookies, no credentials, no JavaScript, and strict limits.
- Neither platform allows replacing or intercepting the built-in camera QR result.
- iOS Locked Camera Capture is the strongest third-party system entry point, but has no network or App Group access while locked.
- Android's supported routes are Sharesheet, pinned shortcuts, widgets, and Quick Settings.

### Offline AI

- Ship a tiny discriminative URL classifier plus deterministic Norwegian templates.
- Do not bundle a generative model in v1.
- Apple Foundation Models and Gemini Nano are optional, device-gated enhancements that must degrade to templates.
- Bundle the ML Kit barcode model on Android so first-run scanning works with no download.

### Unified core and web surface

- One Rust core can serve all four surfaces as a real shared implementation, not just a shared specification.
- UniFFI covers Swift and Kotlin; wasm-bindgen covers the browser; the backend links the crate directly.
- `BarcodeDetector` is unusable in Safari, Safari on iOS, and Firefox, so the web app must ship its own WebAssembly QR decoder.
- Web Share Target is unsupported on Safari and Safari on iOS, so only Android web installs can receive shares.
- Browser storage can be evicted, so web offline support is best-effort while native offline support is guaranteed.
- Chrome's built-in Prompt API does not run on Chrome for Android or iOS, so the web surface uses deterministic templates only.
- Because the v1 classifier is a linear model, inference belongs in Rust — removing Core ML and LiteRT from v1 and giving bit-identical scores everywhere.
- The largest residual risk is QR decoder divergence between VisionKit, ML Kit, and the WebAssembly decoder; it requires a byte-level conformance corpus.

---

## 5. Architecture decision

Native shells with a narrow shared security core.

```text
iOS: Swift, SwiftUI, VisionKit, Vision, AVFoundation, App Intents, WidgetKit, extensions
Android: Kotlin, Compose, CameraX, ML Kit
Web: TypeScript, Vite, PWA, WebAssembly core and WebAssembly QR decoder
Shared: Rust safety core, via UniFFI to Swift and Kotlin, via wasm-bindgen to TypeScript
Server: same Rust crate, plus isolated reputation, redirect expansion, optional page analysis
```

Three separate concepts, deliberately not merged:

1. `SafetyEngine` — authoritative, shared, produces evidence and verdict.
2. `AnalysisCoordinator` — applies policy, sequences local then optional remote evidence.
3. `ExplanationAgent` — presentation only, cannot change verdict, deterministic templates required.

React Native, Flutter, and Capacitor were rejected as the primary architecture because every high-value entry point still requires native extension work.

---

## 6. Implementation phases

Tracked in detail in `qr-safety-implementation-plan.md`.

| Phase | Outcome |
|---|---|
| 0 | Ownership, naming, minimum OS version, and shared-core approval |
| 1 | Monorepo, Rust workspace, UniFFI and wasm bindings, versioned contracts |
| 2 | Inert iOS scanner that never opens a payload |
| 3 | Shared payload and URL security core |
| 4 | Verdict policy, signed rules, Norwegian localization |
| 4W | Web proof-of-concept: paste a URL, get an identical verdict in the browser |
| 5 | Photo import and Share extension |
| 6 | Compact offline classifier, inference inside the Rust core |
| 7 | Privacy work and first TestFlight build |
| 7W | Public web app on Azure Static Web Apps, with WebAssembly QR decoding |
| 8 | Native iOS entry points including Locked Camera Capture |
| 9 | Optional explanation agents |
| 10 | Explicit online enrichment, shared by mobile and web |
| 11 | Android client reusing the same core |

The web stages are numbered separately because they run alongside the mobile phases rather than delaying them. The only requirement placed on earlier phases is that the Rust core must build for `wasm32-unknown-unknown` in CI from the first commit.

---

## 7. Decisions required before coding starts

1. Product and repository name.
2. Personal ownership or Norwegian company ownership.
3. Permanent bundle and package namespace.
4. Minimum iOS version, currently planned as iOS 16.
5. Whether Nynorsk is complete at first external beta.
6. Approval of Rust plus UniFFI for the shared core.
7. Whether scan history is excluded from v1.
8. Whether any online feature ships in the first public release.
9. Commercial threat-intelligence provider.
10. Backend region and data-processing agreements.
11. Policy for one-time and authentication-bearing URLs.
12. Model false-positive budget and launch acceptance threshold.
13. Whether the web app ships before, alongside, or after the first native release.
14. Web UI framework choice: React for ecosystem breadth or Svelte for a smaller bundle.
15. Web QR decoder choice: `rxing` compiled into the core, or the separate `zxing-wasm` package.

---

## 8. Licensing and cost summary

| Item | Cost |
|---|---|
| Xcode, Android Studio, SDKs | Free |
| Local development and device testing | Free |
| Rust toolchain, UniFFI, wasm-pack | Free |
| Apple Developer Program | 99 USD per year, required for TestFlight and App Store |
| Google Play Console | 25 USD one-time registration |
| Web hosting | Azure Static Web Apps free tier |
| Online-mode backend | Azure Container Apps for explicitly consented redirect expansion and future first-party enrichment |
| GitHub Copilot | Free tier available; paid plans optional |

The local-first design means the free static hosting tier carries the default web experience. Backend cost begins only when users explicitly consent to checks that call first-party services, such as redirect expansion.

GitHub Copilot may be used to build the commercial application. It does not remove responsibility for code review, security testing, dependency license checks, or protecting keys, credentials, user scans, and private datasets.

New Google Play **personal** accounts must run a closed test with at least 12 testers opted in continuously for 14 days before production access. This makes account-type choice an early decision, not a release-time one.

---

## 9. Maintenance rules for this folder

- Keep these documents as the source of truth; do not fork copies elsewhere.
- Preserve source links and stated uncertainties when editing.
- Record the verification date whenever a platform or policy claim is rechecked.
- Update the implementation plan when scope, architecture, or phase order changes.
- Do not weaken the product invariants without an explicit recorded decision.
