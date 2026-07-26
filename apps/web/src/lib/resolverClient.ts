import type { RedirectHop, RedirectOutcome, RedirectResolution } from '../contracts/assessment';

/**
 * Client for the isolated redirect resolver service.
 *
 * The product invariant is that the user's device never contacts a scanned
 * destination. Online mode does not relax that: the scanned URL is sent to OUR
 * OWN resolver origin, that service does the fetching, and only the resulting
 * chain comes back. This client therefore only ever talks to the configured
 * resolver base URL — never to the scanned host.
 *
 * Every documented resolver status is handled here and a resolver failure never
 * throws into the render path: transport and error statuses degrade to a
 * `RedirectResolution` with a failure `outcome`, which the core turns into a
 * limitation ("could not follow the link"), never a clean result.
 */

/**
 * Hard client-side timeout. The resolver's own ceiling is 10s; this sits just
 * above it so the resolver's own graceful response (e.g. a 504 carrying
 * `outcome: "timeout"`) usually wins the race, while still guaranteeing the UI
 * never hangs waiting on the network.
 */
export const RESOLVER_TIMEOUT_MS = 12_000;

/** Every `outcome` the contract allows, used to validate an untrusted body. */
const RESOLUTION_OUTCOMES: readonly RedirectOutcome[] = [
  'resolved',
  'max_hops',
  'timeout',
  'network_error',
  'blocked',
  'loop',
];

export interface ResolveOptions {
  /** Override the configured base URL. Defaults to {@link resolverBaseUrl}. */
  baseUrl?: string;
  /** Override the hard timeout. Defaults to {@link RESOLVER_TIMEOUT_MS}. */
  timeoutMs?: number;
  /** Inject a fetch implementation (tests). Defaults to `globalThis.fetch`. */
  fetchImpl?: typeof fetch;
  /** Caller cancellation, merged with the internal timeout. */
  signal?: AbortSignal;
}

/** Thrown only when online mode is not configured at all. */
export class ResolverUnavailableError extends Error {
  constructor() {
    super('Online link expansion is not configured (VITE_RESOLVER_URL is unset).');
    this.name = 'ResolverUnavailableError';
  }
}

/**
 * The configured resolver base URL, normalized to drop any trailing slash, or
 * `undefined` when unset or not an http(s) URL. When this is `undefined` online
 * mode is cleanly unavailable: the UI must not offer expansion.
 */
export function resolverBaseUrl(): string | undefined {
  const raw = import.meta.env.VITE_RESOLVER_URL;
  if (typeof raw !== 'string') return undefined;
  const trimmed = raw.trim();
  if (!trimmed) return undefined;
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return undefined;
  } catch {
    return undefined;
  }
  return trimmed.replace(/\/+$/, '');
}

/** Whether the user may be offered online expansion. */
export function isOnlineModeAvailable(): boolean {
  return resolverBaseUrl() !== undefined;
}

function synthesizeFailure(url: string, outcome: RedirectOutcome): RedirectResolution {
  // A single-hop chain (the scanned URL only) with a failure outcome. The core
  // reads this and emits a limitation; it never reads as a clean destination.
  return { chain: [{ url }], outcome, resolver: 'qrrrgh-web-client-fallback' };
}

/** Validate an untrusted body actually matches the RedirectResolution shape. */
function isRedirectResolution(value: unknown): value is RedirectResolution {
  if (!value || typeof value !== 'object') return false;
  const record = value as Record<string, unknown>;
  if (!Array.isArray(record.chain)) return false;
  const hopsOk = record.chain.every(
    (hop) => Boolean(hop) && typeof hop === 'object' && typeof (hop as RedirectHop).url === 'string',
  );
  if (!hopsOk) return false;
  return (
    typeof record.outcome === 'string' &&
    RESOLUTION_OUTCOMES.includes(record.outcome as RedirectOutcome)
  );
}

async function readJson(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

/**
 * Ask the isolated resolver to expand `url`. Always resolves to a
 * `RedirectResolution` (the resolver's, or a synthesized failure) so the caller
 * can feed it straight to the core. Throws only {@link ResolverUnavailableError}
 * when no resolver is configured — callers gate on {@link isOnlineModeAvailable}
 * before calling, so that is a programming error, not a runtime failure path.
 */
export async function resolveRedirect(url: string, options: ResolveOptions = {}): Promise<RedirectResolution> {
  const base = options.baseUrl ?? resolverBaseUrl();
  if (!base) throw new ResolverUnavailableError();

  const fetchImpl = options.fetchImpl ?? globalThis.fetch;
  const timeoutMs = options.timeoutMs ?? RESOLVER_TIMEOUT_MS;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const onExternalAbort = () => controller.abort();
  if (options.signal) {
    if (options.signal.aborted) controller.abort();
    else options.signal.addEventListener('abort', onExternalAbort, { once: true });
  }

  let response: Response;
  try {
    response = await fetchImpl(`${base}/v1/resolve`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', accept: 'application/json' },
      body: JSON.stringify({ url }),
      signal: controller.signal,
      // Never attach ambient cookies/credentials, never send a referrer, never
      // reuse a cached expansion: each expansion is a fresh, unauthenticated call
      // to our own resolver.
      credentials: 'omit',
      mode: 'cors',
      cache: 'no-store',
      referrerPolicy: 'no-referrer',
      redirect: 'follow',
    });
  } catch (error) {
    // AbortError is our hard timeout (or a caller cancellation); everything else
    // is a transport failure. Both degrade to a failure resolution.
    const aborted = error instanceof DOMException && error.name === 'AbortError';
    return synthesizeFailure(url, aborted ? 'timeout' : 'network_error');
  } finally {
    clearTimeout(timer);
    options.signal?.removeEventListener('abort', onExternalAbort);
  }

  const { status } = response;
  // 200 (resolved), 422 (policy-blocked), and 504 (timeout) all carry a
  // RedirectResolution body that can go straight to the core.
  if (status === 200 || status === 422 || status === 504) {
    const parsed = await readJson(response);
    if (isRedirectResolution(parsed)) return parsed;
    // A documented status with an unusable body is hostile/inconsistent: degrade
    // to a failure matching the status rather than trust a malformed result.
    const fallback: RedirectOutcome =
      status === 504 ? 'timeout' : status === 422 ? 'blocked' : 'network_error';
    return synthesizeFailure(url, fallback);
  }

  // 400 malformed, 413 too large, 429 rate limited, or any unexpected status:
  // no usable resolution. Degrade to a network_error limitation. There is no
  // dedicated "rate limited" outcome in the contract, so 429 maps here too.
  return synthesizeFailure(url, 'network_error');
}
