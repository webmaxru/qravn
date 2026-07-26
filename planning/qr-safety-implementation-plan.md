# QR Safety Application: iOS-First Multi-Platform Implementation Plan

## Problem

Build the first production-quality version of a Norway-focused QR safety application for iOS without creating an iOS-only security engine that must later be rewritten for Android.

The application must:

- Decode QR codes locally and never navigate automatically.
- Display the complete payload before any external action.
- Work usefully without a network connection.
- Analyse URLs with deterministic rules and a compact classifier.
- Explain evidence in Bokmål and Nynorsk.
- Allow deeper online analysis only after explicit consent.
- Preserve identical verdict semantics on iOS and Android.
- Keep generative AI outside the authoritative verdict path.
- Support native platform entry points without moving platform concerns into the shared core.

The implementation is iOS-first, but the domain model, evidence schema, rule format, classifier features, verdict policy, test vectors, and online protocol are platform-agnostic from the first commit.

## Proposed approach

Use native platform shells with a narrow shared Rust safety core:

- iOS: Swift, SwiftUI, VisionKit, Vision, AVFoundation, App Intents, WidgetKit, and native extensions.
- Android later: Kotlin, Jetpack Compose, CameraX, and ML Kit.
- Web later: TypeScript, Vite, and a progressive web application consuming the same core as WebAssembly.
- Shared core: Rust library exposed through UniFFI-generated Swift and Kotlin bindings, and through wasm-bindgen for the browser.
- Backend later: isolated services for reputation, redirect expansion, and optional page analysis, linking the same Rust crate directly.
- AI explanation: a platform-neutral `ExplanationAgent` contract with deterministic templates as the required implementation and optional platform-specific model adapters.

The shared core owns security meaning. Native applications own platform lifecycle and presentation.

The core is therefore compiled four ways from one source:

| Consumer | Target | Binding |
|---|---|---|
| iOS | `aarch64-apple-ios` | UniFFI to Swift |
| Android | Android ABIs | UniFFI to Kotlin |
| Web | `wasm32-unknown-unknown` | wasm-bindgen to TypeScript |
| Backend | host native | direct crate dependency |

## Non-negotiable product invariants

1. A scan never opens a browser, application, telephone action, message, Wi-Fi join flow, payment flow, or deep link automatically.
2. Every payload and every value derived from it is untrusted.
3. The original payload is immutable and never replaced by a canonicalized value.
4. The user's device does not contact a scanned destination during analysis.
5. Online mode is separately enabled and clearly distinguished from offline analysis.
6. Redirect expansion runs only in isolated server infrastructure.
7. The verdict is determined by reproducible evidence and calibrated policy, not generative text.
8. Generative models receive only bounded structured evidence and cannot use tools or networking.
9. Failures and unavailable checks never become reassuring verdicts.
10. The four public verdicts are:
   - `known_malicious`
   - `suspicious`
   - `insufficient_evidence`
   - `no_known_threat_found`
11. The UI never uses an unqualified `safe` label.
12. Offline mode remains functional with Apple Intelligence disabled, no previously downloaded model, and stale local threat data.

## Architecture decision

### Native shells

Use native UI and native integration on both platforms because the highest-value entry points are platform-specific:

- iOS live camera, Share extension, App Intents, Control Center, widgets, Locked Camera Capture, and Visual Intelligence.
- Android live camera, Sharesheet receiver, shortcuts, widgets, and Quick Settings.

React Native, Flutter, or a WebView shell would not remove the native extension work and would add bridge and lifecycle complexity.

### Shared Rust safety core

Rust is selected for the narrow security-sensitive core because it provides:

- One parser and policy implementation for iOS, Android, web, and server.
- Memory-safe processing of hostile payloads.
- Stable serialization and signature verification.
- One golden test suite.
- Native binaries without a managed runtime, and compact WebAssembly for the browser.
- Clear control over what crosses the FFI boundary.

### Portability constraint on the core

The core crate must build for `wasm32-unknown-unknown` in CI from the first commit. Consequently the core may not use:

- File system access.
- Threads, unless behind a feature flag disabled for the wasm target.
- System time, except through an injected clock value.
- Networking of any kind.
- Random number generation, except through an injected seed or an explicitly wasm-compatible source.
- Any dependency that transitively requires the above.

Rule packages and the current timestamp are supplied by the host application rather than read by the core. This also makes the core side-effect free and trivially testable.

Rust does not own:

- Camera sessions.
- Photo library access.
- Share extension lifecycle.
- SwiftUI, Compose, or web UI state.
- App Intents, Siri, widgets, or controls.
- Platform permissions.
- Platform storage handles, including browser storage.
- Foundation Models, Core ML, Gemini Nano, LiteRT, or browser AI runtime objects.
- Browser or external-action dispatch.
- Service worker or install lifecycle.

### Platform-neutral agent model

The word `agent` refers only to an explanation or orchestration component. It does not imply autonomous browsing.

Define three separate concepts:

1. `SafetyEngine`
   - Authoritative.
   - Deterministic except for a versioned compact classifier.
   - Produces typed evidence, uncertainty, and verdict.
   - Shared across iOS, Android, web, and server.

2. `AnalysisCoordinator`
   - Applies an explicit `AnalysisPolicy`.
   - Runs local analysis immediately.
   - Requests optional remote evidence only when allowed.
   - Merges evidence through the shared verdict policy.
   - Has no authority to open destinations.

3. `ExplanationAgent`
   - Receives an immutable `ExplanationInput`.
   - Returns presentation text in a constrained schema.
   - Cannot change verdict, findings, uncertainty, or recommended actions.
   - Required implementation: deterministic localized templates.
   - Optional implementations: Apple Foundation Models, Gemini Nano, or separately consented server model.

This separation prevents a platform model or LLM from becoming the security engine.

## Proposed repository layout

Use a monorepo so contracts and test vectors cannot drift:

```text
qr-safety/
  apps/
    ios/
      QRSafety.xcodeproj
      App/
      Features/
      Platform/
      Extensions/
      Resources/
      Tests/
      UITests/
    android/
      app/
      features/
      platform/
      tests/
    web/
      src/
        ui/
        worker/
        decoder/
        i18n/
      public/
      tests/
  core/
    Cargo.toml
    crates/
      safety-api/
      payload/
      url-policy/
      unicode-security/
      rules/
      classifier-features/
      classifier/
      verdict/
      signatures/
      evidence-schema/
      explanation-templates/
      test-support/
    bindings/
      uniffi/
      wasm/
  contracts/
    evidence/
    rules/
    remote-api/
  models/
    url-classifier/
      training/
      evaluation/
      exports/
      metadata/
  rules/
    source/
    fixtures/
    signed/
  test-vectors/
    payloads/
    urls/
    unicode/
    rules/
    classifier/
    qr-images/
    decoder-conformance/
  services/
    api/
    redirect-worker/
    provider-adapters/
  localization/
    nb/
    nn/
    en/
  docs/
  tools/
```

Only create `apps/ios`, `core`, `contracts`, `rules`, `test-vectors`, and localization assets during the initial iOS implementation. Android, web, and backend directories can remain contract placeholders until their phases begin. The `core/bindings/wasm` target is the exception: it is created in Phase 1 so that WebAssembly compatibility is enforced continuously rather than discovered late.

## Shared core modules

### `safety-api`

Public facade exposed to Swift, Kotlin, and TypeScript:

```text
analyze_payload(input, policy, assets) -> Assessment
validate_rule_package(bytes, current_state) -> RuleInstallResult
extract_classifier_features(parsed_url) -> FeatureVector
merge_remote_evidence(local, remote, policy) -> Assessment
```

The public API must be small, versioned, synchronous for local analysis, and free of platform handles.

### `payload`

Responsibilities:

- Preserve raw bytes and decoded text.
- Detect control and bidirectional characters.
- Classify URL, text, Wi-Fi, vCard/contact, calendar, email, telephone, SMS, geo, payment/deep link, and unknown payloads.
- Parse non-URL payloads without triggering actions.
- Enforce length and recursion limits.
- Produce safe display metadata.

### `url-policy`

Responsibilities:

- Use a standards-conforming URL implementation.
- Parse scheme, user information, host, port, path, query, and fragment.
- Preserve raw, display, canonical, and lookup representations separately.
- Determine registrable domain from a bundled Public Suffix List snapshot.
- Detect IP literals, ambiguous numeric forms, encoded separators, excessive components, nested URLs, suspicious redirect parameters, and dangerous schemes.
- Never perform DNS or network access.

### `unicode-security`

Responsibilities:

- IDNA/UTS #46 processing.
- Unicode and ASCII/Punycode host representations.
- UTS #39 confusable skeletons.
- Mixed-script and restriction-level checks.
- Norwegian-aware handling of `æ`, `ø`, and `å`.
- Brand-specific confusable comparison.

Non-ASCII is evidence, not an automatic malicious verdict.

### `rules`

Responsibilities:

- Evaluate known shorteners.
- Evaluate dangerous schemes.
- Evaluate Norwegian brand/domain mappings.
- Evaluate known malicious indicators where licensing permits.
- Evaluate open-redirect patterns and lexical indicators.
- Provide stable rule IDs and versions.
- Report rule-data freshness.

### `classifier-features`

Responsibilities:

- Produce the exact versioned feature vector used during training.
- Contain no platform ML runtime code.
- Support parity tests across Core ML and LiteRT exports.
- Include lexical and structural URL features without hiding direct provider hits inside the model score.

### `verdict`

Responsibilities:

- Combine findings, classifier output, remote evidence, and uncertainty.
- Apply explicit precedence and threshold policy.
- Emit one of the four public verdicts.
- Prevent weak evidence from becoming `known_malicious`.
- Prevent missing online checks from becoming `no_known_threat_found` without a clear limitation.
- Emit recommended safe actions as typed codes.

### `signatures`

Responsibilities:

- Verify signed rule/model manifests.
- Validate schema and compatibility versions.
- Reject rollback and expired/revoked packages according to policy.
- Preserve the last known good package.
- Support key rotation and emergency revocation.

### `evidence-schema`

Own the versioned cross-platform records and serialization.

The schema is the compatibility boundary among:

- Shared core.
- iOS UI and extensions.
- Future Android UI.
- Model training and evaluation.
- Backend provider adapters.
- Redirect worker.
- Support and false-positive reporting.

## Cross-platform data contracts

### Input

```text
ScanInput
  schema_version
  source
  captured_at
  raw_bytes?
  raw_text
  source_metadata
```

`source` values:

- `live_camera`
- `photo_picker`
- `share_extension`
- `shared_text`
- `manual_input`
- future Android equivalents use the same values where semantics match

### Parsed payload

```text
ParsedPayload
  type
  raw_payload
  display_payload
  control_character_annotations
  structured_fields
  url?
```

### URL record

```text
URLRecord
  raw
  display
  canonical
  lookup
  scheme
  username_present
  password_present
  unicode_host
  ascii_host
  registrable_domain
  port
  path
  query_metadata
  fragment_metadata
```

Sensitive query values remain outside routine logs and ordinary analytics.

### Finding

```text
Finding
  code
  severity
  source
  observed_values
  rule_id?
  rule_version?
  model_version?
  provider?
  checked_at?
```

Finding codes, not localized prose, cross the FFI boundary.

### Assessment

```text
Assessment
  schema_version
  scan_id
  payload
  findings[]
  classifier?
  providers[]
  redirect_hops[]
  verdict
  confidence_band
  uncertainties[]
  recommended_actions[]
  rules_version
  rules_updated_at
  analysis_mode
```

### Explanation

```text
ExplanationInput
  locale
  verdict
  finding_codes[]
  redacted_observed_values
  uncertainties[]
  recommended_action_codes[]

ExplanationOutput
  title
  summary
  reason_sentences[]
  limitation_sentences[]
  action_sentences[]
  generator
  generator_version
```

Validation requirements:

- Output contains no new finding.
- Output cannot alter verdict.
- Output cannot introduce a URL action.
- Output cannot contain unquoted attacker text outside bounded fields.
- Invalid output falls back to deterministic templates.

## FFI design

Use UniFFI with deliberately simple boundary types:

- Strings.
- Byte arrays.
- Integers and booleans.
- Enums.
- Records.
- Lists.
- Explicit result/error types.

Do not cross the boundary with:

- Swift `URL`.
- Foundation date objects.
- Camera images.
- Core ML objects.
- callbacks that can outlive native owners;
- arbitrary JSON where a typed record is possible;
- platform exceptions.

Rules:

- Convert platform input to owned core DTOs before calling Rust.
- Return immutable value objects.
- Make error codes stable and localizable.
- Fuzz the Rust entry points.
- Generate Swift and Kotlin bindings in CI and fail on uncommitted changes.
- Keep schema and binding versions explicit.

## iOS application architecture

### Targets

Create targets incrementally:

1. `QRSafetyApp`
2. `QRSafetyCoreBindings`
3. `QRSafetyShareExtension`
4. `QRSafetyWidgets`
5. `QRSafetyLockedCamera`

Do not create targets 3-5 until the main scanner and shared core are working.

### Deployment strategy

- Minimum iOS 16 for the initial plan, subject to Norway adoption confirmation.
- Conditional iOS 18 features for Locked Camera Capture and current control surfaces.
- Conditional iOS 26 features for Foundation Models and Visual Intelligence.
- Core functionality must not depend on iOS 26 or Apple Intelligence.

### Swift modules

```text
App/
  AppEnvironment
  AppRouter
  DependencyContainer

Features/
  Scanner/
  ScanResult/
  ImageImport/
  SharedInput/
  Settings/
  Privacy/

Platform/
  Camera/
  Photos/
  Haptics/
  ExternalActions/
  RuleAssets/
  CoreML/
  FoundationModels/
  Networking/

Presentation/
  EvidenceLocalization/
  DesignSystem/
  Accessibility/
```

### Dependency direction

```text
SwiftUI Features
      |
      v
Application Services
      |
      +--> Platform Adapters
      |
      +--> Rust Safety Core
```

The Rust core never imports or calls platform adapters.

### Application state machine

Use exhaustive state rather than unrelated booleans:

```text
idle
requestingPermission
startingCamera
scanning
candidateDetected
analysingLocal
showingLocalResult
requestingOnlineConsent
analysingOnline
showingEnrichedResult
failed(recoverableError)
```

State transitions must enforce:

- One accepted scan at a time.
- Duplicate suppression.
- Cancellation on view disappearance.
- No external action during automatic transitions.
- Local result before online enrichment.
- Recovery after permission denial or camera interruption.

## iOS scanner design

### Preferred live scanner

Use VisionKit `DataScannerViewController`:

- Restrict recognition to QR symbology.
- Capability-check `isSupported` and `isAvailable`.
- Wrap it in SwiftUI.
- Stop or ignore repeated observations after accepting a candidate.
- Provide haptic confirmation.
- Keep scanning UI accessible.

### Fallback scanner

Use AVFoundation:

- `AVCaptureSession`
- `AVCaptureDeviceInput`
- `AVCaptureMetadataOutput`
- QR metadata type
- custom preview layer

The fallback must cover:

- orientation;
- focus;
- zoom;
- torch;
- interruptions;
- application backgrounding;
- duplicate suppression;
- permission changes;
- VoiceOver labels.

### Camera permission

Request in context when the user initiates scanning.

The Norwegian purpose text must state:

- camera access reads QR codes;
- decoding is local;
- images are not retained by default;
- scanned links are never opened automatically.

On denial:

- Offer image import.
- Offer shared or pasted text.
- Explain how to enable permission without blocking the entire application.

### Candidate acceptance

Create a `ScanCandidateGate` in Swift because frame observations are platform events:

- Normalize only for duplicate comparison, not for evidence.
- Require a stable observation or configured confidence condition.
- Freeze acceptance after one candidate.
- Pass the exact raw payload to the shared core.
- Re-enable only after explicit `Scan again`.

## iOS image and shared-input design

### Photo picker

Use the system Photos picker:

- Request only the selected image.
- Avoid full photo-library permission.
- Decode with Vision.
- Apply dimension, memory, and processing limits.
- Release image data after analysis.
- Never upload an image in offline mode.

### Share extension

Accept:

- image;
- file;
- URL;
- plain text.

The extension must:

- Treat every `NSItemProvider` value as hostile.
- Load only explicitly shared data.
- Enforce item count, type, and size limits.
- Use the shared parser/rules and optional tiny classifier.
- Avoid Foundation Models and large assets.
- Display a compact local result.
- Offer an explicit handoff to the full app.

Use an App Group only when a tested handoff requires it. Store only a short-lived, encrypted or minimally sensitive transfer record. Do not use an App Group for the Locked Camera extension while locked because it is unavailable there.

## iOS result experience

The result screen shows:

1. Verdict label, icon, and short summary.
2. Exact payload type.
3. Effective destination host and registrable domain for URLs.
4. Unicode and Punycode host forms where relevant.
5. Initial URL and final URL as separate values when online redirects were checked.
6. Strong findings.
7. Supporting findings.
8. Uncertainty and checks not performed.
9. Rule and evidence freshness.
10. Safe next actions.

Attacker-controlled content:

- Is never rendered as HTML or Markdown.
- Is not automatically linkified.
- Has control and bidi characters exposed.
- Cannot visually hide the host through horizontal overflow.
- Has a monospaced technical view.

Action hierarchy:

- Primary: close or scan again.
- Safe secondary: copy technical details, search for official organization, open official app where independently verified.
- Visually secondary: open destination.
- `known_malicious`: destination opening disabled by default.
- `suspicious`: additional warning and deliberate confirmation.
- non-URL actions: explicit preview and separate confirmation.

## Localization

The shared core emits codes and values, never prose.

Maintain:

- Bokmål (`nb`) as the first complete locale.
- Nynorsk (`nn`) from the same finding catalog.
- English fallback for development, review, and support.

Localization catalog includes:

- verdict labels;
- finding titles;
- finding explanations;
- limitations;
- recommended actions;
- privacy disclosures;
- camera permission rationale;
- online-mode consent;
- stale-data messages.

Each localized finding requires:

- short consumer explanation;
- optional technical explanation;
- accessibility phrasing;
- interpolation rules that safely quote hostile values.

## Rules and update design

### Base bundle

Bundle:

- Public Suffix List snapshot.
- Unicode/IDNA/confusable data.
- dangerous scheme policy;
- Norwegian brand/domain mappings;
- shortener list;
- initial licensed malicious indicators;
- classifier;
- explanation templates;
- self-test vectors;
- manifest with versions and hashes.

### Signed update package

Package metadata:

```text
package_version
schema_version
minimum_core_version
created_at
expires_at
rollback_floor
signing_key_id
assets[]
  path
  type
  version
  sha256
signature
```

Installation:

1. Download only in enabled online mode or through a separately disclosed update policy.
2. Verify signature before parsing mutable content.
3. Verify hashes and compatibility.
4. Reject rollback.
5. Run bundled self-tests against the candidate.
6. Install atomically.
7. Preserve last known good assets.
8. Report age and failure without breaking bundled offline protection.

## Compact classifier plan

### Model scope

Start with regularized logistic regression over deterministic URL features.

Reasons:

- Small model.
- Cross-platform parity.
- Fast CPU inference.
- Explainable coefficients.
- Straightforward calibration.
- No large runtime requirement.

### Training pipeline

Use one source feature implementation:

- Rust exports features for training fixtures, or
- a generated reference specification is validated against Rust.

Training and evaluation can use Python tooling isolated under `models/`, but the feature contract and exported metadata remain platform-neutral.

Evaluation splits:

- chronological;
- registrable domain;
- campaign;
- Norwegian brands;
- legitimate Norwegian IDNs;
- shortened URLs;
- compromised legitimate domains;
- newly registered domains.

Metrics:

- precision-recall area;
- recall at the agreed low false-positive rate;
- false positives per thousand benign scans;
- calibration;
- model size;
- p50/p95 device latency;
- memory;
- energy impact.

### Inference location — revised

Earlier drafts of this plan exported the model to Core ML for iOS and LiteRT for Android, then tested numeric parity between the two runtimes.

That is unnecessary for a linear model. Logistic-regression inference is a dot product followed by a logistic function, so it belongs **inside the Rust core**.

Revised approach for v1:

- Train offline in Python as planned.
- Export **coefficients, feature normalization parameters, and calibration parameters as signed data assets**, not as a platform model binary.
- Implement inference in the `classifier` crate in Rust.
- Version the coefficient set alongside the feature schema and threshold version.

Consequences:

- Scores are bit-identical on iOS, Android, web, and server.
- No Core ML conversion step, no LiteRT conversion step, no ONNX Runtime Web.
- No three-way runtime parity test suite.
- No platform ML runtime dependency, and therefore no runtime-unavailable fallback path.
- Model updates ship through the existing signed rule-package mechanism rather than an app release.

Core ML, LiteRT, and ONNX Runtime Web remain in reserve. They become necessary only if the model later grows into a genuine neural network, at which point the cross-runtime parity problem returns and must be explicitly budgeted. Treat that as a deliberate future decision rather than a default.

### Exports

- Signed coefficient and calibration asset consumed by the Rust `classifier` crate.
- Reference inference in Python test tooling for training-time verification.

For every release model:

- same feature schema;
- same normalization;
- same class meaning;
- same calibration metadata;
- same threshold version;
- golden-vector agreement between the Python reference and the Rust implementation within a defined numeric tolerance.

The classifier remains one finding source. It does not hide deterministic or provider evidence.

## Explanation agent plan

### Template agent

Required on every device:

- Pure mapping from codes to localized templates.
- No model.
- No network.
- Deterministic.
- Complete enough to ship alone.

### Apple Foundation Models agent

Optional on iOS 26+:

- Runtime-check `SystemLanguageModel.availability`.
- Check locale support for `nb_NO` and `nn_NO`.
- Create a fresh session for each assessment.
- Use guided structured output.
- Supply only redacted structured evidence.
- Disable tools.
- Enforce short output.
- Validate output.
- Fall back to templates on any unavailable, invalid, unsafe, or slow result.

Do not create a Foundation Model adapter for MVP.

### Future Android agent

Implement the same `ExplanationAgent` semantics for Gemini Nano:

- Runtime capability check.
- Foreground-only use.
- No verdict authority.
- Same input/output schema.
- Same template fallback.

This validates that the agent design is platform-agnostic rather than Apple-specific.

### Web agent

The web surface uses deterministic templates only.

Chrome's built-in Prompt API does not run on Chrome for Android or Chrome for iOS, and on desktop it requires roughly 22 GB free disk space plus substantial GPU or CPU resources. It is therefore not a viable explanation path for the audience this product targets.

Because templates live in the Rust core, web explanations are automatically identical to the mobile template explanations. No separate web explanation implementation is required.

## Web surface architecture

The web application is a third client of the same core, not a separate product.

### Purpose

- Zero-install checking of a suspicious link or QR image.
- An acquisition channel for the native applications.
- A linkable destination for bank fraud pages, municipal advisories, news articles, and awareness campaigns.

It is **not** a replacement for the native applications. Its capability ceiling is materially lower.

### Technology

| Concern | Choice |
|---|---|
| Language | TypeScript, strict mode |
| Build | Vite |
| UI | React, or Svelte if bundle size is prioritized |
| PWA | `vite-plugin-pwa` with Workbox |
| Core | wasm-pack output of the same Rust crate, executed in a Web Worker |
| Camera | `getUserMedia` with `<video>` and `OffscreenCanvas` |
| QR decode | WebAssembly decoder, always — `rxing` in-core or `zxing-wasm` |
| Image input | File input, drag-and-drop, and clipboard paste |
| Share entry | Web Share Target on Android only, feature-detected |
| Localization | Same `nb`, `nn`, and `en` catalogs keyed by the same finding codes |
| Testing | Vitest, plus Playwright across Chromium, Firefox, and WebKit |
| Hosting | Azure Static Web Apps free tier |

WebKit coverage in Playwright is mandatory, because Safari is the browser where the most web platform assumptions break.

### Verified web platform constraints

1. `BarcodeDetector` is unsupported in Firefox, flagged off in Safari and Safari on iOS, and limited to ChromeOS and macOS on Chrome desktop. Only Chrome on Android supports it properly. The web application must therefore ship its own WebAssembly decoder and must not depend on the browser API.
2. `MediaDevices` is supported in Safari 11 and later, so live web scanning does work on iPhone over HTTPS with a user gesture.
3. Web Share Target is unsupported in Safari and Safari on iOS. Only an installed Android web application can receive shares.
4. Browser storage is evictable under storage pressure, quota overflow, and tracking-prevention inactivity rules. Persistence must be requested through `StorageManager.persist()` and is granted heuristically.
5. There is no equivalent of Locked Camera Capture, App Intents, Siri, widgets, Quick Settings, or background processing.

### Product consequences

- The offline promise differs by surface. Native: "works offline." Web: "works offline while your browser keeps the cached data." The wording must not be shared.
- The web application must detect eviction and re-fetch its assets rather than fail silently or, worse, analyse with stale rules while claiming freshness.
- Rule freshness reporting matters more on web than on native, because the asset lifetime is outside the application's control.
- The iOS web experience is weaker than the Android web experience. Route iOS web users toward the native application deliberately.

### Decoder divergence control

Three decoders will exist: VisionKit on iOS, ML Kit on Android, and the WebAssembly decoder on web. They can return different bytes for the same physical QR code, particularly with ECI designators, non-UTF-8 byte mode, Shift-JIS content, embedded control characters, and non-text binary payloads.

If decoders disagree, the shared core receives different input and correctly produces different verdicts. The unification then fails silently at the boundary.

Required controls:

1. Maintain `test-vectors/decoder-conformance/` with QR images and their exact expected bytes, including the awkward cases above.
2. Run every decoder against the corpus on real devices and real browsers.
3. Assert byte-level equality, not string equality.
4. Prefer obtaining raw bytes from platform decoders and let the core perform text interpretation, since text interpretation is itself security-relevant.
5. Record decoder identity and version in the evidence record.
6. Treat any decoder disagreement as a release-blocking defect.

## Online-mode architecture

Online mode is outside the first local MVP but its contract must be defined early.

### Shared backend

The backend links the same Rust crate directly, so redirect-evidence merging and verdict computation are the same code on the server as on the client. This removes the possibility of the server and the application disagreeing about what the same evidence means.

### Mobile API

The client sends the minimum required redacted request to a first-party API. Provider credentials never ship in the app.

Provider-neutral interface:

```text
RemoteEvidenceProvider.check(request) -> RemoteEvidenceBundle
```

The bundle includes:

- provider identity;
- checked time;
- result age;
- exact category of data disclosed;
- threat classifications;
- errors and limitations;
- redirect evidence when separately requested.

### Redirect worker

Required controls:

- manual redirect handling;
- HTTP/HTTPS only;
- ports 80/443 initially;
- A/AAAA validation before every connection;
- global-address requirement;
- IP pinning;
- DNS rebinding resistance;
- network-layer egress policy;
- no cookies or credentials;
- no POST;
- no JavaScript;
- strict redirect, time, header, and body limits;
- no internal, metadata, database, or control-plane access;
- short redacted operational retention.

Page rendering, if ever added, is a separate higher-risk isolation tier.

## Privacy architecture

Defaults:

- QR image: never retained.
- Raw payload: memory only.
- History: off.
- Account: not required.
- Analytics: off.
- Raw URL: excluded from ordinary logs.
- Online mode: off.
- Cloud LLM: absent.

Consent categories remain separate:

- live reputation;
- redirect expansion;
- page analysis;
- suspicious-URL reporting;
- remote explanation.

The user is told what leaves the device and why before each category is enabled.

## Performance budgets

Set measurable budgets before implementation:

- Scanner shell appears without loading rules, models, or network clients synchronously.
- Camera preview begins independently of online services.
- Local payload parsing is effectively immediate for normal payloads.
- Local verdict appears before online enrichment.
- Shared core has explicit maximum input sizes and bounded processing.
- Share extension launches well under one second under normal conditions.
- Share and locked-camera extensions do not load generative models.
- Core ML classifier has CPU fallback and benchmarked device behavior.

Record:

- cold launch;
- time to camera preview;
- time to first decode;
- local-analysis p50/p95;
- Core ML p50/p95;
- memory peak;
- extension memory peak;
- battery/thermal behavior during repeated scanning.

## Accessibility requirements

The first build includes:

- VoiceOver labels and ordered reading.
- Dynamic Type.
- High contrast.
- Reduced motion.
- Minimum touch target sizes.
- Haptic plus optional sound confirmation.
- Non-camera input route.
- Verdict communicated by icon and text, never color alone.
- Effective host pronounced separately from the full URL.
- Evidence expansion controls with descriptive labels.
- Safe handling of long and bidirectional text.

## Testing strategy

### Shared core

- Unit tests for every parser and rule.
- Property tests for canonicalization invariants.
- Fuzz tests for payload and URL entry points.
- Golden vectors shared with Swift and future Kotlin.
- Signature, rollback, expiry, and corruption tests.
- Determinism tests.
- Serialization compatibility tests.

### URL corpus

Include:

- user-info host confusion;
- backslashes;
- mixed and invalid encoding;
- Unicode controls;
- Punycode;
- mixed scripts;
- legitimate Norwegian IDNs;
- IPv4 variants;
- IPv6 literals;
- default and unusual ports;
- nested encoded URLs;
- shorteners;
- open redirect parameters;
- maximum-length values;
- invalid hosts;
- custom and dangerous schemes.

Use reserved domains where possible. Do not include live links likely to be opened accidentally.

### iOS unit tests

- Swift-to-Rust binding conversion.
- scanner candidate gate;
- result-state reducer;
- explanation validation;
- localization completeness;
- capability selection;
- consent policy;
- external-action policy.

### iOS integration tests

- VisionKit supported and unsupported paths.
- AVFoundation fallback.
- camera permission denied/restricted.
- camera interruption and app backgrounding.
- Photo picker.
- each Share extension input type;
- low-memory extension behavior;
- offline mode with networking blocked;
- stale rule package;
- corrupt model/rules fallback;
- iOS version capability gates.

### iOS UI tests

- no automatic navigation;
- scan-again flow;
- long URL rendering;
- malicious verdict action suppression;
- suspicious confirmation;
- VoiceOver result order;
- Dynamic Type;
- dark/high-contrast modes;
- Bokmål, Nynorsk, and English fallback;
- online consent and cancellation.

### Web tests

- Core WebAssembly module loads and returns the reference assessment for the golden corpus.
- WebAssembly QR decoder matches the decoder-conformance corpus byte for byte.
- Camera path works in Chromium, Firefox, and WebKit.
- Image file, drag-and-drop, and paste inputs.
- No automatic navigation to any scanned destination.
- Service worker offline behaviour with the network blocked.
- Storage eviction simulated: assets missing, rules stale, correct limitation reported.
- Web Share Target present on Chromium, absent and correctly hidden on WebKit.
- Bokmål, Nynorsk, and English rendering identical in meaning to the native surfaces.

### Cross-platform parity

For every golden input:

- Rust assessment is the reference.
- Swift receives identical finding codes and verdict.
- Kotlin receives identical finding codes and verdict.
- The WebAssembly build receives identical finding codes and verdict.
- The backend build receives identical finding codes and verdict.
- Classifier scores agree bit-for-bit across all four builds, because inference lives in the core.
- Template explanations use equivalent semantic content by locale.
- Decoder conformance is asserted separately, at byte level, because decoding is the one stage that is not shared.

## CI and quality gates

Initial CI:

- Rust format, lint, tests, and fuzz smoke corpus.
- **Core builds for `wasm32-unknown-unknown` and passes its tests there, enforced from the first commit.**
- UniFFI binding generation check.
- wasm-bindgen package build check.
- Swift build and unit tests.
- iOS simulator UI smoke tests.
- schema compatibility tests;
- localization completeness;
- secret scanning;
- dependency and license inventory generation.

Once the web application exists, add:

- Vitest unit tests.
- Playwright runs across Chromium, Firefox, and WebKit.
- WebAssembly bundle size budget.
- Decoder conformance corpus across every platform decoder.

Release gates:

- No unreviewed changes to verdict policy.
- No unreviewed changes to rule signing.
- No raw-payload logging.
- Offline network-denial test passes.
- Golden corpus passes.
- Accessibility smoke tests pass.
- model/rule manifest is reproducible and signed.
- privacy disclosures match compiled capabilities.

## Implementation todos

### Phase 0: Product and ownership decisions

1. Decide the legal publisher and repository owner.
2. Confirm the permanent bundle identifier namespace.
3. Confirm minimum iOS version after checking Norway device reach.
4. Decide whether Nynorsk is complete at first external beta or follows immediately after.
5. Approve Rust plus UniFFI as the shared-core implementation.
6. Approve wasm-bindgen as the web binding layer and confirm the web surface is in scope.
7. Choose the web UI framework: React or Svelte.

### Phase 1: Monorepo and contract skeleton

1. Create the private monorepo.
2. Create iOS application and test targets.
3. Create the Rust workspace and UniFFI binding target.
4. Create the wasm-bindgen binding target and add the `wasm32-unknown-unknown` build to CI.
5. Define v1 enums and records for payload, URL, findings, verdicts, limitations, and actions.
6. Add schema-versioning and compatibility policy.
7. Add an initial cross-platform golden-vector harness that runs against both the native and WebAssembly builds.

Exit criteria:

- Swift calls a Rust function through generated bindings.
- The same function is callable from TypeScript through the WebAssembly build.
- One synthetic payload produces a typed assessment on both.
- No UI text exists in the core response.
- CI fails if the core stops building for WebAssembly.

### Phase 2: Inert iOS scanner

1. Build SwiftUI scanner and result routes.
2. Integrate VisionKit.
3. Integrate AVFoundation fallback.
4. Add permission and interruption handling.
5. Add duplicate suppression and scan-again state.
6. Display raw payload as inert text.
7. Prove that scanning cannot dispatch an external action.

Exit criteria:

- A physical iPhone scans entirely offline.
- Result displays exact payload.
- No navigation, network, history, analytics, or model is involved.

### Phase 3: Shared payload and URL core

1. Implement payload classification.
2. Implement strict URL parsing and representations.
3. Add Public Suffix List processing.
4. Add IDNA, Punycode, confusable, mixed-script, and Norwegian character handling.
5. Implement dangerous scheme and URL-structure findings.
6. Add stable finding codes.
7. Add fuzzing and golden tests.

Exit criteria:

- Host-confusion, Unicode, encoding, IP, port, and nested-URL cases are correctly represented.
- iOS receives the same typed assessment as the Rust reference tests.

### Phase 4: Verdict, rules, and localization

1. Implement explicit verdict policy.
2. Define signed rule manifest.
3. Bundle initial shortener, scheme, Norwegian brand, and licensed indicator data.
4. Implement freshness and stale-data limitations.
5. Build deterministic Bokmål templates.
6. Build Nynorsk and English catalogs.
7. Implement safe interpolation of attacker-controlled values.

Exit criteria:

- Every finding and limitation has localized text.
- Rollback/corrupt rule packages are rejected.
- No rule-data failure breaks base scanning.

### Phase 4W: Web proof of concept

Runs in parallel with Phase 5. Does not delay the mobile track.

1. Create `apps/web` with Vite and TypeScript.
2. Consume the wasm-pack package built from the same core.
3. Execute the core inside a Web Worker.
4. Build a single flow: paste a URL, see the verdict, evidence, and limitations.
5. Reuse the same `nb`, `nn`, and `en` catalogs keyed by finding code.
6. Run the shared golden corpus in the browser under Playwright across Chromium, Firefox, and WebKit.
7. No camera, no service worker, no hosting yet.

Exit criteria:

- The browser produces byte-identical verdicts and finding codes to the Rust reference tests and to iOS.
- Any divergence is a defect in the binding layer, not in duplicated logic, and is proven so.
- The entire binding chain is validated while the codebase is still small enough to correct cheaply.

### Phase 5: Image import and Share extension

1. Add Photos picker and Vision barcode decoding.
2. Add size and memory limits.
3. Create the Share extension.
4. Accept image, file, URL, and text safely.
5. Add compact local result UI.
6. Add explicit full-app handoff.
7. Benchmark launch and memory.

Exit criteria:

- QR screenshots can be checked without broad photo access.
- Shared URLs and images never open automatically.
- Extension uses the same core assessment.

### Phase 6: Compact classifier

1. Freeze feature schema v1.
2. Build legally sourced training/evaluation datasets.
3. Train logistic regression baseline.
4. Evaluate time/domain/campaign-separated slices.
5. Calibrate and define threshold version.
6. Export signed coefficient and calibration assets, not a platform model binary.
7. Implement inference in the Rust `classifier` crate.
8. Verify the Rust implementation against the Python reference on golden vectors.
9. Add device and browser benchmarks.
10. Integrate classifier as supporting evidence.

Exit criteria:

- False-positive budget and detection targets are documented and met.
- Model is bundled and works offline.
- Scores are identical on iOS, Android, web, and server.
- Missing or corrupt coefficient assets degrade to deterministic analysis.

### Phase 7: Privacy and TestFlight foundation

1. Implement local-only settings with online mode off.
2. Ensure history and analytics remain absent or disabled.
3. Add privacy and support screens.
4. Complete privacy manifest review.
5. Create privacy policy and support site content.
6. Configure signing, App Store Connect, and TestFlight.
7. Prepare review-safe QR fixtures.

Exit criteria:

- First TestFlight build satisfies the offline product promise.
- Store disclosures match actual data flows.

### Phase 7W: Public web application

1. Add the WebAssembly QR decoder; evaluate `rxing` in-core against `zxing-wasm`.
2. Build the decoder-conformance corpus and run it against VisionKit, ML Kit, and the WebAssembly decoder.
3. Add camera scanning with `getUserMedia`, `<video>`, and `OffscreenCanvas`.
4. Add image file, drag-and-drop, and paste input.
5. Add the service worker and web app manifest.
6. Add Web Share Target, feature-detected, Android only.
7. Handle storage eviction: detect, re-fetch, and report freshness honestly.
8. Set and enforce a WebAssembly bundle size budget.
9. Deploy to Azure Static Web Apps free tier.
10. Add the privacy policy and the same disclosure content as the native applications.

Exit criteria:

- Verdicts are identical to iOS for the entire golden corpus.
- Decoders agree byte for byte across all three platforms.
- The application never navigates to a scanned destination.
- Offline behaviour is correct and the offline promise is worded accurately for the web.
- Playwright passes on Chromium, Firefox, and WebKit.

### Phase 8: Native iOS entry points

1. Add App Intents and Siri/Spotlight routes.
2. Add Control Center control and widget.
3. Add Locked Camera Capture with embedded offline assets.
4. Design unlock handoff.
5. Add Visual Intelligence only after core adoption and API eligibility are proven.

Exit criteria:

- Every entry point routes through the same Safety Engine.
- Locked flow remains fully local and does not depend on App Group access.

### Phase 9: Optional explanation agents

1. Keep deterministic templates as baseline.
2. Add `ExplanationAgent` protocol and validator.
3. Add Apple Foundation Models adapter behind iOS 26 availability.
4. Test Bokmål and Nynorsk runtime support.
5. Add timeout and template fallback.
6. Define Android Gemini Nano adapter tests against the same contract.

Exit criteria:

- Generated text cannot change security meaning.
- Unsupported devices and locales receive complete template explanations.

### Phase 10: Explicit online enrichment

1. Finalize consent and redaction contracts.
2. Implement first-party mobile API.
3. Add commercially permitted provider adapter.
4. Implement signed rule updates.
5. Build isolated redirect worker.
6. Add DNS/TLS/RDAP/CT evidence.
7. Merge remote evidence in the shared verdict engine, linked directly into the backend.
8. Add clear timestamps and unavailable states.
9. Extend the same online mode to the web application, with the same consent contract.

Exit criteria:

- Offline mode remains unchanged.
- No client device, mobile or browser, ever contacts the destination.
- SSRF test suite passes.
- Provider can be disabled without an app release.
- Server and client agree on the meaning of identical evidence, because they run the same code.

### Phase 11: Android implementation

1. Generate Kotlin bindings from the established core.
2. Build Compose shell, CameraX scanner, and bundled ML Kit decoder.
3. Map Android inputs into `ScanInput`.
4. Render identical verdict and finding semantics.
5. Confirm classifier scores match, using the in-core Rust inference — no LiteRT export required.
6. Add Photo Picker and Sharesheet receiver.
7. Add shortcuts and widgets.
8. Run full golden-vector parity and the decoder-conformance corpus.

Exit criteria:

- Android reuses the shared core without reimplementing security policy.
- Differences are limited to native acquisition, lifecycle, presentation, and optional platform AI.
- All four surfaces now share one core.

## Open decisions requiring confirmation before implementation

1. Product and repository name.
2. Personal or Norwegian company ownership.
3. Permanent bundle namespace.
4. Minimum iOS version: retain iOS 16 or choose a newer baseline.
5. Complete Nynorsk support in first external beta versus immediately after.
6. Rust/UniFFI approval versus Kotlin Multiplatform or duplicated native code.
7. Whether scan history remains entirely excluded from v1.
8. Whether any online feature is included in the first public release.
9. Commercial threat-intelligence provider.
10. Backend region and data-processing agreements.
11. Exact policy for one-time and authentication-bearing URLs.
12. Model false-positive budget and launch acceptance threshold.
13. Whether the web application ships before, alongside, or after the first native release.
14. Web UI framework: React for ecosystem breadth or Svelte for a smaller bundle.
15. Web QR decoder: `rxing` compiled into the core, or the separate `zxing-wasm` package.
16. Whether the web application is promoted publicly in Norway before the native applications exist.

## Implementation status

Implementation began on 26 July 2026 with the web surface and the shared core, ahead of the native applications. This section records what is verified rather than planned.

### Repository

| Item | Value |
|---|---|
| Repository | `webmaxru/qrrrgh`, private |
| Default branch | `main` |
| Layout | as specified in "Proposed repository layout" |

Every completed working session is committed and pushed. Pushing to `main` is the deployment trigger, so an unpushed change is an undeployed change.

### Frozen contract

The v1 seam lives in `contracts/v1/` and is now frozen:

- `assessment.d.ts` defines `Assessment`, `UrlBreakdown`, `Finding`, `Limitation`, `EngineConfig`, `AssessInput`, and the WebAssembly engine interface.
- `finding-codes.json` is the authoritative registry of 41 finding codes and 7 limitation codes, each carrying severity, category, and parameter names.

Wire format is camelCase JSON. The Rust core reaches it through `#[serde(rename_all = "camelCase")]`, so the TypeScript declarations and the Rust structures describe the same bytes.

Changing the contract requires a coordinated change to the core, the clients, all three localization catalogs, and the golden vectors. Adding a finding code requires a registry entry, text in `nb`, `nn`, and `en`, and at least one golden vector.

### Architecture validation

The four-target compile claim was tested empirically before product code was written, not assumed. A probe crate carrying the real dependency set — `url`, `idna`, `unicode-security`, `serde`, `serde_json`, and `wasm-bindgen` — was compiled to `wasm32-unknown-unknown` with `wasm-pack` and executed in Node.

| Input | Observed result |
|---|---|
| `https://trusted.no@evil.example/login` | authority host resolved to `evil.example` |
| `https://xn--pypal-4ve.com/` | Punycode host detected |
| `http://192.168.1.1:8080/x` | IP literal and explicit port detected |
| `notaurl` | typed parse error, no panic |

Resulting module size was 223 KB with that dependency set. The first case is the decisive one: userinfo-based host confusion is the single most common QR phishing construction, and the shared parser resolves it correctly in the browser.

### Build environment constraints on the development machine

These are properties of the current development machine, not of the project, but they block a clean checkout and must be documented.

1. Visual Studio 2022 Enterprise is present without the C++ workload. There is no `VC\Tools\MSVC` directory and no Windows SDK library path, so Rust's default `x86_64-pc-windows-msvc` toolchain cannot link. The account lacks administrator rights, so installing the workload is not available as a remedy.
2. The working toolchain is `stable-x86_64-pc-windows-gnu`, with `wasm32-unknown-unknown` added as a target.
3. Building `wasm-pack` from source additionally requires `dlltool.exe`, supplied by MinGW through scoop. Installing the prebuilt `wasm-pack` from npm avoids that compile entirely and is the recommended path.

CI runs on Linux and is unaffected, which is itself a reason to treat CI rather than any developer machine as the definition of a correct build.

### Hosting

| Item | Value |
|---|---|
| Service | Azure Static Web Apps, Free tier |
| Resource group | `rg-qrrrgh` |
| Region | West Europe |
| Default hostname | `brave-bay-0ecf82e03.7.azurestaticapps.net` |
| Deployment | GitHub Actions, using a deployment token stored as a repository secret |

The free tier provides 100 GB of bandwidth per month, managed TLS, custom domains, and staging environments for pull requests. It has no cost, which matters because the product promise is that the service is free and therefore must not develop an operating cost that pressures that promise.

### Verified in production

The deployed site was checked against the live URL in both Chromium and WebKit, not only in local tests:

| Check | Result |
|---|---|
| Real WebAssembly engine serving verdicts, no mock fallback | pass |
| `https://trusted.no@evil.example/login` yields the credential-in-authority finding | pass |
| `evil.example` surfaced as the true destination | pass |
| No unguarded open link offered for that payload | pass |
| **No request ever issued to the scanned destination** | pass |
| No console errors | pass |
| All five security headers applied, both WebAssembly modules served as `application/wasm` | pass |

The fifth row is the one that matters most. The product's central claim is that checking a hostile code contacts nothing, and it is enforced in three independent places: `connect-src 'self'` in the Content Security Policy, a Playwright test that fails on any request to a scanned host, and this production check. Re-run it after any deployment with `npm run test:prod` in `apps/web`.

## Notes

- This plan is based on the companion documents in `qrrrgh/planning/`:
  - `qr-safety-technical-research.md`
  - `qr-safety-unified-core-and-web-surface.md`
  - `qr-safety-ios-development-start-guide.md`
  - `qr-safety-android-development-start-guide.md`
  - `qr-safety-market-research-norway.md`
- Completed research remains the design rationale; this plan supersedes the earlier research-only milestone list as the implementation source of truth.
- The unified-core research of 26 July 2026 revised two earlier decisions: the core must be WebAssembly-clean from the first commit, and classifier inference moves into the Rust core instead of Core ML and LiteRT exports.
- Project root is `C:\Users\masalnik\Downloads\projects\qrrrgh`. All planning documents live in its `planning/` folder; `planning/README.md` is the index.
- Implementation started on 26 July 2026; see "Implementation status" above for what is verified.
