# QR Safety Application: Unified Core and Web Surface Research

**Research date:** 26 July 2026
**Question:** Can iOS, Android, and a web application share one core and one algorithm implementation, while mobile apps stay fully native?
**Short answer:** Yes — and it can be a shared *implementation*, not only a shared *specification*.

---

## 1. Direct answer

You can have **one real, compiled, shared security core** across all three surfaces.

The mechanism is a single Rust library compiled three ways:

| Surface | Compilation target | Binding technology | Result |
|---|---|---|---|
| iOS | `aarch64-apple-ios` | UniFFI | Native static library called from Swift |
| Android | `aarch64-linux-android` and friends | UniFFI | Native `.so` called from Kotlin via JNI |
| Web | `wasm32-unknown-unknown` | wasm-bindgen / wasm-pack | WebAssembly module called from TypeScript |
| Backend | native host target | direct Rust | Same crate linked into the service |

This is the same source file producing the verdict on an iPhone, a Pixel, in Safari, and on the server. Not four implementations kept in sync by documentation.

**Crucially, this does not compromise mobile nativeness.** The shared core contains no user interface, no camera code, and no platform APIs. iOS remains pure SwiftUI with VisionKit, App Intents, widgets, and Locked Camera Capture. Android remains pure Kotlin/Compose with CameraX and ML Kit. The shared core is invisible to the user; it is the part that decides *what a URL means*, which is exactly the part that must never diverge.

**However**, roughly 25-30% of the product genuinely cannot share an implementation. That part is unified at specification and conformance-test level only. Section 3 draws the line precisely.

---

## 2. Why this matters for this specific product

For most applications, a shared core is a convenience. For this one it is a correctness requirement.

The product's core promise is a security verdict. If the iOS build classifies `paypa1-secure.example` as suspicious and the web build does not, the product is not merely inconsistent — it is unsafe, and the inconsistency will be discovered by an attacker before it is discovered by you.

The security-critical logic is also the logic most prone to subtle divergence:

- URL parsing edge cases.
- Percent-encoding and backslash handling.
- IDN and Punycode conversion.
- Unicode confusable skeletons.
- Public Suffix List boundary rules.
- Verdict precedence and thresholds.

These are exactly the areas where three independent implementations would drift. Three implementations means three parsers, and three parsers means parser-differential vulnerabilities.

A shared core turns "keep three implementations consistent" into a build-time guarantee.

---

## 3. The three-layer reality

Be honest about what unifies and what does not.

### Layer A: Unified implementation (one Rust source, all surfaces)

Everything security-meaningful:

- Payload type classification.
- WHATWG URL parsing and canonicalization.
- Raw, display, canonical, and lookup representations.
- IDNA / UTS #46 processing.
- Punycode conversion.
- UTS #39 confusable skeletons and mixed-script detection.
- Public Suffix List and registrable-domain resolution.
- Dangerous-scheme policy.
- All deterministic detection rules.
- Signed rule package parsing, signature verification, rollback and expiry checks.
- Classifier feature extraction.
- Classifier inference (see section 7.3 — this is a change from the earlier plan).
- Verdict precedence and thresholds.
- Evidence and finding schema plus serialization.
- Explanation template selection and safe interpolation.
- Remote-evidence merging.
- Golden test vectors.

This layer is where bugs become vulnerabilities. It is fully shared.

### Layer B: Unified specification and conformance tests only

Behaviour is defined once, implemented per platform, and proven equivalent by a shared corpus:

- **QR decoding.** Native decoders are strongly preferred on mobile for camera quality; the web has no usable native decoder. See section 8.
- **Camera acquisition** — frame handling, focus, torch, duplicate suppression.
- **Consent and permission flows** — different permission models per platform.
- **Storage and caching of rule packages** — different storage APIs and guarantees.
- **Optional generative explanation** — three different on-device model APIs, all non-authoritative.

### Layer C: Genuinely platform-specific, no unification attempted

- SwiftUI vs Jetpack Compose vs web UI framework.
- iOS Share extension, App Intents, Siri, widgets, Control Center, Locked Camera Capture, Visual Intelligence.
- Android Sharesheet receiver, shortcuts, widgets, Quick Settings tile.
- Web service worker, install prompt, and Web Share Target where supported.
- App Store and Google Play packaging, signing, and review.
- Accessibility integration with each platform's assistive technology.

Attempting to unify Layer C is what makes cross-platform products feel non-native. Leave it alone.

---

## 4. Verified evidence for the Rust + WebAssembly path

### 4.1 UniFFI covers Swift and Kotlin

Mozilla's UniFFI generates foreign-language bindings from a Rust library and documents **full support for Kotlin, Swift, and Python**. Its stated purpose is "consolidating business logic in a single Rust library while targeting multiple platforms."

UniFFI does **not** target WebAssembly or JavaScript. The web binding is a separate, parallel layer.

Source: https://mozilla.github.io/uniffi-rs/latest/

### 4.2 wasm-bindgen / wasm-pack covers the web

The same crate compiles to `wasm32-unknown-unknown` and is exposed to TypeScript through wasm-bindgen, packaged with wasm-pack as a consumable npm module.

This is the standard, mature Rust-to-browser toolchain.

Sources:
- https://rustwasm.github.io/docs/wasm-bindgen/
- https://rustwasm.github.io/docs/wasm-pack/

### 4.3 Every required security dependency is pure Rust

All of these compile to WebAssembly without modification, because none of them require operating-system services:

| Need | Crate | Verified property |
|---|---|---|
| WHATWG URL parsing | `url` | "an implementation of the URL Standard"; exposes scheme, username, password, host, port, path, query, fragment separately |
| IDN handling | `idna` | IDNA2003/IDNA2008/UTS #46 transitional processing |
| Confusable and mixed-script detection | `unicode-security` | Implements UTS #39; supports `no_std` |
| Registrable domain | `publicsuffix` | Native Rust implementation of Mozilla's Public Suffix List |
| QR decoding (web) | `rxing` | Rust port of ZXing; `rxing-wasm` package exists for browser use |

Sources:
- https://docs.rs/url/latest/url/
- https://docs.rs/idna/latest/idna/
- https://docs.rs/unicode-security/latest/unicode_security/
- https://docs.rs/publicsuffix/latest/publicsuffix/
- https://docs.rs/rxing/latest/rxing/

The `url` crate exposing username and password as distinct fields matters directly: it is what makes `https://trusted.no@evil.example` detectable rather than merely displayable.

### 4.4 No platform ML runtime is needed for the v1 classifier

Because the planned model is a regularized logistic regression over deterministic features, inference is a dot product plus a logistic function. That can live in Rust.

This removes Core ML conversion, LiteRT conversion, ONNX Runtime Web, and the entire three-way numeric parity testing burden from v1. See section 7.3.

---

## 5. Alternatives considered and rejected

### 5.1 Kotlin Multiplatform

Genuine option. Shares Kotlin to Android natively, to iOS via Kotlin/Native, and to web via Kotlin/Wasm.

Rejected as the primary core because:

- **Kotlin/Wasm is still Beta** per JetBrains' own documentation. A security core should not sit on a Beta compilation target.
- It embeds a Kotlin runtime into the iOS binary, which works but adds weight and a second toolchain to a Swift-native app.
- The exact libraries this product needs — WHATWG URL, UTS #46, UTS #39 confusables, PSL, ZXing — are more mature and directly available in the Rust ecosystem.
- Rust produces smaller WebAssembly with no runtime, which matters for first-visit web load.

Reconsider only if the team is Kotlin-only and cannot maintain Rust.

Source: https://kotlinlang.org/docs/wasm-overview.html

### 5.2 A TypeScript core shared everywhere

Rejected. Sharing TypeScript to mobile means embedding a JavaScript engine in both native apps, or building both apps in React Native. That directly contradicts the requirement that mobile apps be as native as possible, and it puts a JIT-capable runtime inside the security boundary.

TypeScript remains the right choice for the web *user interface*, just not for the core.

### 5.3 Shared C or C++ core

Technically viable and compiles everywhere. Rejected because this core parses hostile attacker-controlled input as its primary job. Memory-unsafe parsing of hostile input is the single highest-risk design choice available. Rust removes that entire vulnerability class while producing equivalent binaries.

### 5.4 Three independent implementations, unified by written specification only

Rejected. This is the status quo the question is trying to avoid. It guarantees eventual divergence in exactly the areas where divergence is a security bug, and it triples the cost of every rule change, every threshold recalibration, and every parser fix.

Specification-level unification is a fallback for the parts that genuinely cannot share code — not a strategy for the parts that can.

---

## 6. Verified web platform constraints

The web surface is real but weaker than native. These constraints are verified and shape the design.

### 6.1 The browser QR decoder is effectively unusable

This is the most important web finding.

`BarcodeDetector` support per MDN browser-compat-data:

| Browser | Status |
|---|---|
| Chrome Android 83+ | Supported |
| Chrome desktop 88+ | Partial — **ChromeOS and macOS only** |
| Edge | Partial — macOS only |
| Firefox | **Not supported** |
| Safari 17+ | **Behind a preference flag** (`Shape Detection API`) |
| Safari on iOS | Mirrors Safari — **effectively unavailable** |

Marked experimental in the specification data.

**Consequence:** a web app cannot rely on the browser to read QR codes. It must ship its own decoder as WebAssembly. Two viable options:

1. `rxing` compiled into the same Rust core — one artifact, one toolchain.
2. `zxing-wasm`, a maintained ZXing-C++ WebAssembly npm package with TypeScript types.

Recommendation: attempt `rxing` in-core first for single-artifact simplicity; fall back to `zxing-wasm` if decode quality or module size proves worse in measurement.

Sources:
- https://raw.githubusercontent.com/mdn/browser-compat-data/main/api/BarcodeDetector.json
- https://caniuse.com/mdn-api_barcodedetector
- https://github.com/Sec-ant/zxing-wasm

### 6.2 Camera access does work everywhere

`MediaDevices` is supported in Chrome 47+, Edge 12+, Firefox 33+, and **Safari 11+**, with iOS Safari mirroring desktop Safari.

So live web scanning is possible on iPhone — it requires HTTPS and a user gesture, and the decoding is done by your WebAssembly module rather than by the browser.

Source: https://raw.githubusercontent.com/mdn/browser-compat-data/main/api/MediaDevices.json

### 6.3 Web Share Target does not exist on iOS

| Browser | `share_target` support |
|---|---|
| Chrome Android 76+ | Supported |
| Chrome desktop 89+ | Supported |
| Edge, Opera | Supported |
| Firefox | Not supported |
| **Safari and Safari iOS** | **Not supported** |

**Consequence:** on Android the installed web app can appear in the system share sheet, which is a genuinely useful entry point. On iOS it cannot. The iOS web experience is limited to opening the site and pasting or selecting an image. This is a concrete argument for the native iOS app rather than a web-only iOS strategy.

Source: https://raw.githubusercontent.com/mdn/browser-compat-data/main/manifests/webapp/share_target.json

### 6.4 Web offline storage is best-effort, not guaranteed

Per WebKit's storage policy:

- Origin quota is up to 60% of total disk space for browser apps.
- A Home Screen Web App gets the same quota as in the browser.
- Eviction can occur when overall quota is exceeded, under system storage pressure, or when **the site has not been interacted with for some time** under Intelligent Tracking Prevention.
- Origins default to best-effort mode; persistence must be requested via `StorageManager.persist()`, and WebKit grants it heuristically, more readily for Home Screen Web Apps.

**Consequence:** the native apps can promise "works offline, always." The web app can only promise "works offline if the browser has retained the cached assets." The user-facing wording must differ. The web app must degrade gracefully and re-fetch rather than fail silently.

Source: https://webkit.org/blog/14403/updates-to-storage-policy/

### 6.5 Browser-based generative AI is not a mobile option

Chrome's built-in Prompt API (Gemini Nano in the browser) requires:

- Windows 10/11, macOS 13+, Linux, or ChromeOS on Chromebook Plus.
- **Chrome for Android and iOS are explicitly not supported.**
- At least 22 GB free space on the Chrome profile volume.
- More than 4 GB VRAM, or 16 GB RAM and 4+ CPU cores.
- A separate model download per origin on first use.

**Consequence:** the web surface uses deterministic explanation templates only. This is fine, because templates were already the required baseline on every platform, and they live in the shared Rust core — so web explanations are automatically identical to mobile template explanations.

Source: https://developer.chrome.com/docs/ai/prompt-api

### 6.6 Everything else the web cannot do

- No Locked Camera Capture, Action Button, or Control Center entry.
- No Siri or App Intents.
- No home-screen widgets or Quick Settings tile.
- No background processing.
- No App Store or Play Store presence, and therefore none of the trust signals that come with it.
- No native haptics parity.

---

## 7. Revisions this research forces on the existing plan

Three changes to `qr-safety-implementation-plan.md`.

### 7.1 The core must be WebAssembly-clean from commit one

Add a hard constraint to the Rust workspace: the core crate must build for `wasm32-unknown-unknown` in CI from the very first commit.

This means the core may not use:

- File system access.
- Threads, unless behind a feature flag disabled for wasm.
- System time, except via an injected clock value.
- Networking of any kind.
- Random number generation, except via an injected seed or an explicitly wasm-compatible source.
- Any crate that transitively requires the above.

Rule packages and the current timestamp are **passed in** by the host application rather than read by the core. This is good design regardless of the web, because it also makes the core trivially testable and keeps it side-effect free.

Retrofitting wasm compatibility later is painful. Enforcing it from the start costs almost nothing.

### 7.2 Add a fourth consumer: the backend

Since the core is a plain Rust crate, the online-mode backend should link it directly. Then redirect-evidence merging and verdict computation are literally the same code server-side as client-side, which eliminates a whole category of "the server said suspicious but the app said unknown" bugs.

Four surfaces, one core.

### 7.3 Move classifier inference into the core

The earlier plan specified Core ML for iOS and LiteRT for Android, with a numeric parity test between them. Given a logistic-regression model, this is unnecessary complexity.

Revised approach for v1:

- Train offline in Python as planned.
- Export **coefficients and calibration parameters as signed data**, not as a platform model binary.
- Implement inference in Rust — a dot product and a logistic function.
- Result: bit-identical scores on iOS, Android, web, and server. No conversion step, no three-way parity suite, no runtime dependency.

Keep Core ML / LiteRT / ONNX Runtime Web in reserve. They become necessary only if the model later grows into a genuine neural network, at which point the three-way parity problem returns and must be budgeted for. Treat that as a deliberate future decision, not a default.

---

## 8. The decoder divergence risk

This is the most under-appreciated technical risk in a multi-surface QR product, and it deserves explicit handling.

Three different decoders will be in play:

- iOS: VisionKit / Vision.
- Android: ML Kit.
- Web: `rxing` or `zxing-wasm`.

They can return **different strings for the same physical QR code**, particularly with:

- ECI (Extended Channel Interpretation) designators.
- Non-UTF-8 byte-mode payloads.
- Shift-JIS content.
- Embedded null bytes and control characters.
- Binary payloads that are not valid text at all.
- Trailing whitespace or padding handling.

If the decoders disagree, the shared core is fed different input and correctly produces different verdicts — the unification silently fails at the boundary.

**Required mitigation:**

1. Build a decoder conformance corpus of QR images with known exact expected bytes, including the awkward cases above.
2. Run every decoder against it on real devices and real browsers.
3. Assert byte-level equality, not string equality.
4. Where a platform decoder is lossy, prefer obtaining raw bytes rather than a decoded string, and let the core do the text interpretation.
5. Record decoder identity and version in the evidence record so field discrepancies are diagnosable.
6. Treat any decoder disagreement as a release-blocking defect.

The reason to let the core interpret bytes into text is that text interpretation is itself a security-relevant decision. Pushing it into the shared layer removes one more source of divergence.

---

## 9. Recommended technology stack

### 9.1 Shared core

| Concern | Choice |
|---|---|
| Language | Rust, stable toolchain |
| Mobile bindings | UniFFI → Swift and Kotlin |
| Web bindings | wasm-bindgen + wasm-pack → npm package |
| Backend | direct crate dependency |
| URL | `url` |
| IDN | `idna` |
| Unicode security | `unicode-security` |
| Public suffix | `publicsuffix` |
| Serialization | `serde` with an explicitly versioned schema |
| Signatures | a vetted, audited signature crate; Ed25519 |
| Web QR decode | `rxing` in-core, or `zxing-wasm` as fallback |
| Testing | `cargo test`, `proptest`, `cargo-fuzz`, shared golden vectors |

### 9.2 iOS — unchanged, fully native

Swift, SwiftUI, VisionKit `DataScannerViewController`, AVFoundation fallback, Vision for still images, PhotosPicker, App Intents, WidgetKit, Share extension, LockedCameraCapture. Core consumed as a Swift package wrapping the UniFFI-generated bindings and an XCFramework.

### 9.3 Android — unchanged, fully native

Kotlin, Jetpack Compose, CameraX, bundled ML Kit barcode scanning, Photo Picker, Sharesheet receiver, shortcuts, Glance widgets. Core consumed as an AAR wrapping the UniFFI-generated Kotlin bindings and JNI libraries.

### 9.4 Web

| Concern | Recommendation | Rationale |
|---|---|---|
| Language | TypeScript, strict mode | Type safety at the WASM boundary |
| Build | Vite | Fast, first-class WASM and web worker support |
| UI framework | React, or Svelte for a smaller bundle | Broad ecosystem vs minimal payload; either is acceptable |
| Styling | Tailwind CSS or plain CSS modules | Avoid heavy component libraries; the UI is small |
| PWA | `vite-plugin-pwa` with Workbox | Service worker, manifest, offline caching of the WASM module |
| Core execution | Web Worker | Keeps decode and analysis off the main thread |
| Camera | `getUserMedia` + `<video>` + `OffscreenCanvas` | Supported in Safari 11+ |
| QR decode | WASM decoder, always | `BarcodeDetector` is unusable in Safari and Firefox |
| Image input | `<input type="file" accept="image/*">` plus drag-and-drop and paste | Works on every browser including iOS |
| Share entry | Web Share Target on Android only, feature-detected | Unsupported on iOS Safari |
| State | Minimal — component state plus a small store | The app is a single flow |
| i18n | The core returns finding codes; the web app holds the same `nb`/`nn`/`en` catalogs | Guarantees identical wording |
| Testing | Vitest, Playwright across Chromium, Firefox, and WebKit | WebKit coverage is essential given Safari's divergence |

Playwright's WebKit target is important here. Safari is the browser where the most web assumptions break, and it is the dominant mobile browser among the iOS half of the Norwegian market.

### 9.5 Hosting

Matches the stated preference for Azure free tiers:

- **Web app** → Azure Static Web Apps free tier. The build output is fully static: HTML, JS, WASM, and rule assets. This is an ideal fit, with HTTPS and a global CDN included.
- **Online-mode backend and redirect worker** → Azure Container Apps. The redirect worker must remain a separately isolated egress-controlled service, as specified in the technical research. Do **not** co-locate it with the static site or with the main API.

The offline-first design means the free static tier carries the entire default product experience. Backend cost only begins when a user explicitly enables online mode.

---

## 10. Repository layout with the web surface

```text
qr-safety/
  core/                        # the one shared implementation
    crates/
      safety-core/             # must build for wasm32 in CI
      payload/
      url-policy/
      unicode-security-ext/
      rules/
      classifier/              # feature extraction + inference
      verdict/
      signatures/
      evidence-schema/
      explanation-templates/
      test-support/
    bindings/
      uniffi/                  # Swift + Kotlin
      wasm/                    # wasm-bindgen + wasm-pack
  apps/
    ios/                       # SwiftUI, fully native
    android/                   # Compose, fully native
    web/                       # Vite + TypeScript PWA
  services/
    api/                       # links core directly
    redirect-worker/           # isolated, SSRF-hardened
  contracts/
  models/
  rules/
  test-vectors/
    decoder-conformance/       # new: byte-level QR decoder corpus
  localization/
  docs/
```

---

## 11. Feature parity across the three surfaces

| Capability | iOS native | Android native | Web |
|---|---|---|---|
| Live camera scanning | Full | Full | Yes, WASM decode |
| Image / screenshot scanning | Full | Full | Full |
| Paste a link | Full | Full | Full |
| Identical verdict logic | Yes | Yes | Yes |
| Identical Norwegian explanations | Yes | Yes | Yes |
| Guaranteed offline | Yes | Yes | Best-effort only |
| System share sheet entry | Yes | Yes | Android only |
| Home-screen widget | Yes | Yes | No |
| Lock-screen / one-tap entry | Yes | Yes | No |
| Voice assistant entry | Yes | Yes | No |
| Optional on-device generative explanation | Eligible devices | Eligible devices | No |
| Install friction | App Store | Play Store | None — just a URL |
| Store trust signals | Yes | Yes | No |

The web app's unique advantage is **zero install friction**. That makes it the ideal surface for a link in a bank's fraud-warning page, a municipal advisory, a news article, or a QR-safety awareness campaign — someone can check a suspicious link in five seconds without installing anything. It is a powerful acquisition channel for the native apps, not a replacement for them.

---

## 12. Risks and mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| Decoder divergence between platforms | Same QR yields different verdicts | Byte-level conformance corpus; release-blocking |
| WASM bundle size hurts first visit | Web abandonment | Lazy-load the decoder; compress; measure; consider `zxing-wasm` separately |
| Rust skills concentrated in one person | Bus factor on the most critical code | Keep the core small and heavily tested; document thoroughly; treat it as reviewed code |
| A dependency is not wasm-compatible | Blocks the web surface | CI builds wasm from commit one, so this is caught immediately |
| Browser storage eviction | Web offline promise breaks | Request persistence; degrade gracefully; word the promise honestly |
| iOS web surface looks weak vs Android | Inconsistent expectations | Position web as a quick-check tool; drive iOS users to the native app |
| UniFFI or wasm-bindgen breaking changes | Build breakage | Pin versions; regenerate bindings in CI and fail on drift |
| Core becomes a dumping ground | Loses portability | Enforce the "no platform APIs, no I/O, no network" rule in review |

---

## 13. Recommended delivery order

The web surface should not delay the mobile plan, but the core must be wasm-clean immediately.

| Stage | Action |
|---|---|
| Now | Add the wasm32 CI build to the core from the first commit; keep the core free of I/O, time, threads, and networking |
| With Phase 3-4 | As the payload, URL, and verdict logic land, verify each builds and passes tests under wasm |
| After Phase 4 | Build a minimal web proof-of-concept: paste a URL, get a verdict. No camera. Proves the whole binding chain end-to-end |
| After Phase 5 | Add web camera scanning and the WASM QR decoder; build the decoder conformance corpus |
| After Phase 7 | Ship the public web app on Azure Static Web Apps as an acquisition channel alongside the first TestFlight build |
| With Phase 10 | Web gains the same explicit online mode, using the same backend and same core |
| With Phase 11 | Android joins; all four surfaces now share one core |

The proof-of-concept after Phase 4 is the important checkpoint: it validates that the same Rust source really does produce identical verdicts in Swift and in a browser, while the code is still small enough to fix cheaply if something is wrong.

---

## 14. Final verdict

**One unified core across iOS, Android, and web is achievable as a genuine shared implementation.** Use Rust, exposed through UniFFI to Swift and Kotlin and through wasm-bindgen to TypeScript, with the backend linking the same crate directly.

**Mobile nativeness is fully preserved**, because the shared core deliberately excludes all UI, camera, and platform-integration code. SwiftUI and Compose remain untouched.

**Unification is not total, and should not be.** QR decoding, camera handling, permissions, storage, and optional on-device generative models are unified by specification and conformance tests rather than by shared code. That is the correct boundary, not a compromise.

**Two findings change the design:**

1. The browser's `BarcodeDetector` is unusable in Safari and Firefox, so the web app must ship its own WebAssembly decoder. This makes the web decoder a first-class component rather than a thin wrapper.
2. Because the v1 classifier is a linear model, its inference belongs in the Rust core. This removes Core ML and LiteRT from v1 entirely and delivers bit-identical scores everywhere.

**The single most important safeguard** is the decoder conformance corpus. Everything above the decoder is provably identical; the decoder is the one place where the three surfaces can silently disagree.

---

## 15. Sources

### Shared core technology

- UniFFI — https://mozilla.github.io/uniffi-rs/latest/
- wasm-bindgen — https://rustwasm.github.io/docs/wasm-bindgen/
- wasm-pack — https://rustwasm.github.io/docs/wasm-pack/
- Kotlin/Wasm overview — https://kotlinlang.org/docs/wasm-overview.html

### Rust crates

- `url` — https://docs.rs/url/latest/url/
- `idna` — https://docs.rs/idna/latest/idna/
- `unicode-security` — https://docs.rs/unicode-security/latest/unicode_security/
- `publicsuffix` — https://docs.rs/publicsuffix/latest/publicsuffix/
- `rxing` — https://docs.rs/rxing/latest/rxing/

### Web platform

- BarcodeDetector compat data — https://raw.githubusercontent.com/mdn/browser-compat-data/main/api/BarcodeDetector.json
- BarcodeDetector support table — https://caniuse.com/mdn-api_barcodedetector
- MediaDevices compat data — https://raw.githubusercontent.com/mdn/browser-compat-data/main/api/MediaDevices.json
- Web Share Target compat data — https://raw.githubusercontent.com/mdn/browser-compat-data/main/manifests/webapp/share_target.json
- WebKit storage policy — https://webkit.org/blog/14403/updates-to-storage-policy/
- Chrome Prompt API — https://developer.chrome.com/docs/ai/prompt-api
- zxing-wasm — https://github.com/Sec-ant/zxing-wasm
- ONNX Runtime Web — https://onnxruntime.ai/docs/tutorials/web/
