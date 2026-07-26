/**
 * The redirect-chain state machine.
 *
 * Walks a scanned URL's redirect chain by hand (never auto-following) so the hop
 * budget, loop detection, and per-hop re-validation are all under our control.
 * Every hop is re-validated in full - scheme, port, credentials, DNS, and IP
 * range - because a redirect target is a brand-new attacker-chosen URL.
 *
 * Produces a RedirectResolution that matches contracts/v1/assessment.d.ts.
 */

import net from "node:net";

import {
  ALLOWED_PORTS,
  MAX_REDIRECTS,
  META_REFRESH_MAX_DELAY_SECONDS,
  RESOLVER_ID,
} from "./constants.js";
import type {
  RedirectHop,
  RedirectMechanism,
  RedirectOutcome,
  RedirectResolution,
} from "./contract.js";
import { defaultResolver, type HostResolver } from "./dns.js";
import { requestHop, HopError, type HopRequestOptions, type HopResponse } from "./httpClient.js";
import { isBlockedIp } from "./ipGuard.js";
import { resolveNextUrl, validateUrlPolicy, type UrlPolicyAccept } from "./urlPolicy.js";

/** Thrown for URLs that cannot be parsed at all; the server maps this to 400. */
export class MalformedUrlError extends Error {
  constructor(reason: string) {
    super(reason);
    this.name = "MalformedUrlError";
  }
}

/** Internal control-flow signal for a policy-blocked host. */
class BlockedError extends Error {
  constructor(reason: string) {
    super(reason);
    this.name = "BlockedError";
  }
}

export interface ResolveOptions {
  /** Injectable DNS resolver (default: getaddrinfo). */
  resolver?: HostResolver;
  /** Injectable IP guard (default: strict SSRF guard). Tests may relax it. */
  isBlocked?: (ip: string) => boolean;
  /** Injectable hop fetcher (default: real pinned HTTP client). */
  fetchHop?: (options: HopRequestOptions) => Promise<HopResponse>;
  /** Injectable port allowlist (default: strict {80, 443}). */
  allowedPorts?: ReadonlySet<number>;
  maxRedirects?: number;
  hopTimeoutMs?: number;
  totalTimeoutMs?: number;
  metaRefreshMaxDelaySeconds?: number;
  rejectUnauthorized?: boolean;
  now?: () => number;
}

interface Pinned {
  address: string;
  family: 4 | 6;
}

function canonicalKey(urlString: string): string {
  const u = new URL(urlString);
  u.hash = "";
  return u.href;
}

function withTimeout<T>(promise: Promise<T>, ms: number, onTimeout: () => Error): Promise<T> {
  if (ms <= 0) return Promise.reject(onTimeout());
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(onTimeout()), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (err) => {
        clearTimeout(timer);
        reject(err);
      },
    );
  });
}

async function validateHost(
  accepted: UrlPolicyAccept,
  isBlocked: (ip: string) => boolean,
  resolver: HostResolver,
  budgetMs: number,
): Promise<Pinned> {
  if (accepted.isIpLiteral) {
    if (isBlocked(accepted.hostname)) {
      throw new BlockedError(`ip ${accepted.hostname} blocked`);
    }
    const family = net.isIP(accepted.hostname) === 6 ? 6 : 4;
    return { address: accepted.hostname, family };
  }

  let addresses;
  try {
    addresses = await withTimeout(
      resolver(accepted.hostname),
      budgetMs,
      () => new HopError("timeout", "dns timeout"),
    );
  } catch (err) {
    if (err instanceof HopError) throw err;
    throw new HopError("network", "dns resolution failed");
  }

  if (!addresses || addresses.length === 0) {
    throw new HopError("network", "no addresses");
  }

  // Validate EVERY resolved address; block the whole URL if any is disallowed
  // so an attacker cannot mix a public and a private record.
  for (const addr of addresses) {
    if (isBlocked(addr.address)) {
      throw new BlockedError(`resolved ip ${addr.address} blocked`);
    }
  }
  return { address: addresses[0]!.address, family: addresses[0]!.family };
}

function outcomeForError(err: unknown): RedirectOutcome {
  if (err instanceof BlockedError) return "blocked";
  if (err instanceof HopError) return err.kind === "timeout" ? "timeout" : "network_error";
  return "network_error";
}

function decideNext(hopUrl: string, resp: HopResponse, metaRefreshMaxDelay: number):
  | { url: string; via: RedirectMechanism }
  | null {
  if (resp.status >= 300 && resp.status < 400 && resp.location) {
    const abs = resolveNextUrl(resp.location, hopUrl);
    return abs ? { url: abs, via: "http_status" } : null;
  }
  const meta = resp.metaRefresh;
  if (meta && meta.url && meta.delaySeconds <= metaRefreshMaxDelay) {
    const abs = resolveNextUrl(meta.url, hopUrl);
    return abs ? { url: abs, via: "html_meta_refresh" } : null;
  }
  return null;
}

/**
 * Expand the redirect chain for a scanned URL.
 * @throws {MalformedUrlError} when the scanned URL cannot be parsed (HTTP 400).
 */
export async function resolveChain(
  rawUrl: string,
  options: ResolveOptions = {},
): Promise<RedirectResolution> {
  const resolver = options.resolver ?? defaultResolver;
  const isBlocked = options.isBlocked ?? isBlockedIp;
  const fetchHop = options.fetchHop ?? requestHop;
  const allowedPorts = options.allowedPorts ?? ALLOWED_PORTS;
  const maxRedirects = options.maxRedirects ?? MAX_REDIRECTS;
  const hopTimeoutMs = options.hopTimeoutMs ?? 2_000;
  const totalTimeoutMs = options.totalTimeoutMs ?? 10_000;
  const metaRefreshMaxDelay = options.metaRefreshMaxDelaySeconds ?? META_REFRESH_MAX_DELAY_SECONDS;
  const rejectUnauthorized = options.rejectUnauthorized ?? true;
  const now = options.now ?? Date.now;

  const start = now();
  const chain: RedirectHop[] = [];
  const visited = new Set<string>();

  const first = validateUrlPolicy(rawUrl, { allowedPorts });
  if (!first.ok) {
    if (first.kind === "malformed") throw new MalformedUrlError(first.reason);
    // Structurally blocked scanned URL: still return hop 0 with outcome blocked.
    chain.push({ url: rawUrl });
    return {
      chain,
      outcome: "blocked",
      elapsedMs: now() - start,
      resolver: RESOLVER_ID,
    };
  }

  let current: UrlPolicyAccept = first;
  chain.push({ url: current.url.href });
  visited.add(canonicalKey(current.url.href));

  const controller = new AbortController();
  const deadline = start + totalTimeoutMs;
  const deadlineTimer = setTimeout(() => controller.abort(), Math.max(0, deadline - now()));

  let outcome: RedirectOutcome = "resolved";
  let finalUrl: string | undefined;

  try {
    for (;;) {
      const hop = chain[chain.length - 1]!;
      const remaining = deadline - now();
      if (remaining <= 0) {
        outcome = "timeout";
        break;
      }

      let pinned: Pinned;
      try {
        pinned = await validateHost(current, isBlocked, resolver, remaining);
      } catch (err) {
        outcome = outcomeForError(err);
        break;
      }

      const hopBudget = Math.max(1, Math.min(hopTimeoutMs, deadline - now()));
      let resp: HopResponse;
      try {
        resp = await fetchHop({
          url: hop.url,
          hostname: current.hostname,
          hostHeader: current.hostHeader,
          port: current.port,
          pinnedAddress: pinned.address,
          pinnedFamily: pinned.family,
          signal: controller.signal,
          timeoutMs: hopBudget,
          rejectUnauthorized,
        });
      } catch (err) {
        outcome = outcomeForError(err);
        break;
      }

      hop.status = resp.status;

      const next = decideNext(hop.url, resp, metaRefreshMaxDelay);
      if (!next) {
        outcome = "resolved";
        finalUrl = hop.url;
        break;
      }

      // A further redirect is requested. Enforce the hop budget first.
      if (chain.length - 1 >= maxRedirects) {
        hop.via = next.via;
        outcome = "max_hops";
        break;
      }

      // Loop detection: a repeat of any URL already seen.
      if (visited.has(canonicalKey(next.url))) {
        hop.via = next.via;
        outcome = "loop";
        break;
      }

      // Re-validate the brand-new target in full before following it.
      const nextValidated = validateUrlPolicy(next.url, { allowedPorts });
      if (!nextValidated.ok) {
        hop.via = next.via;
        outcome = nextValidated.kind === "blocked" ? "blocked" : "network_error";
        break;
      }

      hop.via = next.via;
      chain.push({ url: nextValidated.url.href });
      visited.add(canonicalKey(nextValidated.url.href));
      current = nextValidated;
    }
  } finally {
    clearTimeout(deadlineTimer);
  }

  const resolution: RedirectResolution = {
    chain,
    outcome,
    elapsedMs: now() - start,
    resolver: RESOLVER_ID,
  };
  if (outcome === "resolved" && finalUrl !== undefined) {
    resolution.finalUrl = finalUrl;
  }
  return resolution;
}
