/**
 * Build-time generation of the deployed Static Web Apps config.
 *
 * qrrrgh's central promise is that the user's device only ever talks to our own
 * origins, so the shipped Content-Security-Policy pins `connect-src` to `'self'`.
 * Explicit online mode calls our ISOLATED resolver service, whose origin is a
 * build-time variable (`VITE_RESOLVER_URL`) and is not even known yet. This
 * script runs after `vite build` and, when that variable is set, adds THAT ONE
 * ORIGIN (scheme + host [+ port], never a path) to `connect-src` in the emitted
 * `dist/staticwebapp.config.json`.
 *
 * It never widens the policy to `*` or to a bare scheme like `https:`, never
 * touches any other directive, and — when no resolver is configured — leaves
 * `connect-src 'self'` exactly as authored (online mode is simply unavailable).
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const CONNECT_SRC = "connect-src 'self'";

/**
 * The origin (scheme + host [+ port], no path/query/hash) of a resolver URL, or
 * `undefined` for an unset/blank value, a non-http(s) scheme, or junk. This is
 * what limits the CSP to exactly one extra origin.
 *
 * @param {string | undefined | null} url
 * @returns {string | undefined}
 */
export function resolverOrigin(url) {
  if (typeof url !== 'string') return undefined;
  const trimmed = url.trim();
  if (!trimmed) return undefined;
  let parsed;
  try {
    parsed = new URL(trimmed);
  } catch {
    return undefined;
  }
  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return undefined;
  // URL.origin already drops any path, query, and fragment.
  return parsed.origin;
}

/**
 * Add `origin` to the `connect-src` directive of `csp`. Returns `csp` unchanged
 * when `origin` is falsy, when the directive is absent, or when the origin is
 * already present (idempotent). Only `connect-src 'self'` is touched; every
 * other byte of the policy is preserved.
 *
 * @param {string} csp
 * @param {string | undefined} origin
 * @returns {string}
 */
export function injectConnectSrc(csp, origin) {
  if (!origin) return csp;
  if (typeof csp !== 'string' || !csp.includes(CONNECT_SRC)) return csp;
  const withOrigin = `${CONNECT_SRC} ${origin}`;
  if (csp.includes(withOrigin)) return csp;
  return csp.replace(CONNECT_SRC, withOrigin);
}

/**
 * Convenience: derive the origin from a resolver URL and inject it into `csp`.
 *
 * @param {string} csp
 * @param {string | undefined | null} resolverUrl
 * @returns {string}
 */
export function cspForResolver(csp, resolverUrl) {
  return injectConnectSrc(csp, resolverOrigin(resolverUrl));
}

function main() {
  const here = dirname(fileURLToPath(import.meta.url));
  const source = resolve(here, '..', 'public', 'staticwebapp.config.json');
  const target = resolve(here, '..', 'dist', 'staticwebapp.config.json');
  const resolverUrl = process.env.VITE_RESOLVER_URL;
  const origin = resolverOrigin(resolverUrl);

  if (!existsSync(target)) {
    console.warn(`[inject-resolver-csp] ${target} not found; run \`vite build\` first. Skipping.`);
    return;
  }
  if (!origin) {
    console.log("[inject-resolver-csp] VITE_RESOLVER_URL unset or invalid; connect-src stays 'self'.");
    return;
  }

  // Generate the deployed config from the canonical source so the result is
  // deterministic: a single connect-src edit, everything else byte-identical.
  const original = readFileSync(source, 'utf8');
  const updated = injectConnectSrc(original, origin);
  if (updated === original) {
    console.warn(`[inject-resolver-csp] "${CONNECT_SRC}" not found in source; nothing changed.`);
    return;
  }
  writeFileSync(target, updated);
  console.log(`[inject-resolver-csp] connect-src now also allows ${origin}.`);
}

// Only perform file I/O when run directly (e.g. from the build), not on import.
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main();
}
