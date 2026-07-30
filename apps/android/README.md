# qrrrgh for Android

Native Android surface. Scan a QR code, read the verdict, and decide for yourself
whether to open the destination.

The app never opens a scanned link on its own, and the device never contacts the
scanned destination. Those are product invariants, not defaults — see
[Offline by construction](#offline-by-construction).

---

## Modules

```text
apps/android/
  safety-core/   Kotlin wrapper around the shared Rust core, loaded over JNI
  app/           Compose UI, CameraX, ML Kit, platform integrations
core/bindings/android/   The Rust cdylib the safety-core module loads
```

`safety-core` is deliberately a separate module. It has no UI dependencies, so
the boundary between *deciding* and *rendering* stays visible in the build graph
rather than only in review comments.

### Where the verdict comes from

`contracts/v1/assessment.d.ts` says: *the core decides, clients render, clients
must never re-derive a verdict*. This app honours that literally. There is no
Kotlin re-implementation of the rules and no local heuristic fallback.

`app` → `SafetyEngine` (Kotlin) → JNI → `qrrrgh-safety-jni` (Rust) → `safety-core`
(Rust). The boundary is a JSON string matching the frozen v1 contract.

If the native library cannot load, the app says so and refuses to scan. A QR
safety app that silently degrades into a QR *reader* is worse than one that
admits it is broken, because the user keeps trusting it.

---

## Prerequisites

| Tool | Version used | Notes |
|---|---|---|
| Android Studio | Narwhal or newer | Provides the JBR used as `JAVA_HOME` |
| Android SDK Platform | 36 | `compileSdk` and `targetSdk` |
| Android NDK | 28.2.13676358 | Pinned in `safety-core/build.gradle.kts` |
| Rust | stable | Plus the four Android targets below |
| `cargo-ndk` | 4.1.2 | Cross-compiles the JNI crate |

```bash
rustup target add aarch64-linux-android armv7-linux-androideabi x86_64-linux-android
cargo install cargo-ndk
sdkmanager "platforms;android-36" "ndk;28.2.13676358"
```

`minSdk` is 26. Nothing in the app needs anything older, and API 26 is where
adaptive icons, the shortcut manager and the modern job scheduler all exist
unconditionally.

### Environment

Gradle needs both of these. Android Studio sets them for you; a terminal does not.

```powershell
$env:JAVA_HOME = "C:\Program Files\Android\Android Studio\jbr"
$env:ANDROID_HOME = "$env:LOCALAPPDATA\Android\Sdk"
```

`local.properties` is generated and git-ignored. On Windows the SDK path must be
escaped in the Java properties format or lint fails with `PropertyEscape`:

```properties
sdk.dir=C\:\\Users\\you\\AppData\\Local\\Android\\Sdk
```

---

## Building

```bash
cd apps/android
./gradlew assembleDebug
```

The first build cross-compiles the Rust JNI crate for three ABIs, so it is slow.
Later builds reuse the cargo cache.

If you are only touching Kotlin and already have the `.so` files, skip the native
step entirely:

```bash
./gradlew assembleDebug -Pqrrrgh.skipNativeBuild=true
```

---

## Verifying

Run all of this before pushing.

```bash
# Rust core and the JNI binding
cd core
cargo fmt --all --check
cargo clippy --all-targets -- -D warnings
cargo test --all
cargo build --target wasm32-unknown-unknown -p safety-core

# Android
cd apps/android
./gradlew :safety-core:testDebugUnitTest :app:testDebugUnitTest :app:lintDebug
./gradlew :app:assembleRelease

# Shared contract
node tools/check-contract-localization.js
```

Instrumented tests need a device or emulator:

```bash
./gradlew :safety-core:connectedDebugAndroidTest :app:connectedDebugAndroidTest
```

Both suites are there to protect invariants rather than appearance.

CI runs all of the above in the `Android app` job of `.github/workflows/ci.yml`,
including the instrumented suites on an API 36 emulator. It builds the real JNI
binding rather than passing `-Pqrrrgh.skipNativeBuild`, because a green build
against a stubbed core would prove nothing.

`NativeSafetyEngineInstrumentedTest` runs the real Rust core through JNI on the
device. The JVM tests would not notice a library that fails to load, a drifted
symbol name or catalogs missing from the packaged assets, and each of those
reaches a user as an app that cannot judge anything.

`ResultPanelSafetyTest` covers the things that would be embarrassing to get
wrong: that a blocked destination shows no open button, that opening always
needs a second confirmation, and that a verdict is never announced as an
unqualified "safe".

---

## Offline by construction

The merged manifest requests exactly one permission: `CAMERA`.

That is not automatic. ML Kit's bundled barcode model runs fully offline, but it
ships Google's `datatransport` telemetry uploader, which declares `INTERNET` and
`ACCESS_NETWORK_STATE`. Left alone, those permissions land in the merged
manifest and the offline promise quietly weakens from *the OS forbids it* to
*we believe none of our dependencies do it*.

So the manifest removes them, along with the scheduler components that would
otherwise wake the app to retry uploads it can never make:

```xml
<uses-permission android:name="android.permission.INTERNET" tools:node="remove" />
```

Removal directives are easy to lose in a merge, and nothing in a normal build
would complain. `verify{Variant}OfflineManifest` therefore parses the merged
manifest on every `assemble` and `bundle`, and fails the build on any permission
outside an allowlist. It is an allowlist rather than a list of banned
permissions, so a new dependency cannot slip through by asking for something
nobody anticipated.
To see it work, delete a `tools:node="remove"` line and run
`./gradlew :app:verifyReleaseOfflineManifest`.

Phase 6 adds opt-in redirect expansion. That request goes to the isolated
resolver service, never to the scanned destination, and it will need this
invariant revisited deliberately rather than by accident.

---

## Platform integration

| Feature | Where |
|---|---|
| Quick Settings tile | `platform/ScanTileService.kt` |
| Share target (text and images) | `AndroidManifest.xml` intent filters → `IncomingIntentParser` |
| App shortcut | `res/xml/shortcuts.xml` |
| Photo picker for existing images | `platform/ImageQrDecoder.kt` |
| Torch control | `ui/scan/CameraViewfinder.kt` |
| Dynamic colour (opt-in), edge-to-edge, predictive back | `ui/theme/Theme.kt`, `MainActivity.kt` |
| Per-app language | `res/xml/locales_config.xml` |
| Haptics on verdict | `MainActivity.kt` |

Text arriving from a share sheet is treated exactly like a camera scan. There is
no shortcut path that skips assessment.

### Theming

Two rules override the Material defaults, both in `ui/theme/Theme.kt`.

**Dynamic colour is off by default.** Material You would repaint the app in
whatever hue the wallpaper happens to be, and this product's entire visual
argument is that colour means something is wrong. A lavender button that means
nothing undermines the amber one that means something. It is still available as
"Use my wallpaper colours" in settings, because it is a real platform feature
some people want, and `VerdictColors` sits outside the Material scheme either
way — so no wallpaper can tint a verdict, whichever way the switch is set.

Both schemes fill in *every* colour role, including ones the app never names.
An unset role keeps its baseline Material value, which is a purple, and it
leaks out through components that pick their own container role: a bottom sheet
reaches for `surfaceContainerLow` without being asked.

**The viewfinder is always dark.** `QrSafetyViewfinderTheme` forces the dark
scheme on the scan screen regardless of the system setting or the wallpaper
switch, because that screen's background is the live camera image, or black
before the camera opens. Under the light scheme its controls would be ink on
black.

### Deliberate omissions

- **No scan history.** Storing scanned URLs creates a record of what a user was
  sent, which is precisely the data most worth not having if the phone is lost.
- **No analytics.** Also impossible, given the missing permission.
- **No `material-icons-extended`.** It added roughly 9 MB for nineteen icons,
  which now live as vector drawables in `res/drawable`.

---

## Localization

Strings live in `res/values`, `res/values-nb` and `res/values-nn`. Finding and
limitation text is *not* duplicated there — it is read at runtime from the shared
catalogs in `localization/`, which Gradle copies into the `safety-core` assets.

Adding a finding code means touching the registry, all three catalogs and a
golden vector. `node tools/check-contract-localization.js` enforces that.

---

## Release

`app/build.gradle.kts` reads signing configuration from a git-ignored
`apps/android/keystore.properties`:

```properties
storeFile=/absolute/path/to/upload-keystore.jks
storePassword=...
keyAlias=upload
keyPassword=...
```

Without that file the release build is unsigned, which is fine for local size
checks and CI.

Ship an App Bundle rather than the APK. The universal APK carries three ABIs and
the bundled ML Kit model; per-device delivery removes most of that.

```bash
./gradlew :app:bundleRelease
```

See `planning/qr-safety-android-development-start-guide.md` for the Play Console
path. The publisher is Play developer ID `6183318089496892599`, a personal
account. Because the account predates 13 November 2023, the closed-test
requirement for new personal accounts — 12 opted-in testers for 14 continuous
days before production access — does not apply.

### Listing details

| Field | Value |
|---|---|
| Package name | `no.qrrrgh.android` |
| Privacy policy | <https://qrrrgh.isainative.dev/privacy> |
| Support email | `salnikov@gmail.com` |
| Website | <https://qrrrgh.isainative.dev> |
| Data collected | None. Declare "No data collected" in Data safety. |

The privacy policy is a standalone document at `apps/web/public/privacy.html`,
served through the rewrite in `apps/web/public/staticwebapp.config.json`. It is
excluded from the service worker's navigation fallback, or the app shell would
answer `/privacy` for anyone who had already visited the site.

### Store assets

The listing icon and feature graphic are generated from the shared brand
sources, not drawn per-store:

| Play asset | File |
|---|---|
| App icon, 512×512 | `brand/play/icon-512.png` |
| Feature graphic, 1024×500 | `brand/play/feature-graphic.png` |

Regenerate with `cd tools/brand-render && npm install && node render.mjs` after
changing anything in `brand/`. The in-app launcher icon is separate — it lives
in `app/src/main/res/` as vector drawables, so it can react to dark mode and
supply a monochrome layer for themed icons.
