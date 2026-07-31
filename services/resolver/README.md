# qravn-resolver

SSRF-hardened **redirect resolver** for [QRavn](../../), a QR-code safety checker.

The product promise is that checking a hostile QR code never tells the destination
that anyone looked at it. The user's device therefore never fetches a scanned URL.
When a user **explicitly** opts into online mode, this service expands the redirect
chain on their behalf, in isolation, and returns **only the chain** — never page
content.

That makes this service a URL-fetcher that accepts arbitrary attacker-supplied URLs
from the public internet: a textbook [SSRF](https://owasp.org/Top10/A10_2021-Server-Side_Request_Forgery_%28SSRF%29/)
cannon. Every hardening item below is load-bearing.

## API

```
POST /v1/resolve
  Request:  { "url": "https://..." }
  Response 200: a RedirectResolution (see contracts/v1/assessment.d.ts)
                { chain: [{ url, status?, via? }], finalUrl?, outcome, elapsedMs?, resolver? }
  400  malformed request or unparseable URL
  413  request body too large
  422  URL rejected by policy (blocked scheme/port/host)  -> body is a RedirectResolution, outcome "blocked"
  429  rate limited
  500  unexpected internal error
  504  overall timeout                                     -> outcome "timeout"

GET /healthz -> 200 { "ok": true }   (never touches the network; used by the platform probe)
```

- Listens on `process.env.PORT ?? 8080`, binds `0.0.0.0`.
- `outcome` is one of `resolved | max_hops | timeout | network_error | blocked | loop`.
- Hop 0 is the scanned URL itself, so `hopCount === chain.length - 1`.
- `finalUrl` is present **only** when `outcome === "resolved"`.
- `via` on each hop is `http_status`, `html_meta_refresh`, or `unknown`.
- `resolver` is a name+version provenance string, `qravn-resolver/1.0.0`.

The wire types are mirrored locally in [`src/contract.ts`](src/contract.ts) from the
frozen contract in `contracts/v1/assessment.d.ts`. The Rust core parses the same
shape; the two must stay identical.

### Outcome -> HTTP status

| outcome         | status |
| --------------- | ------ |
| `resolved`      | 200    |
| `max_hops`      | 200    |
| `loop`          | 200    |
| `network_error` | 200    |
| `blocked`       | 422    |
| `timeout`       | 504    |

`blocked` and `timeout` still return a full `RedirectResolution` body so the core can
render the chain it has.

## Hop budget

`MAX_REDIRECTS = 5` (exported from [`src/constants.ts`](src/constants.ts)). The
service follows **at most 5 redirects after the scanned URL**. If a 6th would be
required it stops and returns `outcome: "max_hops"` with the 6-entry chain it has
(hop 0 + 5 redirect targets, the 6th target never fetched). The core then flags the
link untrusted, citing "too many redirects".

This is identical to the Rust core's single source of truth,
`safety_core::MAX_REDIRECT_HOPS = 5` (`core/crates/safety-core/src/redirect.rs`). The
boundary is exact and agreed by both: **five redirects followed → `resolved` with a
six-entry chain; a sixth needed → `max_hops` with a six-entry chain.** If either
constant changes, change both.

## SSRF hardening

All of the following are enforced, and re-checked at **every** hop (a redirect target
is a brand-new attacker-chosen URL):

1. **Scheme allowlist** — `http:` and `https:` only.
2. **Port allowlist** — 80 and 443 only.
3. **Embedded credentials rejected** — `https://user:pass@host/` is blocked.
4. **DNS resolved by us, every IP validated** before connecting. Blocked ranges
   ([`src/ipGuard.ts`](src/ipGuard.ts)): loopback (`127/8`, `::1`), private
   (`10/8`, `172.16/12`, `192.168/16`, `fc00::/7`), link-local (`169.254/16` — the
   cloud metadata endpoint — and `fe80::/10`), CGNAT `100.64/10`, `0.0.0.0/8`,
   broadcast, multicast, all IETF-reserved ranges, and **IPv4-mapped / -compatible
   IPv6** (`::ffff:127.0.0.1` cannot slip through). Both A and AAAA are checked; if
   **any** resolved address is disallowed the whole URL is blocked.
5. **DNS-rebinding defeated by pinning** — see below.
6. **Re-validation at every hop** — full scheme/port/credential/DNS/IP check again.
7. **Never auto-follow** — the client uses no redirect following; we walk the chain
   ourselves with `redirect`-less raw `http`/`https` requests so we control the budget
   and inspect each hop.
8. **Body cap** — at most ~64 KB is read, and only when the content type is HTML (we
   need it solely to detect `<meta http-equiv="refresh">`). Body content is never
   returned to the client.
9. **Timeouts** — per-hop connect/response timeout (~2 s) and a hard overall deadline
   (~10 s). A slowloris server cannot pin a worker.
10. **Nothing identifying is sent** — no cookies, no `Referer`, no auth headers. A
    neutral, honest `User-Agent`
    (`qravn-resolver/1.0.0 (+https://github.com/webmaxru/qravn; QR redirect expander; stores no page content)`)
    lets site owners attribute the traffic.
11. **Loop detection** — visited URLs are tracked; a repeat returns `outcome: "loop"`.
12. **Rate limiting** per client IP + a request body-size cap. This endpoint costs
    money and makes outbound requests; it must not be a free proxy or amplifier.
13. **CORS** — only the web app origin
    (`https://brave-bay-0ecf82e03.7.azurestaticapps.net`) plus localhost dev origins,
    configurable via `CORS_ALLOWED_ORIGINS`. Never `*`.
14. **URLs are never logged at info level** (they can carry tokens) — only hostnames
    and outcomes ([`src/logger.ts`](src/logger.ts) `safeHost`).

Also handled: relative `Location` headers (resolved against the current hop), missing
`Location` on a 3xx (`network_error`), non-ASCII/IDN hosts (punycoded by the WHATWG
URL parser), absurdly long URLs (`MAX_URL_LENGTH`), and `meta refresh` with a delay
(only short delays, `<= META_REFRESH_MAX_DELAY_SECONDS`, count as a redirect; recorded
as `via: "html_meta_refresh"`). WHATWG URL normalization also neutralizes octal / hex /
dword IPv4 obfuscation (`http://0177.0.0.1/` -> hostname `127.0.0.1`, then blocked).

### How DNS rebinding is defeated (and how it is proven)

Rebinding is the classic bypass: validate the hostname, then let the HTTP client
re-resolve it — the attacker returns a **public** IP to your check and a **private**
IP to the real connection.

Defence ([`src/resolve.ts`](src/resolve.ts) `validateHost` +
[`src/httpClient.ts`](src/httpClient.ts) `requestHop`):

1. We resolve the hostname ourselves (`dns.lookup`, `all: true`, both families).
2. We validate **every** returned address against `isBlockedIp`. If any is disallowed
   the URL is blocked outright.
3. We select one validated address and **pin** it: the `http`/`https` request is given
   a custom `lookup` that ignores the hostname and returns **only that pinned IP**.
   Node never performs its own DNS resolution, so the connection is guaranteed to go to
   the exact address we validated. The original hostname is still used for the `Host`
   header and TLS SNI/`servername`, so virtual hosting and certificate validation stay
   correct.

**Proof** — [`test/resolve.test.ts`](test/resolve.test.ts), describe *"DNS rebinding
defence (IP pinning)"*, test *"pins the first validated IP and never re-resolves to the
attacker's second answer"*: an injected resolver returns the reachable safe test-server
address on the **first** lookup and a private `10.0.0.1` on the **second**. The test
asserts the outcome is `resolved`, the resolver was called exactly **once** (no TOCTOU
re-resolution), the safe server received exactly one request (had we re-resolved we'd
have connected to the unreachable, blocked `10.0.0.1`), and the `Host` header equals the
original hostname — proving the pin held.

## Timeouts, limits & defaults

| Setting                          | Default    | Env var                        |
| -------------------------------- | ---------- | ------------------------------ |
| Max redirects after scanned URL  | `5`        | (constant, not env)            |
| Per-hop timeout                  | `2000 ms`  | `HOP_TIMEOUT_MS`               |
| Overall deadline                 | `10000 ms` | `TOTAL_TIMEOUT_MS`             |
| Max response body read per hop   | `64 KB`    | (constant)                     |
| Max request body accepted        | `8 KB`     | (constant)                     |
| Max URL length                   | `8 KB`     | (constant)                     |
| meta-refresh max delay treated as redirect | `5 s` | `META_REFRESH_MAX_DELAY_SECONDS` |
| Rate limit window                | `10000 ms` | `RATE_LIMIT_WINDOW_MS`         |
| Rate limit max requests / window | `20`       | `RATE_LIMIT_MAX`               |
| TLS certificate validation       | on (forced on in prod) | `TLS_REJECT_UNAUTHORIZED` |
| Trust `X-Forwarded-For`          | off        | `TRUST_PROXY`                  |
| CORS allowed origins             | web app + localhost | `CORS_ALLOWED_ORIGINS` |
| Bind host / port                 | `0.0.0.0` / `8080` | `HOST` / `PORT`        |

### Production is hardened by construction (`NODE_ENV=production`)

The dev bypasses below are **not merely defaulted off — they are refused** when
`NODE_ENV === "production"`. A comment is not a control: an attacker-facing URL fetcher
must not be one stray environment variable away from switching off its own SSRF guard or
certificate validation (e.g. someone pasting a local `.env` into Container Apps, or
relaxing TLS while debugging at 2am). In production, regardless of what the environment
says ([`src/config.ts`](src/config.ts)):

- `DEV_ALLOW_LOOPBACK` is ignored — loopback stays blocked.
- `DEV_EXTRA_ALLOWED_PORTS` is ignored — only 80/443 are permitted.
- `TLS_REJECT_UNAUTHORIZED=false` is ignored — certificate validation stays **on** (so
  no hop can be MITM'd).

Each refusal is logged **loudly at `error` level** (`dev_bypass_refused_in_production`)
because it means the deployment config is dangerous and should be fixed immediately. The
service then keeps serving, hardened — it degrades closed on the security control rather
than crash-looping (a crash-loop during an incident invites an operator to weaken the
guard to restore service, which is worse). `NODE_ENV=production` is baked into the
[`Dockerfile`](Dockerfile), so the shipped image is safe by default even if the platform
config is wrong. The enforcement is covered by [`test/config.test.ts`](test/config.test.ts)
and the "production safety is enforced" suite in
[`test/server.test.ts`](test/server.test.ts).

### Dev-only loopback toggle (non-production only)

Production blocks loopback, so to exercise the **running** service against a local test
server there is a documented, default-**off**, loopback-only escape hatch that only takes
effect when `NODE_ENV !== "production"`:

- `DEV_ALLOW_LOOPBACK=1` — additionally permit `127.0.0.1` / `::1` targets (and **only**
  those — private, link-local and metadata ranges stay blocked).
- `DEV_EXTRA_ALLOWED_PORTS=<port>,<port>` — permit extra destination ports (e.g. an
  ephemeral local server).

When honoured (dev only) the service logs a prominent `dev_allow_loopback_enabled`
warning at startup. See the end-to-end demo below.

## Why plain `node:http` (no framework)

This is a security-sensitive SSRF endpoint behind a **scale-to-zero** Container App.
Cold start and supply-chain surface matter more than framework ergonomics, so the
service has **zero runtime dependencies** — it uses only Node built-ins. Routing, CORS,
body caps and rate limiting are small and explicit in [`src/server.ts`](src/server.ts).
The consequence for packaging is large: the final image needs only the compiled `dist/`
and the Node runtime — no `node_modules`, no npm, no build tools.

## Develop

```powershell
npm ci
npm run typecheck   # tsc --noEmit
npm run lint        # oxlint --deny-warnings
npm test            # vitest, fully hermetic (spins up loopback servers; never hits the internet)
npm run build       # tsc -> dist/
```

All tests run against local HTTP servers started inside the test, so CI is offline-safe.

### End-to-end demo

```powershell
npm run build
node scripts/demo.mjs
```

`scripts/demo.mjs` starts a local origin with a `302 -> meta-refresh -> 200` chain,
boots the built resolver with the dev loopback toggle, calls `/healthz`, then POSTs
`/v1/resolve` and prints the JSON. Example output:

```json
{
  "chain": [
    { "url": "http://127.0.0.1:PORT/start",  "status": 302, "via": "http_status" },
    { "url": "http://127.0.0.1:PORT/second", "status": 200, "via": "html_meta_refresh" },
    { "url": "http://127.0.0.1:PORT/final",  "status": 200 }
  ],
  "outcome": "resolved",
  "elapsedMs": 32,
  "resolver": "qravn-resolver/1.0.0",
  "finalUrl": "http://127.0.0.1:PORT/final"
}
```

## Container

Multi-stage [`Dockerfile`](Dockerfile):

- **build** stage on `node:22-alpine` runs `npm ci` + `tsc`.
- **runtime** stage on `gcr.io/distroless/nodejs22-debian12:nonroot` — non-root (uid
  65532), no shell, no npm, no build toolchain, only `dist/` + the Node runtime.
- `EXPOSE 8080`, and a `HEALTHCHECK` that runs the compiled
  [`dist/healthcheck.js`](src/healthcheck.ts) (a loopback `GET /healthz`).

```powershell
docker build -t qravn-resolver:local services/resolver
docker run --rm -p 8080:8080 qravn-resolver:local
```

## Deliberate omissions

- **Rate limiting is per-instance and in-memory.** Under multiple replicas each replica
  has its own window. Acceptable behind scale-to-zero single-instance ingress; a shared
  store (e.g. Redis) would be needed for a strict global limit.
- **No response caching / dedup** of identical URLs.
- **No allow-list of destination hosts** — by design the product resolves arbitrary
  public URLs; safety comes from the IP/scheme/port guards, not a host allowlist.
- **IPv6 support is validate-and-pin like IPv4**, but a host that resolves to a mix of
  allowed and blocked addresses is blocked wholesale (fail-closed) rather than
  connecting only to the allowed subset.
- **Production refuses dev bypasses by degrading, not crashing.** When `NODE_ENV=production`
  and a dangerous setting is requested, the service logs at `error` and keeps serving
  hardened rather than failing startup — chosen deliberately so a misconfiguration cannot
  turn into a crash-loop that pressures an operator into weakening the guard. The security
  control fails closed; availability fails open.
