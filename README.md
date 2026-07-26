# qrrrgh

A free, privacy-first QR code safety application for Norway.

Scan a QR code, see exactly what is inside it, and get an evidence-based safety assessment **before** anything opens.

> **Status:** early implementation. The shared core and the web surface are live; the native applications have not started.
>
> **Web app:** <https://brave-bay-0ecf82e03.7.azurestaticapps.net>

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
        │ UniFFI       │ UniFFI              │ wasm-bindgen │ direct
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
apps/web/        Vite + TypeScript progressive web application
contracts/       Versioned schemas shared by every surface
localization/    nb, nn, en catalogs keyed by finding code
test-vectors/    Golden corpora, including decoder conformance
planning/        Market research, technical research, implementation plan
.github/         CI and deployment workflows
```

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
