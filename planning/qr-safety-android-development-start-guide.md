# QR Safety Application: Android Development Start Guide

**Prepared:** 24 July 2026  
**Purpose:** Practical foundation for starting the native Android application, choosing the correct Google Play account, implementing an offline-first QR scanner, using GitHub Copilot responsibly, and reaching the first Google Play test release.

---

## 1. Short answer

You can build, install, and test the Android application without paying Google:

- Android Studio and the Android SDK are available without a development fee.
- A Google Play Console account is not required for local development.
- Android Studio can install debug builds on an emulator or a physical Android device.
- An APK can also be distributed directly for private testing, subject to Android's installation safeguards and applicable law.

To publish through Google Play, create a Play Console developer account and pay the current **USD 25 one-time registration fee**.

Google Play offers:

- A **Personal** developer account for an individual.
- An **Organization** developer account for a registered business or organization.

For this product, an Organization account is preferable if a Norwegian legal entity will own the application. It keeps the store identity, signing administration, privacy responsibility, contracts, and future team access attached to the company rather than one person's account.

You may use GitHub Copilot to build a commercial Android application. Copilot does not remove your responsibility to:

- Review generated code.
- Test security-sensitive behavior.
- Check dependency and model licenses.
- Prevent accidental network transmission.
- Protect signing keys, credentials, QR payloads, private URLs, datasets, and user information.
- Comply with Google Play, GitHub, Norwegian, EEA, dependency, model, and dataset terms.

The first application invariant should be:

> Decoding a QR code displays and analyses its payload. It never opens a URL automatically.

---

## 2. Recommended Android product baseline

Use a fully native Android application:

- **Language:** Kotlin.
- **UI:** Jetpack Compose and Material 3.
- **Camera:** CameraX.
- **QR decoding:** bundled ML Kit Barcode Scanning.
- **Concurrency:** Kotlin coroutines and Flow.
- **State:** immutable UI state exposed by ViewModels.
- **Persistence:** DataStore for preferences and Room only when structured local history is actually required.
- **Offline classifier:** LiteRT or a small native Kotlin implementation for a simple linear model.
- **Shared security logic:** initially Kotlin, or the previously recommended narrow Rust core once both platforms need identical parsing and rules.
- **Build:** Gradle Kotlin DSL and a version catalog.
- **Testing:** JUnit, Android instrumented tests, Compose UI tests, and physical-device camera tests.

Do not start the Android product with:

- React Native, Flutter, or a WebView-first shell.
- A large bundled language model.
- A cloud dependency for basic QR decoding.
- Automatic link opening.
- an accessibility service;
- a VPN;
- a persistent background service;
- broad media or storage permissions;
- advertising SDKs;
- an account/login system;
- analytics that collect raw scans.

Those additions would increase security, policy, privacy, battery, and maintenance risk before they create core product value.

---

## 3. Required hardware and software

### 3.1 Development computer

Android development is supported on Windows, macOS, Linux, and ChromeOS systems that meet Android Studio's current requirements.

The current working environment is Windows, so the practical setup is:

- A 64-bit Windows computer.
- Enough memory for Android Studio, Gradle, and at least one emulator.
- Hardware virtualization enabled for acceptable emulator performance.
- Sufficient SSD space for Android SDK platforms, emulator images, Gradle caches, and test artifacts.

A Mac is not required for Android development. A Mac remains necessary for the separate native iOS application.

### 3.2 Android Studio

Install the current stable Android Studio release from:

- https://developer.android.com/studio

Android Studio includes or manages:

- Kotlin and Android project templates.
- Gradle integration.
- Android SDK Manager.
- Android Virtual Device Manager.
- Logcat.
- App inspection tools.
- Compose previews.
- Profilers.
- Test runners.
- App Bundle and signed-build generation.

Avoid building the initial project against preview-only Android Studio, Gradle, Kotlin, or Android SDK components unless a specific required capability exists only there.

### 3.3 Android SDK license

Android Studio asks the developer to accept the Android SDK License Agreement.

Google's SDK terms grant a limited, worldwide, royalty-free, non-exclusive license to use the SDK to develop applications for compatible Android implementations, subject to the agreement.

Important distinctions:

- The SDK license is not a fee for each application.
- Google does not obtain ownership of the application merely because the Android SDK was used.
- Individual SDK components may include separate open-source licenses.
- Google trademarks, logos, and brand assets are not automatically licensed for arbitrary use.
- Third-party libraries, models, datasets, fonts, icons, and threat feeds have their own terms.

Read the current agreement presented by Android Studio and keep a dependency and asset license inventory.

### 3.4 Physical Android devices

Use at least one real device from the first camera milestone.

An emulator is useful for:

- Compose layouts.
- Navigation.
- offline analysis logic;
- permission-state testing;
- process recreation;
- accessibility checks;
- multiple Android versions and screen sizes.

It is not a substitute for testing:

- camera focus;
- low light;
- glare;
- damaged QR codes;
- dense QR codes;
- manufacturer-specific camera behavior;
- thermal effects;
- battery use;
- actual share-sheet behavior.

Before the first public test, cover at least:

- A current Google Pixel or similarly clean Android implementation.
- A Samsung device, because Samsung has substantial market presence and platform customization.
- A lower- or mid-range device representative of price-sensitive users.
- The oldest supported Android version.
- The newest stable Android version.

### 3.5 Source control

Create a private GitHub repository before writing production code.

Never commit:

- upload keystores;
- signing passwords;
- service-account JSON files;
- API keys;
- production URLs containing credentials;
- private threat-intelligence datasets;
- raw user scan exports;
- Play Console reports containing personal data;
- model-training data without confirmed redistribution rights.

---

## 4. Google Play account and licensing decisions

### 4.1 No Play account is needed to begin

Local Android development can start immediately without Play Console.

You can:

- Create the project.
- Use emulators.
- Enable USB debugging on a test phone.
- Install debug builds from Android Studio.
- Run local and instrumented tests.
- Build unsigned or debug-signed APKs.

Do not postpone the account-ownership decision until release, however. The chosen owner affects verification, store identity, team access, contracts, and operational continuity.

### 4.2 Google Play Console registration

Google currently charges a **USD 25 one-time registration fee** for a Play Console developer account.

This is not an annual membership fee. Other costs can still arise from:

- company formation;
- domain registration;
- privacy and legal work;
- test devices;
- backend hosting;
- threat-intelligence providers;
- support systems;
- taxes;
- optional Copilot plans;
- contractors or employees.

Google may require:

- a valid government-issued ID;
- a payment card in the legal account holder's name;
- verified email and telephone details;
- address verification;
- organization documentation;
- device verification;
- additional checks based on account type and application category.

The registration fee may not be refunded if submitted verification information is invalid.

Official registration information:

- https://support.google.com/googleplay/android-developer/answer/6112435

### 4.3 Personal account

A Personal developer account is intended for an individual developer.

It can publish and monetize applications, but the individual remains the verified account owner.

Consider the consequences:

- Business continuity depends on the individual's account.
- Identity and contact details must satisfy Google's verification requirements.
- Moving operational ownership later can create administrative work.
- New Personal accounts are subject to specific testing requirements before production access.

For Personal accounts created after 13 November 2023, Google currently requires:

- A closed test.
- At least 12 testers opted in.
- Continuous opt-in for at least 14 days.
- A production-access application after meeting the test requirement.
- Answers about the application, testing process, feedback, and production readiness.

Google also requires certain new Personal account owners to verify access to an Android device using the Play Console mobile application.

Official testing requirement:

- https://support.google.com/googleplay/android-developer/answer/14151465

Do not use a Personal account as a shortcut if a company is the true publisher and data controller.

### 4.4 Organization account

Choose an Organization account when a registered business or organization owns and publishes the product.

Google commonly requires:

- Legal organization name.
- Registered address and telephone details.
- Organization website.
- Authorized representative and contact details.
- Organization documentation.
- A D-U-N-S Number for most organizations.

The information must match authoritative business records. Start D-U-N-S and organization verification early because corrections and record synchronization can take time.

An Organization account is recommended when:

- The application will use a company brand.
- Multiple people need Play Console access.
- The company will sign vendor or threat-intelligence agreements.
- The company will operate an online scanning service.
- The company will be the GDPR data controller.
- Ownership should survive personnel changes.

Google may require an Organization account for particular regulated or sensitive application categories. Recheck current account-type rules before registration.

Official account information:

- https://support.google.com/googleplay/android-developer/answer/13634885
- https://support.google.com/googleplay/android-developer/answer/13628312

### 4.5 Recommended decision for this product

Use:

- A Personal account only for an individual-owned prototype or genuinely individual business.
- An Organization account if a Norwegian company will own the application.

Before creating the account, decide:

- Legal owner.
- Public developer name.
- Support email.
- Public developer telephone number if required.
- Company website and privacy-policy domain.
- Who controls recovery email, multi-factor authentication, and payment profile.
- Which people receive least-privilege Play Console roles.

Use company-controlled accounts rather than an employee's personal mailbox wherever Google permits it.

### 4.6 Distribution outside Google Play

Android allows distribution outside Google Play, for example through a direct APK download or another application store.

That does not eliminate responsibility for:

- application signing;
- secure updates;
- user trust;
- malware warnings and installation friction;
- Norwegian and EEA consumer law;
- privacy law;
- sanctions and export rules;
- dependency licenses;
- vulnerability response;
- hosting and bandwidth.

For a Norway-first consumer security application, Google Play should be the primary Android distribution channel because users expect:

- familiar installation;
- automatic updates;
- Play Protect checks;
- visible developer identity;
- reviews;
- staged rollout;
- testing tracks;
- Android vitals.

Direct APK distribution may be useful for controlled enterprise pilots, but it should not be the default consumer launch path.

---

## 5. Google Play target API requirements

Android distinguishes:

- `minSdk`: the oldest Android API level on which the application can install.
- `targetSdk`: the API level against which the application declares and tests modern behavior.
- `compileSdk`: the Android API level used to compile the application.

As of 24 July 2026:

- New mobile applications and updates currently need to target Android 15, API level 35, for Play submission.
- Starting **31 August 2026**, new mobile applications and updates must target Android 16, API level 36, unless Google grants an applicable extension.

Because this project is beginning shortly before that deadline, create it against:

- `compileSdk = 36`
- `targetSdk = 36`

Use the current stable Android Gradle Plugin and SDK tools that support API 36.

Do not confuse a high `targetSdk` with a high `minSdk`. A modern target can still support older devices.

Recommended initial minimum:

- Consider `minSdk = 26` for Android 8.0 and later.

This is a product recommendation, not a platform requirement. Validate it against:

- Google Play device-reach data.
- Norway-specific target-user device data.
- CameraX and dependency requirements.
- security-update expectations;
- testing capacity;
- the cost of supporting older WebView, TLS, lifecycle, and storage behavior.

Avoid declaring `maxSdk`.

Official target API policy:

- https://support.google.com/googleplay/android-developer/answer/11926878

Official SDK-level explanation:

- https://developer.android.com/guide/topics/manifest/uses-sdk-element

---

## 6. Repository and project organization

### 6.1 Suggested repository

If iOS and Android are developed together, a monorepo can use:

```text
qr-safety/
  android/
  ios/
  core/
  models/
  rules/
  docs/
  test-vectors/
```

If the Android application starts independently:

```text
qr-safety-android/
  app/
  feature-scan/
  feature-result/
  feature-settings/
  safety-core/
  model-runtime/
  test-vectors/
```

Do not create many Gradle modules before module boundaries produce a real benefit. A practical v1 can begin with:

- `app`
- `safety-core`

Add feature modules when build time, ownership, reuse, or isolation justifies them.

### 6.2 Suggested package structure

```text
no.company.qrsafety
  app/
  camera/
  decoder/
  safety/
    model/
    parser/
    rules/
    classifier/
    verdict/
  result/
  sharing/
  settings/
  data/
  platform/
```

Keep Android framework types at the edge.

The core URL parser and verdict engine should not depend on:

- `Activity`;
- `Fragment`;
- `View`;
- Compose;
- CameraX;
- `Intent`;
- network clients.

This makes deterministic analysis fast to unit-test.

### 6.3 Branch protection

For a production repository:

- Protect the main branch.
- Require pull requests.
- Require tests.
- Require at least one human approval for security-sensitive changes.
- Enable secret scanning where available.
- Enable dependency update and vulnerability alerts.
- Restrict who can modify release workflows.
- Pin GitHub Actions to trusted revisions according to organizational policy.

---

## 7. Create the Android Studio project

### 7.1 New project

In Android Studio:

1. Select **New Project**.
2. Choose **Empty Activity**.
3. Use Kotlin.
4. Enable Jetpack Compose through the template.
5. Choose the product's final package namespace carefully.
6. Select the agreed minimum SDK.
7. Finish and allow Gradle sync to complete.

Suggested placeholders:

```text
Name: QR Safety
Package: no.example.qrsafety
Language: Kotlin
Minimum SDK: API 26
Build configuration: Kotlin DSL
```

Replace `no.example` before any public release. The application ID becomes a durable identity used by Google Play, Android updates, links, APIs, and signing.

### 7.2 Initial build settings

Use:

- Kotlin DSL.
- Gradle version catalog in `gradle/libs.versions.toml`.
- Java/Kotlin toolchain selected by the current stable Android template.
- `compileSdk` and `targetSdk` 36 for a release planned after the August 2026 target deadline.
- release minification only after rules are tested.

Pin dependency versions. Do not use dynamic versions such as `1.+`.

### 7.3 Initial dependencies

Add only what the first milestone needs:

- Compose BOM and Material 3.
- Lifecycle ViewModel Compose integration.
- Navigation Compose if more than one screen is required.
- CameraX camera2, lifecycle, view, and core components.
- Bundled ML Kit barcode scanning.
- Coroutines.
- Unit-test and Compose-test libraries.

Use the current stable versions shown by official documentation and Android Studio. Record them in the version catalog.

For the QR model, use the bundled ML Kit artifact rather than the Play Services downloaded artifact.

Google documents the tradeoff:

| Option | Application size | First-use availability |
|---|---:|---|
| Play Services model | Smaller application | May need a model download |
| Bundled model | Approximately a few MB larger | Immediately available |

The bundled model is the correct choice because the product promises offline scanning from first launch.

Official ML Kit documentation:

- https://developers.google.com/ml-kit/vision/barcode-scanning/android

### 7.4 Build immediately

Before adding scanner code:

- Run the generated application on an emulator.
- Run it on a physical device.
- Confirm both debug builds launch.
- Commit the clean generated baseline.

This separates project/toolchain failures from scanner implementation failures.

---

## 8. First runnable product milestone

The first useful milestone is deliberately narrow:

1. The application opens to a scan screen.
2. The user taps a scan control.
3. The app requests camera permission in context.
4. CameraX displays a preview.
5. ML Kit detects one QR code.
6. Analysis stops until the user chooses to scan again.
7. The complete decoded payload is displayed as inert text.
8. A local payload-type result is shown.
9. No URL is opened.
10. No network request is made.

The result screen should distinguish:

- URL.
- Plain text.
- Wi-Fi configuration.
- Telephone number.
- SMS.
- Email.
- Contact information.
- Geographic location.
- Calendar event.
- Unknown or unsupported payload.

For a URL, show:

- Full original text.
- Parsed scheme.
- Display host.
- ASCII/Punycode host where relevant.
- Port.
- Path.
- Query presence.
- Fragment presence.
- Local warning evidence.
- Verdict wording.

Use the approved verdict labels:

- **Known malicious**
- **Suspicious**
- **Insufficient evidence**
- **No known threat found**

Never display an unqualified **Safe** verdict.

---

## 9. Camera implementation with CameraX

### 9.1 Why CameraX

Google recommends CameraX for new camera applications.

CameraX provides:

- A consistent API across many manufacturers.
- Lifecycle-aware camera binding.
- Preview.
- Image analysis.
- Image capture if later required.
- Backward compatibility to API level 21.
- Device testing by the CameraX project.

Official overview:

- https://developer.android.com/media/camera/camerax

### 9.2 Required permission

Declare:

```xml
<uses-permission android:name="android.permission.CAMERA" />
```

Do not request it at application startup.

Recommended flow:

1. Show the scan screen and explain that images remain on-device in offline mode.
2. The user taps **Scan QR code**.
3. Check camera permission.
4. If needed, show a concise rationale.
5. Request permission.
6. Start the camera only after permission is granted.
7. If denied, offer **Scan from image** and manual paste.

Google's runtime-permission principles require:

- Ask in context.
- Allow cancellation.
- Handle denial gracefully.
- Check permission each time protected access is needed.
- Do not assume permission-group behavior.

Official permission guidance:

- https://developer.android.com/training/permissions/requesting

### 9.3 Camera use cases

Bind:

- `Preview`
- `ImageAnalysis`

The analyser should:

- Use `STRATEGY_KEEP_ONLY_LATEST`.
- Avoid queueing old frames.
- Process off the main thread.
- Always close the `ImageProxy`.
- Restrict ML Kit to `FORMAT_QR_CODE` unless another format is explicitly supported.
- Stop or pause after a successful stable decode.
- Debounce repeated detections of the same payload.

### 9.4 Decode stability

Do not accept every transient frame as a final scan.

Possible acceptance rule:

- One high-confidence decode with valid payload bytes; or
- The same payload observed in two nearby frames.

The decoder should preserve:

- raw bytes where available;
- raw string;
- barcode format;
- bounding box;
- source type;
- timestamp if history is enabled.

Do not silently trim, normalize, or rewrite the raw payload before presenting it. Analysis may use a normalized representation, but evidence must retain the original.

### 9.5 Safe lifecycle behavior

Unbind or pause analysis when:

- the screen is no longer visible;
- a result is being reviewed;
- the application loses camera permission;
- the application moves to the background;
- the user disables the camera.

Do not use a camera foreground service for ordinary scanning.

---

## 10. Scan QR codes from saved images

Use Android Photo Picker rather than requesting broad media-library access.

Photo Picker:

- lets the user choose specific media;
- avoids granting access to the entire library;
- has an AndroidX fallback to `ACTION_OPEN_DOCUMENT` on older supported devices;
- can access eligible cloud-media providers through the system interface.

For this application:

- Request a single image.
- Open only the returned URI.
- Enforce size and decode limits.
- Decode off the main thread.
- Do not persist URI access unless a user-visible feature requires it.
- Do not upload the image in offline mode.
- Discard decoded bitmap data promptly.

Compose integration uses `rememberLauncherForActivityResult` with `PickVisualMedia`.

Official Photo Picker documentation:

- https://developer.android.com/training/data-storage/shared/photo-picker

Do not request:

- `READ_MEDIA_IMAGES` for ordinary one-image selection.
- legacy broad external-storage permissions.
- all-files access.

---

## 11. Receive links and images from other applications

The Android Sharesheet is one of the best low-friction entry points.

The application can receive:

- `text/plain` for a URL or QR payload.
- `image/*` for an image or screenshot containing a QR code.

Use narrow manifest intent filters on an exported activity designed for untrusted input.

Treat every incoming Intent as attacker-controlled:

- Validate the action.
- Validate the MIME type.
- Enforce one-item and size limits.
- Do not trust file names.
- Do not trust the declared MIME type alone.
- Use content URIs safely.
- Do not resolve arbitrary file paths.
- Do not perform heavy work on the main thread.
- Do not automatically open shared URLs.
- Clear stale Intent-derived state when appropriate.

The Sharesheet activity should show the content for confirmation before analysis if ambiguity exists.

Official receiving-content guidance:

- https://developer.android.com/training/sharing/receive

Do not register the application as a general handler for all `http` and `https` links. That could create confusing default-browser behavior and expands the attack surface.

---

## 12. Build the offline Safety Core

### 12.1 Core contract

The Safety Core accepts immutable input:

```text
ScanInput
  rawBytes
  rawText
  source
  observedAt
```

It produces immutable evidence:

```text
ScanAssessment
  payloadType
  originalDisplay
  parsedFields
  evidence[]
  verdict
  confidenceBoundary
  modelVersion
  rulesVersion
```

The user interface renders this result. It does not invent or modify evidence.

### 12.2 Deterministic pipeline

For URL payloads:

1. Preserve the original payload.
2. Detect control characters and invalid encodings.
3. Parse strictly.
4. Classify the scheme.
5. Reject or flag user-info tricks.
6. Extract host and port.
7. Normalize host carefully.
8. Convert internationalized domain names for comparison.
9. Identify Unicode confusables.
10. Detect IP literals and unusual numeric forms.
11. Inspect subdomain depth.
12. Detect suspicious host/path token combinations.
13. Detect embedded URLs.
14. Detect known shortener domains from signed rules.
15. Evaluate local blocklists and allowlists.
16. Generate numeric features.
17. Run the compact classifier.
18. Combine evidence using explicit policy.
19. Emit one approved verdict.

### 12.3 Schemes

Classify at least:

- `https`
- `http`
- `mailto`
- `tel`
- `sms`
- `smsto`
- `geo`
- Wi-Fi QR payloads.
- contact-card payloads;
- calendar payloads;
- application-specific deep links;
- unknown schemes.

High-risk or unsupported schemes should never be launched directly.

Examples requiring explicit caution include:

- `intent`
- `market`
- custom application schemes;
- scripts or data-like schemes;
- file/content references;
- malformed URLs.

### 12.4 Output wording

Every finding should contain:

- Stable evidence ID.
- Severity.
- Short Norwegian explanation.
- Optional expanded technical explanation.
- Relevant observed value.
- Source: parser, rule, classifier, or online provider.

Example:

```text
Evidence ID: url.idn_mixed_script
Severity: warning
Observed value: xn--...
Explanation: The domain uses characters that can resemble another alphabet.
```

Generative AI may later rephrase structured evidence, but it must never create evidence or set the verdict.

---

## 13. Offline AI on Android

### 13.1 Recommended v1

Ship:

- Deterministic URL and payload rules.
- Signed local domain/rule data.
- A tiny discriminative URL classifier.
- Norwegian evidence templates.

Do not ship a large generative model in v1.

### 13.2 Classifier

A regularized logistic-regression model is a strong first choice because it is:

- Small.
- Fast.
- Explainable.
- Easy to run offline.
- Easy to reproduce across iOS and Android.
- Suitable for threshold calibration.

Features may include:

- URL length.
- Host length.
- subdomain count;
- entropy measures;
- digit and symbol ratios;
- IP-host indicator;
- Punycode indicator;
- mixed-script indicator;
- suspicious token indicators;
- shortener indicator;
- unusual port;
- path depth;
- query length;
- encoded-character ratios.

Do not feed raw user scans into model training without an explicit legal basis, consent design, retention policy, and security controls.

### 13.3 LiteRT

Use LiteRT if the model benefits from a standard mobile inference runtime.

Keep:

- input feature schema versioned;
- preprocessing identical to training;
- deterministic test vectors;
- model hash recorded;
- output calibration tested;
- CPU fallback available.

A simple linear model can also be implemented directly in shared core code, avoiding an inference runtime. Choose the smallest reliable solution.

### 13.4 Gemini Nano

Gemini Nano through Android AICore may be an optional enhancement on supported devices, but not a baseline requirement.

Constraints include:

- limited device support;
- runtime availability checks;
- possible model download;
- foreground-only restrictions for current ML Kit GenAI APIs;
- quotas;
- changing model and API capabilities;
- uncertain Norwegian quality across APIs and devices.

Use it only to explain already-generated evidence. If unavailable, the deterministic Norwegian templates must provide the complete result.

### 13.5 Application-managed local language models

Do not bundle an application-managed LLM until measurements prove it is necessary.

Potential costs:

- hundreds of MB or multiple GB of model data;
- memory pressure;
- battery and thermal load;
- slow first inference;
- device fragmentation;
- model-license review;
- safety evaluation;
- update complexity;
- expanded attack surface.

Google currently recommends LiteRT-LM rather than starting new work on maintenance-only MediaPipe LLM Inference.

The product does not need a local LLM to deliver its core security value.

---

## 14. Offline and online mode contract

### 14.1 Offline mode is the default

Offline mode must provide:

- Camera and image QR decoding.
- Payload classification.
- Strict URL parsing.
- Scheme checks.
- IDN and confusable checks.
- Signed local rules.
- Compact classifier.
- Evidence generation.
- Norwegian explanation templates.
- Local settings.

It must not:

- resolve DNS;
- connect to the scanned host;
- expand redirects;
- call reputation services;
- upload QR images;
- send raw payloads to analytics;
- call generative AI services.

### 14.2 Online mode is explicit

The user must deliberately enable online analysis.

Before enabling it, disclose:

- Which data leaves the device.
- Which service receives it.
- Why it is needed.
- How long it is retained.
- Whether it is shared with vendors.
- How to turn the mode off.

Online mode may add:

- live threat reputation;
- DNS evidence;
- certificate-transparency evidence;
- RDAP/domain-age evidence;
- controlled redirect expansion;
- isolated page metadata;
- updated threat rules;
- server-side explanation enhancement.

### 14.3 Network architecture

The mobile application must never follow an untrusted redirect chain itself for analysis.

Redirect expansion belongs in a hardened server-side worker with:

- manual redirects;
- destination validation before every connection;
- DNS rebinding defenses;
- private, loopback, link-local, multicast, reserved, and metadata-range blocking;
- no cookies;
- no credentials;
- no JavaScript;
- strict time, byte, and redirect limits;
- isolated egress;
- audit logs without unnecessary raw personal data.

The Android client sends only the minimum required request after user consent.

### 14.4 Enforcing the boundary

Use separate interfaces:

```text
OfflineAnalyzer
OnlineEvidenceProvider
```

The offline analyser must have no dependency on an HTTP client.

Add automated tests that fail if offline analysis attempts a network call.

Android's `INTERNET` permission is a normal install-time permission and does not show a runtime prompt. Therefore, user consent must be enforced by application architecture and UI, not assumed from Android's permission system.

---

## 15. Opening a result safely

The default result action is **Copy**, not **Open**.

If a URL can be opened:

1. Show the exact destination.
2. Show the verdict and evidence.
3. Require an explicit tap.
4. Show an additional warning for suspicious or insufficient-evidence results.
5. Open in the user's browser rather than rendering untrusted content in an in-app WebView.

Do not:

- open automatically after scanning;
- preload the URL;
- fetch favicons directly from the host;
- load link previews from the host;
- execute JavaScript;
- retain browser cookies;
- inject authentication headers;
- silently resolve redirects on-device.

A browser Intent transfers the choice to a browser with its own protections. It does not make the destination safe.

For a **Known malicious** result, the recommended default is to disable direct opening and require a deliberately designed expert override, if any.

---

## 16. Android application architecture

Follow Android's current architecture guidance:

- Separation of concerns.
- A UI layer and a data layer.
- An optional domain layer where it improves reuse.
- A single source of truth.
- Unidirectional data flow.
- Immutable state.
- Coroutines and Flow.
- Lifecycle-aware state collection.

Suggested flow:

```text
CameraX / Photo Picker / Sharesheet
              |
              v
        Input Adapter
              |
              v
          Decoder
              |
              v
        Safety Core
              |
              v
     ScanResult ViewModel
              |
              v
       Compose Result UI
```

The `Activity` should host UI and system integration. It should not contain parsing, verdict, or model logic.

Official architecture guidance:

- https://developer.android.com/topic/architecture

### 16.1 State

Use a sealed or otherwise exhaustive UI state:

```text
Idle
PermissionRequired
Scanning
Analysing
Result
Error
```

Errors must be explicit:

- Camera unavailable.
- Permission denied.
- No QR code found.
- Image too large.
- Unsupported payload.
- Local model unavailable or invalid.
- Online mode disabled.
- Network analysis failed.

Do not turn operational failures into a reassuring verdict.

### 16.2 Persistence

Default to no scan history.

If local history is added:

- Make it opt-in.
- Store locally.
- Encrypt only where the threat model and key management justify it.
- Provide clear deletion.
- Avoid raw images.
- Avoid indefinite retention.
- Exclude sensitive content from backups if appropriate.

DataStore is suitable for:

- online-mode preference;
- first-run education state;
- optional history preference;
- explanation detail level;
- language preference.

Room is justified only for structured local records that must be queried.

---

## 17. Privacy, security, and Google Play policy

### 17.1 Privacy policy

Publish a privacy policy:

- On a stable HTTPS website.
- In the Play store listing.
- From within the application.
- In Norwegian and English for the initial market.

It should accurately describe:

- offline processing;
- optional online processing;
- QR image handling;
- URL/payload handling;
- telemetry;
- crash reports;
- retention;
- subprocessors;
- user rights;
- contact details;
- data deletion;
- model and rule updates.

### 17.2 Google Play Data safety

Google requires an accurate Data safety declaration.

The form must represent the combined data practices of versions distributed under the package name. It is not enough for one region or one mode to be private if another version collects data.

Audit:

- application code;
- every SDK;
- crash reporting;
- analytics;
- support systems;
- online scanning;
- model APIs;
- advertising;
- authentication;
- cloud storage.

Keep the declaration updated when behavior changes.

Official Data safety information:

- https://support.google.com/googleplay/android-developer/answer/10787469

### 17.3 User Data policy

Google requires transparency, minimization, secure handling, and appropriate consent for personal and sensitive data.

The application should:

- Collect only data necessary for a user-requested feature.
- Use modern encryption in transit.
- Request camera access in context.
- Avoid persistent device identifiers.
- Avoid advertising identifiers.
- Review third-party SDK behavior.
- Avoid selling personal or sensitive data.
- Provide deletion mechanisms if accounts or server-side personal data are introduced.

Official policy:

- https://support.google.com/googleplay/android-developer/answer/10144311

### 17.4 Norwegian and EEA responsibilities

The product must also account for:

- GDPR.
- Norwegian Personal Data Act implementation.
- ePrivacy rules where applicable.
- consumer-protection and marketing rules;
- security obligations;
- processor agreements;
- international data transfers;
- data-subject rights.

Do not claim that a URL is safe. Use calibrated language that accurately communicates evidence limits.

### 17.5 Security application positioning

The store listing must not promise perfect detection.

Prefer:

- "Inspect a QR code before opening it."
- "See the complete destination and warning signals."
- "Offline checks by default."
- "Optional deeper online analysis."

Avoid:

- "100% safe."
- "Detects every scam."
- "Guaranteed protection."
- "Virus-proof QR scanner."

---

## 18. Application signing and secret management

### 18.1 Debug signing

Android Studio automatically creates and uses a debug keystore for debug builds.

The debug key:

- is for development;
- is insecure by design;
- must not be used as the production signing identity.

### 18.2 Release signing

Android requires installed APKs to be digitally signed.

For Google Play, use:

- Android App Bundle (`.aab`).
- Play App Signing.
- A separate upload key controlled by the publisher.

With Play App Signing:

- Google protects the application signing key.
- The developer signs uploaded bundles with the upload key.
- Google verifies the upload and signs generated APKs for distribution.
- A lost or compromised upload key can be reset through the documented process.

Official signing guidance:

- https://developer.android.com/studio/publish/app-signing

### 18.3 Protect the upload key

Never:

- Commit the keystore.
- Commit passwords.
- Send the key to Copilot.
- Put passwords directly in Gradle files.
- Share the key through ordinary email or chat.
- Use the same key for debug and release.

Store:

- the encrypted keystore in a company-approved secret system or secure offline backup;
- credentials in CI secret storage;
- recovery documentation in an access-controlled company system;
- the public certificate fingerprint in release records.

Use at least two authorized administrators for business continuity, with least-privilege access and strong multi-factor authentication.

### 18.4 Play Integrity

Play Integrity API can help a backend evaluate whether requests come from:

- the recognized application;
- a Google Play installation;
- a genuine certified device;
- an untampered binary.

It is not required for the offline v1.

If online analysis later faces abuse:

- Treat Play Integrity as one signal, not the sole security decision.
- Measure verdict distributions before enforcement.
- Perform enforcement on the server.
- Avoid blocking legitimate users solely because a device lacks a strong verdict without considering product policy.

Official overview:

- https://developer.android.com/google/play/integrity/overview

---

## 19. Testing from the beginning

### 19.1 Local unit tests

Put the Safety Core under extensive ordinary JVM unit tests.

Test:

- valid and invalid URLs;
- mixed-case schemes;
- user-info confusion;
- percent encoding;
- Unicode hostnames;
- Punycode;
- mixed scripts;
- IPv4 and IPv6 literals;
- unusual numeric IP representations;
- ports;
- nested URLs;
- shorteners;
- very long payloads;
- null bytes and control characters;
- Wi-Fi payload escaping;
- malformed vCards;
- deterministic model features;
- threshold boundaries;
- every verdict;
- every Norwegian evidence template.

Use fixed regression vectors. A previously detected bypass becomes a permanent test.

### 19.2 Instrumented tests

Use device/emulator tests for:

- camera permission flows;
- Photo Picker;
- Sharesheet inputs;
- activity recreation;
- process restoration;
- system dark mode;
- font scaling;
- screen readers;
- supported Android versions;
- locale changes;
- no-network behavior.

### 19.3 Compose UI tests

Compose provides APIs to:

- find semantic nodes;
- assert properties;
- perform actions;
- control test time;
- synchronize with UI state.

Test that:

- a decoded URL is displayed before any open action;
- the full host is available to accessibility services;
- warning evidence is not communicated by color alone;
- **Known malicious** cannot be opened accidentally;
- online mode requires explicit consent;
- errors are not rendered as successful assessments.

Official Compose testing guidance:

- https://developer.android.com/develop/ui/compose/testing

### 19.4 Camera test corpus

Create non-sensitive test QR images covering:

- Small and large codes.
- High and low contrast.
- Rotation.
- Perspective distortion.
- Blur.
- Glare.
- partial occlusion;
- damaged modules;
- light-on-dark codes;
- long URL payloads;
- Unicode payloads;
- screenshots;
- printed paper;
- another phone's display.

Include only test data that the project has the right to store.

### 19.5 Security tests

Add tests for:

- parser differentials;
- decompression and image bombs;
- oversized images;
- malicious content providers;
- malformed Intents;
- URI permission lifetime;
- WebView absence;
- no automatic network access;
- signed rule update rejection;
- model hash mismatch;
- replayed or downgraded rule packages;
- log redaction.

### 19.6 Android vitals

After Play testing begins, monitor:

- user-perceived crash rate;
- user-perceived ANR rate;
- excessive partial wake locks;
- startup;
- slow rendering;
- permission denials;
- device-specific failures.

Core vitals can affect Play visibility.

Official Android vitals documentation:

- https://developer.android.com/topic/performance/vitals

---

## 20. Native Android integrations after the scanner works

Add integrations incrementally.

Recommended order:

1. Photo Picker.
2. Android Sharesheet receiver.
3. Pinned app shortcut for **Scan QR**.
4. App widget with an explicit scan action.
5. Quick Settings tile only if it provides real repeated utility.
6. App Actions or voice entry where current platform support and policy justify it.

### 20.1 Shortcuts

Provide a dynamic or static shortcut that opens directly to scanning.

The shortcut must still:

- respect camera permission;
- show the app identity;
- avoid opening decoded links;
- route through the same Safety Core.

### 20.2 Widget

A widget can offer:

- **Scan QR**
- **Check image**
- **Paste link**

It cannot perform camera scanning inside the widget. It launches the appropriate application activity.

### 20.3 Quick Settings

A Quick Settings tile may open the scan screen, but Android guidance discourages tiles that add little beyond being generic launchers.

Use one only after user testing shows it materially reduces friction for frequent users.

### 20.4 Boundaries

The application cannot safely:

- replace every manufacturer's Camera or Lens scanner;
- intercept another camera application's QR result;
- monitor the clipboard continuously;
- use accessibility privileges merely to observe links;
- perform hidden background camera scanning;
- present itself as Android system protection.

Use supported entry points rather than privileged or deceptive workarounds.

---

## 21. Google Play testing and release path

### 21.1 Internal testing

Use Internal testing first.

It is suitable for:

- developers;
- trusted internal testers;
- quick build distribution;
- signing and installation checks;
- early device coverage.

Builds are often available quickly, but policy and processing times can vary.

### 21.2 Closed testing

Use a Norway-focused closed test with representative users.

For new Personal accounts, remember the current production-access requirement:

- At least 12 opted-in testers.
- At least 14 continuous days.
- Production-access application after completing the test.

Recruit more than 12 testers because people may leave or fail to remain opted in.

Collect structured feedback about:

- clarity of verdict wording;
- whether users understand "No known threat found";
- scan speed;
- permission trust;
- Norwegian terminology;
- false positives;
- accessibility;
- Samsung and Pixel differences;
- offline/online understanding.

### 21.3 Open testing

Open testing can broaden feedback after production access is available. The store listing becomes more visible, so branding, support, privacy, and application quality must already be credible.

### 21.4 Production rollout

Use staged rollout rather than immediately releasing to every eligible Norwegian user.

Monitor:

- crashes and ANRs;
- reviews;
- support contacts;
- classifier errors;
- rule-update failures;
- online service latency;
- unexpected data collection;
- device-specific camera failures.

Pause rollout when the security or privacy contract is not being met.

### 21.5 Store listing

Prepare:

- Norwegian application name and descriptions.
- English fallback.
- application icon;
- phone screenshots;
- privacy-policy URL;
- support email and website;
- Data safety declaration;
- content rating;
- application access instructions if any;
- ads declaration;
- target audience;
- security and testing statements that can be substantiated.

Do not use screenshots containing real private QR payloads.

---

## 22. Can GitHub Copilot be used?

Yes. GitHub Copilot can assist with a commercial native Android application.

Useful tasks include:

- Kotlin data models.
- Compose screens.
- CameraX integration scaffolding.
- Gradle configuration explanations.
- Unit-test generation.
- parser test vectors;
- accessibility review prompts;
- documentation;
- refactoring;
- threat-model checklists.

Do not treat Copilot as:

- a legal adviser;
- a security authority;
- a license scanner;
- a source of current Google Play policy without verification;
- a substitute for tests;
- a place to paste sensitive data.

The developer and publisher remain responsible for the final application.

---

## 23. GitHub Copilot in Android Studio

Android Studio is a supported JetBrains IDE for the GitHub Copilot plugin.

Current installation flow:

1. Confirm the GitHub account has Copilot Free access or an applicable paid/assigned plan.
2. Open Android Studio settings.
3. Open **Plugins**.
4. Search the Marketplace for **GitHub Copilot**.
5. Install the plugin.
6. Restart Android Studio.
7. Open **Tools > GitHub Copilot > Login to GitHub**.
8. Complete device authorization in the browser.
9. Confirm suggestions and chat are available.

Check plugin compatibility against the installed Android Studio version.

Official installation documentation:

- https://docs.github.com/en/copilot/how-tos/set-up/install-copilot-extension?tool=jetbrains

The plugin is licensed by GitHub and subject to GitHub's applicable terms, not transferred into ownership by JetBrains.

Copilot CLI can also be used from the terminal for repository tasks, but security-sensitive changes still require human review.

---

## 24. Copilot licensing, data, and safe workflow

### 24.1 Commercial use

Copilot may be used while creating commercial software, subject to the applicable GitHub plan and terms.

Generated output is not a guarantee that:

- the code is correct;
- the code is secure;
- a third-party license is compatible;
- an API still exists;
- Google Play accepts the behavior;
- the code is original;
- the implementation satisfies Norwegian or EEA law.

Review current terms before relying on any material output:

- https://docs.github.com/en/site-policy/github-terms/github-terms-for-additional-products-and-features
- https://docs.github.com/en/site-policy/github-terms/github-terms-for-additional-products-and-features#github-copilot

### 24.2 Data handling

Copilot data handling depends on:

- account type;
- plan;
- organizational policy;
- user settings;
- product surface;
- current GitHub terms.

Business and Enterprise arrangements provide organizational controls and different training commitments from individual usage. For individual plans, review and configure the current data-use settings.

Enable **Block suggestions matching public code** unless the organization deliberately chooses another reviewed policy.

### 24.3 Never send these to Copilot

- Signing keystores or passwords.
- API keys and service-account credentials.
- Private repository deploy tokens.
- Raw user QR scans.
- private or authentication-bearing URLs;
- phishing reports containing personal data;
- paid threat-intelligence feeds;
- proprietary model-training records;
- Play Console identity documents;
- production logs containing payloads;
- security incident details beyond approved handling.

Use synthetic examples.

### 24.4 Recommended prompt boundaries

Good:

```text
Implement a pure Kotlin function that classifies a parsed URL using these
explicit evidence rules. It must not perform networking or open the URL.
Add unit tests for the listed synthetic vectors.
```

Unsafe:

```text
Here are 5,000 real URLs scanned by our users, including private reset links.
Train a phishing detector from them.
```

### 24.5 Review checklist for generated code

For every Copilot-assisted change:

- Read every line.
- Confirm APIs against official documentation.
- Check permissions and manifest changes.
- Check exported components.
- Check network behavior.
- Check logging.
- Check lifecycle cleanup.
- Check exception handling.
- Check input limits.
- Check dependency licenses.
- Run targeted tests.
- Require human review for verdict and parser changes.

Pay special attention when generated code handles:

- URLs;
- Intents;
- content URIs;
- WebViews;
- cryptography;
- model updates;
- serialization;
- signing;
- permissions;
- file storage;
- network clients.

---

## 25. Initial development roadmap

### Phase 0: Ownership and setup

- Decide Personal versus Organization Play account.
- Reserve the application and company names.
- Confirm package namespace.
- Create the private repository.
- Install stable Android Studio.
- Configure protected branches and secret scanning.
- Select `minSdk`.
- Target API 36 for the planned release timeline.

### Phase 1: Inert decoding

- Build Compose scan and result screens.
- Add CameraX preview and analysis.
- Add bundled ML Kit QR decoding.
- Preserve raw payload.
- Display payload without opening it.
- Add camera-permission denial fallback.

Exit criterion:

> A physical Android phone scans a QR code entirely offline and presents the exact payload without any navigation or network request.

### Phase 2: Deterministic Safety Core

- Add strict payload classification.
- Add URL parsing.
- Add scheme and user-info checks.
- Add IDN/Punycode and confusable checks.
- Add signed local rules.
- Implement approved verdict labels.
- Build comprehensive JVM tests.

Exit criterion:

> All verdicts derive from structured, testable evidence and malformed inputs cannot crash or trigger external activity.

### Phase 3: Offline classifier

- Freeze feature schema.
- Train a compact baseline.
- Validate leakage-resistant splits.
- Calibrate thresholds.
- Convert to LiteRT or shared coefficients.
- Add model-integrity checks.
- Add Norwegian evidence templates.

Exit criterion:

> The classifier improves measured detection without exceeding the agreed false-positive budget, latency, size, or battery budget.

### Phase 4: Native entry points

- Add Photo Picker.
- Add Sharesheet support.
- Add pinned scan shortcut.
- Evaluate widget value.
- Test malicious Intents and oversized images.

### Phase 5: Play internal and closed tests

- Create the Play application record.
- Configure Play App Signing.
- Generate and protect the upload key.
- Complete privacy and Data safety work.
- Upload the Android App Bundle.
- Run internal testing.
- Run Norway-focused closed testing.
- Satisfy Personal-account production requirements if applicable.

### Phase 6: Optional online mode

- Implement explicit consent.
- Deploy SSRF-resistant redirect worker.
- Add minimum-data reputation requests.
- Add retention and deletion controls.
- Test offline guarantees.
- Update privacy policy and Data safety declarations.

### Phase 7: Production

- Complete store listing.
- Use staged rollout.
- Monitor Android vitals and support.
- Measure false positives and unclear explanations.
- Maintain signed rule/model update procedures.

---

## 26. Definition of the first Google Play test build

The first internal or closed-test build is ready only when:

- It installs through Google Play testing.
- It is signed through the intended Play App Signing arrangement.
- It scans QR codes from the camera offline.
- It scans a user-selected image.
- It accepts shared text or an image safely.
- It never opens a payload automatically.
- It uses the four approved verdicts.
- It displays evidence in Norwegian.
- English fallback is available.
- Camera denial leaves useful functionality.
- Raw payloads are absent from production logs.
- Offline analysis makes no network requests.
- No account is required.
- No ads are included.
- No analytics SDK collects scans.
- Privacy policy and Data safety declarations match actual behavior.
- Unit, instrumented, and Compose tests cover the main safety contract.
- The build works on representative Pixel, Samsung, and lower-tier hardware.

Optional online analysis is not required for the first test build.

---

## 27. Immediate checklist

- [ ] Decide whether an individual or Norwegian organization owns the application.
- [ ] Start D-U-N-S preparation if an Organization Play account will be used.
- [ ] Create a private GitHub repository.
- [ ] Install stable Android Studio and API 36 tools.
- [ ] Create a Kotlin/Compose project.
- [ ] Choose the permanent application ID.
- [ ] Add CameraX and bundled ML Kit barcode scanning.
- [ ] Implement camera permission in context.
- [ ] Scan one QR code without opening it.
- [ ] Display the exact raw payload.
- [ ] Add the pure Kotlin Safety Core.
- [ ] Add parser and verdict regression tests.
- [ ] Add Photo Picker without broad storage permission.
- [ ] Add safe Sharesheet handling.
- [ ] Draft Norwegian and English privacy text.
- [ ] Create the Play Console account before release work becomes critical.
- [ ] Plan enough closed-test participants if using a new Personal account.
- [ ] Protect the upload key.
- [ ] Install Copilot only under the chosen GitHub account and policy.
- [ ] Keep real user scans and secrets out of Copilot prompts.

---

## 28. Official sources

### Android development

- Android Studio and SDK license: https://developer.android.com/studio
- Jetpack Compose setup: https://developer.android.com/develop/ui/compose/setup
- Android architecture: https://developer.android.com/topic/architecture
- CameraX: https://developer.android.com/media/camera/camerax
- ML Kit Barcode Scanning: https://developers.google.com/ml-kit/vision/barcode-scanning/android
- Runtime permissions: https://developer.android.com/training/permissions/requesting
- Photo Picker: https://developer.android.com/training/data-storage/shared/photo-picker
- Receiving shared content: https://developer.android.com/training/sharing/receive
- SDK levels: https://developer.android.com/guide/topics/manifest/uses-sdk-element
- Android privacy and security: https://developer.android.com/privacy-and-security/about
- Android testing: https://developer.android.com/studio/test
- Compose testing: https://developer.android.com/develop/ui/compose/testing
- Android vitals: https://developer.android.com/topic/performance/vitals

### Google Play

- Create a Play Console developer account: https://support.google.com/googleplay/android-developer/answer/6112435
- Choose developer account type: https://support.google.com/googleplay/android-developer/answer/13634885
- Required account information: https://support.google.com/googleplay/android-developer/answer/13628312
- Personal-account testing requirements: https://support.google.com/googleplay/android-developer/answer/14151465
- Target API requirements: https://support.google.com/googleplay/android-developer/answer/11926878
- Application signing: https://developer.android.com/studio/publish/app-signing
- Data safety: https://support.google.com/googleplay/android-developer/answer/10787469
- User Data policy: https://support.google.com/googleplay/android-developer/answer/10144311
- Play Integrity: https://developer.android.com/google/play/integrity/overview

### GitHub Copilot

- Install Copilot in JetBrains IDEs and Android Studio: https://docs.github.com/en/copilot/how-tos/set-up/install-copilot-extension?tool=jetbrains
- Copilot overview and access: https://docs.github.com/en/copilot/get-started/what-is-github-copilot
- GitHub Copilot terms: https://docs.github.com/en/site-policy/github-terms/github-terms-for-additional-products-and-features#github-copilot
- Configuring suggestions matching public code: https://docs.github.com/en/copilot/configuring-github-copilot/configuring-github-copilot-settings-on-githubcom

---

## 29. Final recommendation

Begin Android development now without paying a platform development fee. Use stable Android Studio, Kotlin, Compose, CameraX, and the bundled ML Kit barcode model.

Before Google Play distribution:

- Pay the one-time USD 25 Play Console registration fee.
- Prefer an Organization account if a Norwegian company owns the product.
- Target API 36 for a release after 31 August 2026.
- Configure Play App Signing and protect the separate upload key.
- Complete the relevant test track, identity verification, privacy, Data safety, and store-listing requirements.

Build the offline deterministic Safety Core before online services or generative AI. The first release should prove one clear promise:

> A user can inspect what a QR code contains and receive an evidence-based warning before deciding whether to open anything.
