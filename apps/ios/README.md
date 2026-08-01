# QRavn for iOS

A native SwiftUI client for the offline QR safety scanner. It is the iOS twin of
[`apps/android`](../android): same engine, same contract, same wording, same
verdicts.

## What it does and does not do

- The app **never opens a scanned link by itself**. Opening is a separate,
  deliberate user gesture, and only when the core permits it.
- The device **never contacts a scanned destination**. Nothing in this app
  resolves, prefetches or previews an address.
- Every verdict, finding, limitation and recommended action comes from the Rust
  core in [`core/`](../../core). The client renders; it does not decide.
- There is no unqualified "Safe". The four verdicts are the only vocabulary.
- The only permission requested is the camera.

## Layout

| Path | Mirrors | Purpose |
| --- | --- | --- |
| `Sources/QravnSafetyCore/` | `safety-core/` (Kotlin `no.qravn.safety`) | The FFI boundary, the v1 contract projection, the shared catalogs. |
| `Sources/QravnApp/` | `app/` (Kotlin `no.qravn.android`) | SwiftUI surface. Renders assessments. |
| `Sources/QravnApp/Platform/` | `app/.../platform/` | Frame stabilisation, incoming text, the open policy. |
| `Tests/QravnSafetyCoreTests/` | `safety-core/src/test` + instrumented core tests | Contract decoding and the real core through the C ABI. |
| `Tests/QravnAppTests/` | `app/src/test` | Platform helpers, host-free. |
| `scripts/build-core.sh` | `safety-core/build.gradle.kts` native build | Builds the Rust core and packages it as an XCFramework. |
| `project.yml` | `settings.gradle.kts` + module `build.gradle.kts` | The single source of the Xcode project. |

Type names, enum wire values, catalog codes and version numbers are kept
identical to the Android client on purpose. A drift between the two is a bug.

### Generated, not committed

`QRavn.xcodeproj`, `Generated/` and `Frameworks/` are build output and are
git-ignored. The project is produced by [XcodeGen](https://github.com/yonaskolb/XcodeGen)
from `project.yml`, for the same reason the web app's wasm package is generated:
a `pbxproj` cannot be reviewed and cannot be merged.

## Building

Requires macOS with Xcode 16 or newer, Rust, and XcodeGen (`brew install xcodegen`).

```sh
# 1. Build the Rust core for device and both simulator architectures.
bash apps/ios/scripts/build-core.sh

# 2. Generate the Xcode project.
cd apps/ios && xcodegen generate

# 3. Build and test.
xcodebuild test -project QRavn.xcodeproj -scheme QravnApp \
  -destination 'platform=iOS Simulator,name=iPhone 16'
```

Steps 1 and 2 must run in that order and before any `xcodebuild`. There are no
Xcode run script phases, so script sandboxing stays on.

`QRAVN_CARGO_PROFILE=debug bash apps/ios/scripts/build-core.sh` builds the core
unoptimised, which is considerably faster while iterating on Swift.

## Localization

Catalog text for findings, limitations and verdicts is **not** stored here. The
three shared catalogs in [`localization/`](../../localization) are referenced
directly by `project.yml` and copied into the framework bundle, so a Norwegian
string cannot drift between the web, Android and iOS surfaces.

Chrome that has no catalog code — button labels, screen titles — lives in
`Sources/QravnApp/Resources/{nb,nn,en}.lproj/Localizable.strings`. Those files
are **generated** from the Android string resources:

```sh
node tools/gen-ios-strings.mjs
```

Run it after changing `apps/android/app/src/main/res/values*/strings.xml` so both
clients keep saying the same thing. A handful of strings have no Android
counterpart because the surface does not exist there; they are authored in the
generator itself.

## Continuous integration

Everything here is verified by the `iOS app` job in
[`.github/workflows/ci.yml`](../../.github/workflows/ci.yml) on a macOS runner:
Rust core → XCFramework → `xcodegen generate` → `xcodebuild build` →
`xcodebuild test`. Warnings are errors.
