/**
 * Shared constants for the QRavn redirect resolver.
 *
 * MAX_REDIRECTS is the load-bearing hop budget from the product requirement:
 *   "Track until 5 consecutive redirects. If there is more - stop and resolve
 *    link as untrusted, citing the reason about too many redirects."
 *
 * The Rust safety core defines the SAME budget as its single source of truth:
 *   `safety_core::MAX_REDIRECT_HOPS = 5` (core/crates/safety-core/src/redirect.rs).
 * The two MUST stay identical and agree on the boundary EXACTLY:
 *   - following five redirects is fine and yields `resolved` (a six-entry chain:
 *     hop 0 + 5 redirect targets, the last returning a non-redirect);
 *   - needing a sixth redirect stops with `max_hops` and a six-entry chain
 *     (the sixth target is never fetched).
 * If either constant changes, change both.
 */
export const MAX_REDIRECTS = 5;

/** Name+version string stamped onto every RedirectResolution for provenance. */
export const RESOLVER_NAME = "qravn-resolver";
export const RESOLVER_VERSION = "1.0.0";
export const RESOLVER_ID = `${RESOLVER_NAME}/${RESOLVER_VERSION}`;

/**
 * Neutral, honest User-Agent so destination site owners can attribute the
 * traffic. It carries no cookies, referer, or credentials of any kind.
 */
export const USER_AGENT = `${RESOLVER_ID} (+https://github.com/webmaxru/qravn; QR redirect expander; stores no page content)`;

/** Only these schemes may ever be requested. */
export const ALLOWED_SCHEMES: ReadonlySet<string> = new Set(["http:", "https:"]);

/** Only these TCP ports may ever be requested. */
export const ALLOWED_PORTS: ReadonlySet<number> = new Set([80, 443]);

/** Read at most this many response bytes; enough to spot a meta refresh. */
export const MAX_BODY_BYTES = 64 * 1024;

/** Reject request bodies larger than this (this is a tiny JSON envelope). */
export const MAX_REQUEST_BODY_BYTES = 8 * 1024;

/** Reject absurdly long scanned/redirect URLs outright. */
export const MAX_URL_LENGTH = 8 * 1024;

/** A `<meta http-equiv="refresh">` only counts as a redirect at short delays. */
export const META_REFRESH_MAX_DELAY_SECONDS = 5;
