# QR Safety Application: Offline Mode and Redirect Expansion Cross-Platform Plan

**Date:** 27 July 2026
**Status:** Planning addendum for web implementation in progress; native implementation later
**Applies to:** Web, iOS, Android, shared Rust core, first-party redirect resolver

---

## 1. Purpose

This document turns the offline-mode and redirect-expansion feature set into a cross-platform implementation plan. It does not replace the existing planning set. It narrows one area that cuts across all surfaces:

1. An offline mode toggle, disabled by default.
2. A bundled offline list of popular redirect and shortener hosts.
3. A warning, even offline, that a link is possibly a redirect, shown in addition to the verdict.
4. Final-destination display after explicit online redirect expansion.

Read this as an addendum to:

- `planning/qr-safety-implementation-plan.md`, especially product invariants, Phase 10, and the current web implementation status.
- `planning/qr-safety-technical-research.md`, especially sections 2, 3.4, 11, 14-17, and 37.
- `planning/qr-safety-unified-core-and-web-surface.md`, especially sections 3, 9, 11, and 12.
- The iOS and Android start guides for platform entry points, share flows, widgets, and store review.
- `planning/qr-safety-market-research-norway.md` for the product-language rule that the app must never claim unqualified safety.

The implementation plan remains the primary schedule. This document records the feature semantics so web, iOS, Android, extensions, widgets, share targets, and App Intents do not drift.

---

## 2. Terms and decision recorded here

The older planning documents use `offline-first`, `online mode`, and `online enrichment` in slightly different ways. This plan fixes the product meaning for this feature set:

| Term | Meaning for this plan |
|---|---|
| Offline mode OFF | Default. Online capabilities may be offered, but every check still starts locally and any network call requires explicit per-check user consent. This is the pattern already implemented on the web surface for redirect expansion. |
| Offline mode ON | Strictly zero network calls by that app surface. The user is told up front that redirects cannot be followed. No resolver call, no rule refresh, no reputation lookup, no analytics, no preview fetch. |
| Per-check consent | A user action tied to the current payload, for example **Expand this link safely**. It is not a blanket permission to contact first-party services for later scans. |
| Redirect cue | A non-verdict warning from the shared core that the scanned URL is known or likely to hide a destination. It appears alongside the verdict and must not be styled or announced as the verdict itself. |

This is intentionally stricter than ordinary online/offline product language. Even when offline mode is OFF, the app does not automatically resolve a link merely because the network exists.

---

## 3. Non-negotiable invariants for this feature

These are inherited from `AGENTS.md` and the implementation plan, and must be explicitly tested per platform.

1. Never open a scanned link automatically.
2. The user's device must not contact the scanned destination.
3. The Rust core has no I/O, networking, system time, or threads; hosts pass data in.
4. The Rust core must continue to build for `wasm32-unknown-unknown`.
5. Never show an unqualified `Safe`; use only the defined verdicts:
   - `known_malicious`
   - `suspicious`
   - `insufficient_evidence`
   - `no_known_threat_found`

The redirect resolver pattern exists because of invariant 2. The client sends only the scanned URL to a first-party resolver service. The resolver follows the chain server-side with SSRF protections and a redirect budget of 5. This keeps the user's IP address, device fingerprint, cookies, installed-app state, and local network away from the scanned destination.

---

## 4. Current code facts verified before writing this plan

The plan must match the real repository, not only the planning documents.

| Area | Verified state on 27 July 2026 |
|---|---|
| Contract registry | `contracts/v1/finding-codes.json` contains `url.shortener`, `url.possible_shortener` (severity `low`, category `redirection`), and `limitation.redirect_not_expanded`. The registry `$comment` carries the verbatim emission spec that core and every surface must implement identically. |
| Bundled shorteners | `core/crates/safety-core/src/rules.rs` has 38 hosts, including `aka.ms`, `t.me`, `wa.me`, `fb.me`, `amzn.to`, `g.co`, `t.ly`, and `goo.su` alongside the original 13. `youtu.be` is deliberately excluded: it is predominantly a direct video host, so flagging it would add noise on every YouTube link. |
| Rule metadata | The bundled `RulePackage` has `version` and `generated_at_ms`; the default is `bundled-2026-07-27`, bumped with the registry expansion so `freshness_limitations()` does not immediately emit `limitation.rules_stale`. |
| Rule staleness | `RulePackage::freshness_limitations(now_ms)` emits `limitation.rules_stale` after 30 days. The host supplies `now_ms`; the core does not read time. |
| Current shortener detection | `detect.rs` emits `url.shortener` for an exact bundled shortener host and `url.possible_shortener` for the heuristic case; the two are mutually exclusive. `limitation.redirect_not_expanded` now fires for either cue when no chain was resolved. |
| Expansion availability | `verdict.rs` offers `expand_redirect_online` for **every** unexpanded http(s) URL, independently of the detection cues. See §5.4. |
| Current limitations | `detect.rs` always adds `limitation.offline_no_reputation` and `limitation.classifier_unavailable` in the offline path. |
| Redirect folding | `engine.rs` accepts optional `redirect_resolution`, analyzes it in the core, and removes `limitation.redirect_not_expanded` after a supplied resolution. |
| Web resolver | `apps/web/src/lib/resolverClient.ts` talks only to the configured first-party resolver URL, has a 30s timeout for Azure Container Apps cold start, validates the untrusted response shape, and synthesizes non-reassuring failure outcomes. |
| Web UI | `RedirectPanel.tsx` shows the per-check opt-in, final destination, traversed domains, hop list, and destination findings. `neutralizeForDisplay()` escapes control and bidi/invisible characters before displaying hostile URLs. |
| Web privacy chrome | `App.tsx` says there is no analytics, tracking pixel, link preview, favicon lookup, or backend API call unless offline mode is off *and* the user explicitly asks for expansion, and states that offline mode disables expansion entirely. |
| Web offline mode | `App.tsx` holds a persisted `qrrrgh.offlineMode` switch, default OFF, that swaps in an effective resolver with `available: false` and a throwing `resolve()`. `ResultPanel.tsx` renders `ui.possible_redirect_warning` in both modes via `hasRedirectCue()`. |

One planning/documentation mismatch remains an intentional input to the work ahead:

1. Some older planning text describes online mode as something to explicitly enable, or refers to an Azure Function resolver. The current web pattern is first-party Azure Container Apps, scale-to-zero, available by configuration but used only after per-check consent.

---

## 5. Shared core and contract shape

### 5.1 Core-owned evidence

The shared Rust core owns all security meaning. The clients do not decide whether a host is a shortener, whether a redirect chain is reassuring, or whether a destination finding changes the verdict.

Planned redirect cue outputs:

| Code | Owner | Meaning | Mutually exclusive with |
|---|---|---|---|
| `url.shortener` | Shared core | The host is in the bundled shortener registry. | `url.possible_shortener` |
| `url.possible_shortener` | Shared core | The host matches a conservative heuristic for unknown redirect/shortener hosts. | `url.shortener` |
| `limitation.redirect_not_expanded` | Shared core | No redirect chain was resolved for this check, so the final destination is unknown. | Removed when a `redirectResolution` is supplied and accepted. |

`url.shortener` and `url.possible_shortener` are findings, not verdicts. They feed the verdict policy with the rest of the evidence, but the UI must still show the single verdict produced by the core.

### 5.2 Host-owned policy inputs

The host supplies:

- `payload`
- `nowMs`
- `locale`
- optional signed `rules`
- optional `redirectResolution`

The host never supplies a verdict. It also never fetches the scanned destination directly. In online mode the host can, after per-check consent, send the scanned URL to the first-party resolver and pass the returned chain into the core.

### 5.3 Rule package distribution

The shortener registry lives in the shared Rust rules package as bundled rules with:

- `version`
- `generatedAtMs`
- `shortenerHosts`

The existing staleness contract applies to the shortener registry too. If `nowMs - generatedAtMs` exceeds 30 days, the core emits `limitation.rules_stale` with `ageDays`.

Signed rule updates are already contemplated in the implementation plan. For this feature, signed updates must obey these rules:

1. Bundled rules are always available and must be enough for offline mode.
2. Updating rules is a first-party network call, never a scanned-destination call.
3. Offline mode ON disables automatic and manual in-app rule refresh. The only update path then is installing a newer app/build or PWA asset version.
4. Offline mode OFF may offer rule refresh, but it must not be hidden inside a scan. Either refresh only after explicit settings consent, or ask before the first first-party update request.
5. If rules are stale and cannot be refreshed because offline mode is ON, surface `limitation.rules_stale` plainly: the app can still check locally, but the shortener and reputation lists may be outdated.

---

### 5.4 Warnings are conservative; the expansion option is not

A defect found on 27 July 2026 forced this distinction to be made explicit. `aka.ms/learn-azure`
was assessed as `no_known_threat_found` with no way to check where it went: `aka.ms` was missing
from the bundled registry, and the heuristic in `detect.rs` requires the path segment to contain
both a letter and a digit, so a readable word slug can never match it. The UI then gated the
expansion control on a detection cue being present, so an unlisted redirector produced a
reassuring verdict about a destination the product had never seen.

The two concerns are now separated, and must stay separated on every surface:

| | Detection cues (`url.shortener`, `url.possible_shortener`) | Expansion option (`expand_redirect_online`) |
|---|---|---|
| Question answered | "Should we warn about this?" | "Can the user ask us to check?" |
| Policy | Conservative. Only a registry hit or a strict heuristic. | Permissive. Every unexpanded http(s) URL. |
| Cost of being wrong | A false warning is noise, and noise trains users to ignore warnings. | None. The user must actively choose it. |
| Owner | `detect.rs` | `verdict.rs::recommended_actions` |

The heuristic was deliberately **not** relaxed to catch word slugs. Dropping the digit requirement
would flag `vg.no/sport` and `nrk.no/nyheter` — mainstream Norwegian news links — which is
unacceptable in the launch market.

Consequences to preserve:

1. Any URL can redirect, and no bundled registry can ever know them all, so expansion availability
   must not depend on the registry. Adding a host to the registry changes whether the user is
   *warned*, never whether they *can check*.
2. Offering expansion costs nothing in false positives, because it is an option the user chooses
   rather than a claim the product makes.
3. The privacy invariant is unchanged: expansion is per-check consented, runs in the isolated
   resolver, and the device never contacts the scanned destination.
4. Expansion is offered only while `redirect_resolution` is absent, so it disappears once a chain
   has been expanded.
5. Non-http(s) payloads (`javascript:`, `wifi:`, plain text) never offer it.

---

## 6. User-visible copy contract

The product needs one shared localization contract for security meaning and thin platform chrome for operating-system-specific controls.

### 6.1 Shared localization catalog

These strings come from `localization/{nb,nn,en}.json` and must be available on every surface:

| Key family | Purpose |
|---|---|
| `verdict.*` | The four public verdict labels and details. |
| `url.shortener` | Known shortener warning. |
| `url.possible_shortener` | Unknown/heuristic shortener warning. |
| `limitation.redirect_not_expanded` | The check did not follow redirects; final destination is unknown. |
| `limitation.rules_stale` | Bundled or signed rules are older than the accepted freshness budget. |
| `limitation.rules_unavailable` | Signed rules could not be loaded; bundled fallback is in use. |
| `online.*` | Shared redirect-expansion disclosure, progress, final-destination, over-budget, incomplete, error, and retry copy. |
| `ui.real_destination` | Shared label for the destination that the core/resolver identified. |

Required new shared copy keys for the offline toggle:

| Proposed key | Required meaning |
|---|---|
| `settings.offline_mode.title` | Label for the toggle. |
| `settings.offline_mode.off_detail` | Online capabilities are available only after explicit consent for a check. |
| `settings.offline_mode.on_detail` | No network calls will be made; redirects cannot be followed. |
| `settings.offline_mode.redirect_limitation` | Up-front limitation shown while offline mode is ON. |
| `settings.rules.stale_offline_detail` | Rules are stale and cannot refresh while offline mode is ON. |

The wording must be localized in Bokmål, Nynorsk, and English before release. English fallback in a Norwegian locale is a defect, not an acceptable launch state.

### 6.2 Platform chrome

Platform chrome is allowed only for native setting labels and OS-specific navigation text, for example:

- iOS Settings row title, App Intent phrase, widget configuration title.
- Android Settings screen title, Quick Settings tile subtitle, widget configuration title.
- Web install/PWA wording.

Even platform chrome must use the same semantic message. No platform may shorten the ON state to only `Offline`; it must include the redirect limitation close to the toggle.

### 6.3 Baseline copy, not final translations

The English source meaning should be:

- Toggle label: `Offline mode`
- OFF detail: `Online checks are available, but nothing leaves this device unless you choose it for a check.`
- ON detail: `No network calls will be made. Redirects cannot be followed, so the final destination may stay hidden.`
- Redirect cue: `Possibly a redirect` / `This link may hide its final destination. The verdict below is still the app's assessment; this warning is extra context.`
- Rule stale while offline: `Offline rules are {ageDays} days old. Because offline mode is on, the app cannot refresh them.`

The exact strings should be refined in the localization catalogs, not hard-coded separately in Swift, Kotlin, and TypeScript.

---

## 7. Web plan

### 7.1 Current state already done on web

The current web implementation already has these parts of the plan:

- A local-first check using the WebAssembly core.
- A per-check redirect-expansion opt-in for known shorteners.
- A first-party resolver client; the browser does not contact the scanned shortener or final destination.
- Final-destination display after expansion.
- A hop list and traversed-domain list.
- Failure and over-budget framing that does not read as reassuring.
- Neutralized display of hostile URL text.
- Privacy copy explicitly excluding analytics, link preview, favicon lookup, tracking pixels, and backend calls except explicit expansion.
- E2E coverage that stubs the resolver and fails if the browser contacts the scanned shortener or final destination.

### 7.2 Web work still required

The web surface still needs the global offline mode toggle described here. Today online expansion is offered when the resolver is configured and the core emits the redirect cue; that is per-check consent, but it is not yet a persisted user preference that can force strictly zero network calls.

### 7.3 Toggle semantics and persistence

| State | Web behaviour |
|---|---|
| OFF, default | Run local analysis. If the core emits a redirect cue and a resolver is configured, show the opt-in panel. Do not call the resolver until the user clicks. |
| ON | Run local analysis only. Do not show an active expansion button. Show the offline limitation up front and near the redirect cue. Do not refresh rules or call the resolver. |

Persistence:

- Store the canonical value in `localStorage` under a versioned key such as `qrrrgh.offlineMode.v1`.
- Mirror the value into IndexedDB if a service worker, Web Share Target, background sync, or richer PWA shell needs to read it outside the current React tree.
- Treat storage absence, parse errors, private-browsing failures, and eviction as OFF only if no network call is made automatically. Since OFF still requires per-check consent, this fail-open-for-availability state does not contact a destination or first-party service by itself.
- If persistent storage is unavailable, show a non-blocking settings limitation and keep the current in-memory value for the session.

Propagation traps:

- The PWA share target, if added for Android browsers, must read the same persisted setting before rendering any expansion affordance.
- A service worker must not perform rule updates, prefetches, or resolver warmups while offline mode is ON.
- The web app manifest must not include shortcuts that imply automatic expansion.

### 7.4 Web no-contact requirements

In addition to never calling the scanned destination through `fetch`, the web implementation must continue to block subtle contacts:

- No favicon lookup for the scanned or final host.
- No Open Graph, Twitter Card, image, screenshot, or link-preview fetch.
- No DNS prefetch, `preconnect`, prerender, or speculative navigation for scanned/final hosts.
- No anchor with `href` to the hostile URL unless opening is a separate explicit action and guarded by the core's allowed actions.
- CSP should keep `connect-src` limited to `self` and the configured first-party resolver origin only.
- Tests should fail on any request to the scanned host or final host.

### 7.5 Web accessibility and localization

- The offline toggle must be a real form control with accessible name, state, and description.
- The up-front offline limitation must use `role="status"` or be placed in the main result flow so screen readers encounter it before the opt-in area that is disabled or absent.
- The redirect cue must be announced as a warning/note, not conveyed only by color.
- The result container should keep the existing focus-on-result behaviour after a scan.
- `document.documentElement.lang` must continue to track `nb`, `nn`, or `en`.

---

## 8. iOS plan

### 8.1 Toggle semantics

| State | iOS behaviour |
|---|---|
| OFF, default | Local assessment runs in the app, Share extension, App Intents, widgets, and supported camera flows. If a redirect cue is present, the full app may offer per-check expansion through the first-party resolver. |
| ON | All iOS targets are local-only. The full app, Share extension, App Intents, widgets, and Locked Camera Capture flows must suppress resolver calls and rule refresh. They show that redirects cannot be followed. |

Locked Camera Capture already has severe access limits in the implementation plan. Treat it as offline-only even when the global preference is OFF, unless Apple explicitly permits the required App Group and network flow in a later design review.

### 8.2 Persistence and propagation

Use App Group storage as the canonical source, not ordinary app-only `UserDefaults`, because the setting must be visible to extensions and widgets.

Recommended shape:

- App Group suite: `UserDefaults(suiteName: "group.<bundle>.qrrrgh")`.
- Key: `offlineMode.v1` with a boolean value.
- Main app writes changes and posts local notifications for in-process UI updates.
- Share extension reads synchronously on launch before deciding whether to offer **Open full report** or any expansion handoff.
- Widgets read through the App Group timeline provider and render stale/offline limitations where space permits.
- App Intents read the App Group value inside the intent handler before making any network-capable handoff.
- Locked Camera Capture bundles offline assets and should not depend on App Group availability while locked.

If App Group storage is unavailable, fail closed for network: treat offline mode as ON for that extension invocation and tell the user the preference could not be read.

### 8.3 iOS resolver path

The iOS client follows the same pattern as web:

1. Run local core assessment first.
2. If offline mode is OFF, offer expansion for any unexpanded http(s) URL — not only for ones carrying a shortener cue (§5.4) — through a per-check consent sheet.
3. Send only the scanned URL to the first-party resolver service.
4. Pass the returned `RedirectResolution` to the shared core through UniFFI.
5. Render the core's updated verdict, findings, limitations, and redirect analysis.

Do not use `SFSafariViewController`, `WKWebView`, `LPMetadataProvider`, `UIApplication.open`, Universal Link probing, or app-link style handoff during analysis. Those APIs either contact the destination, render untrusted remote content, or can trigger app-level link resolution that violates the product invariant.

### 8.4 iOS display and accessibility

- The redirect cue should appear immediately below or adjacent to the verdict card, under a heading such as **Extra warning**, not as a second verdict.
- VoiceOver must announce both the verdict and the redirect cue. Do not rely on yellow/orange styling alone.
- The final destination should show the host and registrable domain first, with the full neutralized URL in a disclosure control.
- Each hop should be listed as text, not tappable links.
- Any explicit open action must be separate from the analysis screen, unavailable when the core returns `open_blocked`, and never labeled `safe`.
- Use the shared `nb`, `nn`, and `en` catalog strings for verdicts, findings, limitations, and online disclosures. Swift strings only wrap platform navigation.

---

## 9. Android plan

### 9.1 Toggle semantics

| State | Android behaviour |
|---|---|
| OFF, default | Local assessment runs in the app, Sharesheet receiver, shortcuts, widgets, and Quick Settings entry. If a redirect cue is present, the full app may offer per-check expansion through the first-party resolver. |
| ON | Every Android entry point is local-only. Resolver calls, first-party rule refresh, work-manager refresh jobs, and shortcut/widget expansion actions are disabled. |

### 9.2 Persistence and propagation

Use Jetpack DataStore as the canonical store for the main app and any code running in the app process. Widgets and edge entry points may still need a simpler bridge.

Recommended shape:

- Canonical store: Preferences DataStore key `offline_mode_v1`.
- Mirror store: encrypted or ordinary `SharedPreferences` only for components that cannot conveniently read DataStore, such as `AppWidgetProvider` update code or legacy receivers.
- Main app writes DataStore and immediately updates the mirror.
- Sharesheet receiving Activity reads DataStore before it renders any online affordance.
- Quick Settings TileService reads the mirror or a small synchronous cache before deciding its subtitle/action.
- Widgets read the mirror during updates and must not expose an expansion action while offline mode is ON.
- WorkManager rule-refresh jobs must declare the offline-mode setting as a runtime gate, not merely a network constraint.

If the setting cannot be read, fail closed for network in receivers, widgets, and services.

### 9.3 Android resolver path

Android uses the same first-party resolver pattern:

1. Compose UI runs the local Rust core through UniFFI/Kotlin bindings.
2. If offline mode is OFF and the core emits a redirect cue, show per-check consent.
3. Send only the scanned URL to the first-party resolver.
4. Feed the returned chain into the core.
5. Render the resulting verdict and redirect analysis.

Do not use WebView, Chrome Custom Tabs warmup, link previews, favicon libraries, `Linkify` auto-links, `URLSpan` auto-click handling, package-manager app-link resolution, or any metadata fetch for the scanned/final URL during analysis. Android App Links must be treated as content to explain, not as something to resolve automatically.

### 9.4 Android display and accessibility

- Compose semantics must expose the toggle name, checked state, and limitation text.
- The redirect cue must be a text warning with semantic announcement, not only a colored icon.
- TalkBack should encounter verdict first, then the extra redirect cue, then findings and limitations.
- The final destination card should show host/domain as neutralized text. Full URL and hop details belong in expandable text rows, never auto-linked spans.
- Shared localization must cover `nb`, `nn`, and `en`; Compose resources only wrap platform chrome.

---

## 10. Final-destination display contract

This contract is shared by all three surfaces.

### 10.1 When resolved

Show:

1. The existing core verdict.
2. A clearly labelled final-destination section.
3. Final host and registrable domain.
4. The redirect path as domains traversed.
5. A disclosure for each hop, including status and mechanism when available.
6. Findings about the final URL under a separate heading or badge, using `subject = final`.

The copy must say that expansion does not prove safety. The current web copy already follows this: `This does not mean the destination is safe — read the findings below.`

### 10.2 Over budget

The resolver budget is 5 redirects. If the chain exceeds that budget:

- Use `outcome = max_hops`.
- The core frames it as untrusted / non-reassuring.
- The UI says it stopped because there were too many redirects.
- Do not show a guessed final destination.

### 10.3 Failed, blocked, timeout, or loop

For `timeout`, `network_error`, `blocked`, or `loop`:

- State that expansion could not finish.
- State that the user's device still did not contact the link.
- Keep or add the relevant limitation.
- Do not downgrade the verdict because a resolver failed.
- Do not show green styling or words such as `clean`, `safe`, or `verified`.

### 10.4 Neutralizing hostile URL text

Every URL, host, path, status target, and redirect mechanism string is attacker-controlled. Display rules:

- Render as text, not HTML.
- Escape or visibly encode C0/C1 control characters.
- Escape bidi controls and invisible directional characters.
- Preserve enough text for the user to recognize what was scanned.
- Do not auto-link hop URLs.
- Do not load icons, favicons, screenshots, page titles, Open Graph images, or previews.

---

## 11. The redirect cue in the result hierarchy

The redirect cue must appear in addition to the verdict, not instead of it.

Recommended order:

1. Verdict card.
2. Extra redirect warning, if `url.shortener` or `url.possible_shortener` is present. This is the *warning*, which stays conservative.
3. Up-front offline limitation if offline mode is ON.
4. Findings list.
5. Limitations list.
6. Optional online expansion panel, offered for any unexpanded http(s) URL whenever offline mode is OFF and a resolver is configured. This is the *option*, which is always available (§5.4), so its presence must never be read as a warning.

Accessibility rules:

- Screen readers must announce the cue.
- The cue must have a text label such as `Possible redirect` or `Shortened link`.
- Do not encode the warning only as color, icon, or position.
- Do not use alert semantics unless the result just changed and immediate announcement is needed; too many alerts make the verdict harder to understand.

False positives are expected for the heuristic cue. The wording must therefore say `possibly` and explain that the app could not confirm the final destination without expansion.

---

## 12. Rule updates and offline mode

The user-visible rule is simple: offline mode ON means no network calls. That includes good network calls.

| Situation | Required behaviour |
|---|---|
| Bundled rules fresh | Assess normally. |
| Bundled/signed rules stale, offline mode OFF | Show `limitation.rules_stale`; offer an explicit first-party rule refresh if the signed update path exists. |
| Bundled/signed rules stale, offline mode ON | Show `limitation.rules_stale` plus offline explanation; do not offer an in-flow refresh button unless it first explains that turning offline mode off is required. |
| Signed update unavailable | Use bundled rules and show `limitation.rules_unavailable` if a configured update package failed validation/loading. |
| App never goes online | It keeps working with bundled rules, but staleness remains visible after 30 days until an app/PWA update or explicit rule refresh is allowed. |

The shortener registry should grow through signed rule updates and app releases. Do not fetch third-party shortener lists directly from clients.

---

## 13. Per-platform implementation checklist

### 13.1 Web

Already done:

- [x] Local WebAssembly core assessment.
- [x] Per-check resolver opt-in for known shorteners.
- [x] First-party resolver client that never calls scanned/final hosts.
- [x] Final destination, path, hop list, and final findings UI.
- [x] Neutralized hostile URL display.
- [x] Privacy copy that forbids previews, favicons, tracking pixels, and hidden backend calls.
- [x] E2E test for no contact with scanned/final hosts during expansion.

Still to do:

- [x] Add persisted offline mode toggle, default OFF (`qrrrgh.offlineMode` in `localStorage`).
- [x] Add shared localization keys for offline mode copy in `nb`, `nn`, and `en`.
- [x] Gate resolver UI and all resolver calls on the persisted setting.
- [x] Add tests for offline mode ON: no resolver call, limitation visible, warning in both modes.
- [x] Add tests for heuristic `url.possible_shortener` (golden vectors plus mock/WASM conformance).

Still to do:

- [ ] Gate any signed rule refresh path on the persisted setting (no refresh path exists yet).
- [ ] Mirror preference to IndexedDB if service worker/share target code needs it.

### 13.2 iOS

- [ ] Add App Group entitlement and shared `offlineMode.v1` preference.
- [ ] Add Settings UI toggle, default OFF, with shared localized limitation text.
- [ ] Read the setting in main app, Share extension, widgets, App Intents, and any Locked Camera Capture path.
- [ ] Fail closed for network if an extension cannot read the setting.
- [ ] Add per-check resolver consent only in contexts that are allowed to perform network calls.
- [ ] Ensure Share extension and Locked Camera flows remain useful offline and hand off to the app only by explicit user action.
- [ ] Block `LPMetadataProvider`, `SFSafariViewController`, `WKWebView`, `UIApplication.open`, and Universal Link opening during analysis.
- [ ] Add VoiceOver tests or manual QA scripts for verdict, redirect cue, and offline limitation order.
- [ ] Add golden-vector parity through UniFFI for `url.shortener`, `url.possible_shortener`, and redirect outcomes.

### 13.3 Android

- [ ] Add Preferences DataStore key `offline_mode_v1`, default false.
- [ ] Mirror the preference to SharedPreferences for widgets, tile services, or receivers that need synchronous reads.
- [ ] Add Settings UI toggle with shared localized limitation text.
- [ ] Read the setting in the main app, Sharesheet receiver, shortcuts, widgets, and Quick Settings tile.
- [ ] Fail closed for network if the setting cannot be read.
- [ ] Gate resolver consent and WorkManager rule-refresh jobs on the setting.
- [ ] Block WebView, Custom Tabs warmup, link preview libraries, favicon fetches, `Linkify`, `URLSpan`, and automatic App Link resolution during analysis.
- [ ] Add TalkBack QA for verdict, redirect cue, and offline limitation order.
- [ ] Add golden-vector parity through UniFFI/Kotlin for `url.shortener`, `url.possible_shortener`, and redirect outcomes.

---

## 14. Risks and open questions

| Risk / question | Why it matters | Current plan |
|---|---|---|
| Heuristic false positives | `url.possible_shortener` could warn on legitimate short domains or messaging links. | Keep wording as `possibly`; make it an extra warning, not a verdict; measure false positives before tightening verdict policy. |
| Shortener registry coverage | The bundled list is now 38 hosts including `aka.ms` and `t.me`, but any fixed list goes stale and `youtu.be` is intentionally omitted. | Expand through reviewed bundled rules and signed updates; add golden vectors with every registry expansion; rely on `url.possible_shortener` to cover hosts the list has not caught yet, and on always-available expansion (§5.4) so an unlisted redirector is still checkable. |
| Resolver cost at scale | Azure Container Apps scale-to-zero controls idle cost, but popular use could create real egress and compute cost. | Keep per-check consent, hop/time/body budgets, caching only if privacy-reviewed, and operational dashboards that do not log sensitive payloads unnecessarily. |
| Cold starts | Scale-to-zero can make the first expansion slow. | Web already uses a 30s client timeout because measured cold start plus resolver budget can exceed 12s. Native clients need the same honest progress and timeout framing. |
| Store review scrutiny | A security-claims app with URL checks, extensions, and first-party networking may get App Store / Play Store privacy and safety questions. | Keep claims narrow, avoid `safe`, document data flows, and prepare review fixtures proving the client does not contact destinations. |
| Rule updates vs offline promise | A user who keeps offline mode ON forever cannot refresh rules from the service. | Surface staleness using `limitation.rules_stale`; rely on app/PWA updates unless the user turns offline mode off and explicitly refreshes. |
| Obvious shortener while offline | The app may know a link is a shortener but cannot reveal where it lands. | Show `url.shortener` plus `limitation.redirect_not_expanded`; explain that the final destination may be hidden; do not imply the link is acceptable. |
| One-time or authentication-bearing URLs | Sending the scanned URL to the resolver may consume or disclose sensitive one-time tokens to first-party infrastructure. | Keep per-check consent explicit and preserve the open decision from the implementation plan about one-time/authentication-bearing URL policy. |
| Documentation drift | Older plans use different online/offline wording and mention a different resolver hosting shape. | Treat this document and the live web implementation notes as the feature-specific source until the older docs are consolidated. |

---

## 15. Acceptance criteria

The feature is complete on a platform only when all of the following are true:

1. Offline mode defaults OFF.
2. Turning offline mode ON prevents every network call from that surface, including first-party resolver and rule update calls.
3. A new scan/check always starts with local core assessment.
4. Online redirect expansion requires explicit per-check consent.
5. The user's device never contacts the scanned destination or final destination.
6. Known and possible shortener cues come from the shared core.
7. The redirect cue is visible and accessible, and is not presented as a verdict.
8. Final-destination display is shown only when a resolver chain was supplied to and accepted by the core.
9. Over-budget and failed resolution states are not reassuring.
10. URL text is neutralized and never auto-linked in hop displays.
11. Bokmål, Nynorsk, and English are complete for shared safety copy.
12. Platform extensions, widgets, App Intents, share targets, shortcuts, and tiles honor the same offline preference as the main app.
