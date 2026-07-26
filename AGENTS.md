# Agent Guide

## Product invariants

- Never open a scanned link automatically.
- The user's device must not contact the scanned destination.
- The Rust core has no I/O, networking, system time, or threads. Hosts pass data in.
- The core must build for `wasm32-unknown-unknown`.
- Never show an unqualified "Safe"; use the defined verdicts only.

## Layout

- `core/`: Rust workspace and the `safety-core` crate.
- `core/bindings/wasm/`: wasm-bindgen package built with wasm-pack.
- `apps/web/`: Vite, React, TypeScript PWA.
- `contracts/v1/`: frozen shared contract.
- `localization/`: `nb`, `nn`, and `en` catalogs keyed by contract code.
- `test-vectors/`: golden corpora.

## Build and test

- Core: `cd core && cargo fmt --all --check && cargo clippy --all-targets -- -D warnings && cargo test --all`
- WASM gate: `cd core && cargo build --target wasm32-unknown-unknown -p safety-core`
- WASM package: `cd core/bindings/wasm && wasm-pack build --target web --out-dir pkg`
- Web: `cd apps/web && npm ci && npx tsc --noEmit && npm run test -- --run && npm run build`
- Contract: `node tools/check-contract-localization.js`

## Contract changes

`contracts/v1/finding-codes.json` is the registry. Adding a finding or limitation code requires:

1. The registry entry.
2. Text in all three catalogs: `localization/nb.json`, `localization/nn.json`, and `localization/en.json`.
3. A golden vector in `test-vectors/`.

## Commit and PR conventions

- Keep changes small and focused.
- Explain product invariant or contract changes in the PR description.
- Include CI evidence: core, WASM gate, web build, tests, and contract check.
- Do not commit secrets, generated build output, or local environment files.
