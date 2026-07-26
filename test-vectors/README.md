# Golden test vectors

This corpus is the most important asset in the repo: it is the single source of truth for what every platform agrees is dangerous. The **same** vectors are executed twice — once through the pure Rust core (`core/crates/safety-core/tests/conformance.rs`) and once through the compiled WebAssembly in a real browser (`apps/web/src/engine/wasmGoldenConformance.test.ts`) — so the web surface (and the future iOS and Android surfaces) can never silently disagree. The web runner deliberately parses `FIXED_NOW_MS` out of the Rust source so the two clocks cannot drift, and both runners assert a **minimum vector count** (currently `>= 118`) so a corpus that silently shrinks fails the build. A vector added here is a promise every future platform must keep, so precision matters more than volume.

The files in `test-vectors/golden/` are the stable corpus for the qrrrgh safety engine. Each JSON file is an array of vectors:

```json
{
  "id": "stable-unique-id",
  "payload": "decoded QR payload exactly as text",
  "expectedVerdict": "suspicious",
  "expectedFindings": ["url.shortener"],
  "mustNotContain": ["url.known_malicious"],
  "robustness": false,
  "notes": "Why this case exists and what a failure means."
}
```

`expectedFindings` is the set of codes that must be present. The engine may emit additional findings unless they are listed in `mustNotContain`. Some redirect cases include limitation codes in `expectedFindings` because the limitation is required observable output. Vectors marked `robustness: true` primarily assert that the engine returns a valid verdict and does not crash; they may omit strict finding expectations.

Valid verdicts are `known_malicious`, `suspicious`, `insufficient_evidence`, and `no_known_threat_found`. All finding and limitation codes must exist in `contracts/v1/finding-codes.json`.

## Redirect-chain vectors

`test-vectors/golden/redirect-chains.json` exercises the redirect analyzer (`core/crates/safety-core/src/redirect.rs`). Its vectors share the schema above but add one **optional** field, `redirectResolution`, that supplies a resolution the core would otherwise never see (the core has no I/O, so a host resolves the chain in an isolated resolver and passes the result in). The field is optional so every existing vector continues to parse unchanged; only redirect vectors set it. The file lives under `golden/` like every other corpus, so it is covered by all three gates — both conformance runners and `tools/validate-l10n.mjs` — rather than by the runners alone.

`redirectResolution` mirrors `RedirectResolution` in `contracts/v1/assessment.d.ts`:

```json
{
  "redirectResolution": {
    "chain": [
      { "url": "https://bit.ly/x1", "status": 301, "via": "http_status" },
      { "url": "https://dnb.no@evil.example/login", "status": 200 }
    ],
    "finalUrl": "https://dnb.no@evil.example/login",
    "outcome": "resolved",
    "elapsedMs": 34,
    "resolver": "qrrrgh-resolver/1"
  }
}
```

- `chain` is the ordered list of hops beginning with the scanned URL; hop 0 is the payload itself and `chain.length - 1` is the hop count. Each hop has a `url`, an optional HTTP `status`, and an optional `via` mechanism (`http_status`, `html_meta_refresh`, or `unknown`) describing how it pointed at the next hop.
- `outcome` is one of `resolved`, `max_hops`, `timeout`, `network_error`, `blocked`, or `loop`. Anything other than `resolved` is partial: the core never claims a `finalUrl` and never re-runs its URL detectors on the destination, so a failed or truncated check can never read as safe.
- `finalUrl` is present only when `outcome` is `resolved`. When it is, the core re-runs its URL detectors on it and tags those findings `subject: "final"`.
- `elapsedMs` and `resolver` are informational provenance only and do not affect the verdict.

The hop budget is `MAX_REDIRECT_HOPS = 5`: five hops is within budget, six (or a resolver `outcome` of `max_hops`) emits `redirect.excessive_hops` and forces `suspicious`. `redirect.cross_domain` is suppressed when the scanned URL is a known shortener, so an expanded shortener that simply lands elsewhere stays quiet. Use `mustNotContain` to lock in these guarantees — especially that failure and partial outcomes never yield `no_known_threat_found`. All hosts use reserved example domains (`*.example`) or documentation IP ranges so nothing in the corpus can ever resolve to a real host.
