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
- Web: `cd apps/web && npm ci && npx tsc --noEmit && npm run lint && npm run test -- --run && npm run build`
  - `npm run lint` (oxlint) is a separate CI step and enforces `jsx-a11y` rules that `tsc` and vitest do not catch. Run it before pushing any JSX change.
- Browser/a11y: `cd apps/web && npx playwright test --workers=1`
- Contract: `node tools/check-contract-localization.js`
- Store assets: `node tools/check-store-listings.mjs && node tools/check-store-images.mjs && node tools/gen-store-assets-doc.mjs --check && node --test "tools/*.test.mjs"`

## Store assets

`brand/store-assets.json` is the registry of every slot the App Store, Play and
the Microsoft Store offer — images and text, required and optional, including
the ones deliberately left empty. `brand/STORE-ASSETS.md` is generated from it
and is the list to work from when producing or regenerating a set.

Adding or changing a store asset requires:

1. The registry entry, including `status` and `provided`.
2. `node tools/gen-store-assets-doc.mjs` to regenerate the document.
3. The asset itself, or the listing field, so the checkers agree with it.

Never hand-edit `brand/STORE-ASSETS.md`; CI fails when it differs from the
registry. Play and the App Store reject uploads carrying an alpha channel
(everywhere except the Play app icon); `node tools/strip-png-alpha.mjs <file...>`
converts a capture in place and refuses any image that is genuinely translucent.

The checkers themselves are covered by `node --test "tools/*.test.mjs"`, which
runs each one against a throwaway tree with one field of a known-good fixture
changed. Loosening a rule without noticing shows up there rather than in a
store rejection, so extend those tests alongside any new registry field.

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
