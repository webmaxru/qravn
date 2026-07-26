/**
 * Structural URL policy: everything that can be decided from the URL text alone,
 * before any DNS resolution. Applied identically to the scanned URL and to every
 * redirect target (each hop is a brand-new attacker-chosen URL).
 *
 * The WHATWG URL parser normalises IPv4 literals (octal/hex/dword) to
 * dotted-decimal and lowercases/puny-encodes hosts, which we rely on.
 */

import net from "node:net";
import { ALLOWED_PORTS, ALLOWED_SCHEMES, MAX_URL_LENGTH } from "./constants.js";

export type UrlPolicyReject =
  | { ok: false; kind: "malformed"; reason: string }
  | { ok: false; kind: "blocked"; reason: string };

export interface UrlPolicyAccept {
  ok: true;
  url: URL;
  /** Bracket-stripped host, suitable for DNS resolution and IP classification. */
  hostname: string;
  /** Value for the outgoing Host header, e.g. "example.com" or "[2606::1]". */
  hostHeader: string;
  /** Effective port actually connected to (default derived from scheme). */
  port: number;
  isIpLiteral: boolean;
}

export type UrlPolicyResult = UrlPolicyAccept | UrlPolicyReject;

/** Remove the surrounding brackets from an IPv6 authority host. */
export function stripBrackets(host: string): string {
  if (host.length >= 2 && host.startsWith("[") && host.endsWith("]")) {
    return host.slice(1, -1);
  }
  return host;
}

function defaultPortForScheme(scheme: string): number {
  return scheme === "https:" ? 443 : 80;
}

/**
 * Parse and structurally validate a URL string.
 * `malformed` maps to HTTP 400; `blocked` maps to a "blocked" RedirectResolution
 * (HTTP 422). A parseable-but-disallowed URL is `blocked`, never `malformed`.
 *
 * `allowedPorts` is injectable so integration tests can reach loopback servers
 * on ephemeral ports; production always uses the strict {80, 443} default.
 */
export function validateUrlPolicy(
  raw: string,
  opts: { allowedPorts?: ReadonlySet<number> } = {},
): UrlPolicyResult {
  const allowedPorts = opts.allowedPorts ?? ALLOWED_PORTS;
  if (typeof raw !== "string" || raw.length === 0) {
    return { ok: false, kind: "malformed", reason: "empty url" };
  }
  if (raw.length > MAX_URL_LENGTH) {
    return { ok: false, kind: "malformed", reason: "url too long" };
  }

  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return { ok: false, kind: "malformed", reason: "unparseable url" };
  }

  if (!ALLOWED_SCHEMES.has(url.protocol)) {
    return { ok: false, kind: "blocked", reason: `scheme ${url.protocol} not allowed` };
  }

  if (url.username !== "" || url.password !== "") {
    return { ok: false, kind: "blocked", reason: "embedded credentials not allowed" };
  }

  const hostHeader = url.host; // host + optional port, brackets preserved for IPv6
  const hostname = stripBrackets(url.hostname);
  if (hostname === "") {
    return { ok: false, kind: "blocked", reason: "empty host" };
  }

  const port = url.port === "" ? defaultPortForScheme(url.protocol) : Number(url.port);
  if (!allowedPorts.has(port)) {
    return { ok: false, kind: "blocked", reason: `port ${port} not allowed` };
  }

  const ipKind = net.isIP(hostname);
  return {
    ok: true,
    url,
    hostname,
    hostHeader,
    port,
    isIpLiteral: ipKind !== 0,
  };
}

/**
 * Resolve a (possibly relative) Location/meta-refresh target against the URL of
 * the current hop. Returns an absolute URL string, or null when unparseable.
 */
export function resolveNextUrl(location: string, baseUrl: string): string | null {
  try {
    return new URL(location, baseUrl).href;
  } catch {
    return null;
  }
}
