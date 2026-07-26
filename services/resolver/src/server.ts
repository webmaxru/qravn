/**
 * HTTP surface for the resolver. Deliberately built on plain `node:http` with
 * zero runtime dependencies: this is a security-sensitive SSRF endpoint behind a
 * scale-to-zero Container App, so a tiny image, fast cold start, and a minimal
 * supply-chain footprint matter more than framework ergonomics. Routing, CORS,
 * body caps, and rate limiting are all small and explicit here.
 *
 * Status mapping:
 *   200  normal RedirectResolution (resolved | max_hops | loop | network_error)
 *   400  malformed request or unparseable URL
 *   422  URL rejected by policy      -> RedirectResolution with outcome "blocked"
 *   429  rate limited
 *   504  overall timeout             -> RedirectResolution with outcome "timeout"
 */

import http from "node:http";

import type { Config } from "./config.js";
import { ALLOWED_PORTS, MAX_REQUEST_BODY_BYTES } from "./constants.js";
import type { RedirectOutcome, RedirectResolution } from "./contract.js";
import { isBlockedIp } from "./ipGuard.js";
import { log, safeHost } from "./logger.js";
import { RateLimiter } from "./rateLimit.js";
import { MalformedUrlError, resolveChain, type ResolveOptions } from "./resolve.js";

export type ResolveFn = (url: string, options: ResolveOptions) => Promise<RedirectResolution>;

export interface ServerDeps {
  config: Config;
  rateLimiter?: RateLimiter;
  resolveFn?: ResolveFn;
  now?: () => number;
}

export function statusForOutcome(outcome: RedirectOutcome): number {
  if (outcome === "blocked") return 422;
  if (outcome === "timeout") return 504;
  return 200;
}

function normalizeIp(ip: string | undefined): string {
  if (!ip) return "unknown";
  return ip.startsWith("::ffff:") ? ip.slice("::ffff:".length) : ip;
}

function clientIp(req: http.IncomingMessage, trustProxy: boolean): string {
  if (trustProxy) {
    const xff = req.headers["x-forwarded-for"];
    const value = Array.isArray(xff) ? xff[0] : xff;
    if (value) {
      const first = value.split(",")[0]?.trim();
      if (first) return normalizeIp(first);
    }
  }
  return normalizeIp(req.socket.remoteAddress ?? undefined);
}

function applyCors(
  req: http.IncomingMessage,
  res: http.ServerResponse,
  allowed: ReadonlySet<string>,
): void {
  const origin = req.headers.origin;
  res.setHeader("Vary", "Origin");
  if (typeof origin === "string" && allowed.has(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
    res.setHeader("Access-Control-Max-Age", "600");
  }
}

function sendJson(
  res: http.ServerResponse,
  status: number,
  body: unknown,
  extraHeaders: Record<string, string> = {},
): void {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "X-Content-Type-Options": "nosniff",
    "Cache-Control": "no-store",
    "Content-Length": Buffer.byteLength(payload),
    ...extraHeaders,
  });
  res.end(payload);
}

type BodyResult =
  | { status: "ok"; body: string }
  | { status: "too_large" }
  | { status: "error" };

function readBody(req: http.IncomingMessage, limit: number): Promise<BodyResult> {
  return new Promise((resolve) => {
    const chunks: Buffer[] = [];
    let size = 0;
    let done = false;
    const settle = (result: BodyResult): void => {
      if (done) return;
      done = true;
      resolve(result);
    };
    req.on("data", (chunk: Buffer) => {
      size += chunk.length;
      if (size > limit) {
        // Stop buffering, but do NOT destroy the socket here: we still need to
        // flush a 413 response. The handler closes the connection afterwards.
        req.pause();
        settle({ status: "too_large" });
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () => settle({ status: "ok", body: Buffer.concat(chunks).toString("utf8") }));
    req.on("error", () => settle({ status: "error" }));
  });
}

function baseResolveOptions(config: Config): ResolveOptions {
  const options: ResolveOptions = {
    hopTimeoutMs: config.hopTimeoutMs,
    totalTimeoutMs: config.totalTimeoutMs,
    metaRefreshMaxDelaySeconds: config.metaRefreshMaxDelaySeconds,
    rejectUnauthorized: config.rejectUnauthorized,
  };
  // DEV/TEST ONLY: permit loopback targets (and any explicitly listed extra
  // ports) so the running service can be exercised against a local server.
  if (config.devAllowLoopback) {
    options.isBlocked = (ip: string): boolean =>
      ip === "127.0.0.1" || ip === "::1" ? false : isBlockedIp(ip);
    options.allowedPorts = new Set<number>([...ALLOWED_PORTS, ...config.extraAllowedPorts]);
  }
  return options;
}

async function handleResolve(
  req: http.IncomingMessage,
  res: http.ServerResponse,
  deps: Required<Pick<ServerDeps, "config" | "rateLimiter" | "resolveFn">>,
): Promise<void> {
  const { config, rateLimiter, resolveFn } = deps;
  const ip = clientIp(req, config.trustProxy);

  const limit = rateLimiter.check(ip);
  if (!limit.allowed) {
    res.setHeader("Retry-After", String(limit.retryAfterSeconds));
    log.warn("rate_limited", { ip });
    sendJson(res, 429, { error: "rate_limited" });
    return;
  }

  const body = await readBody(req, MAX_REQUEST_BODY_BYTES);
  if (body.status === "too_large") {
    sendJson(res, 413, { error: "request_body_too_large" }, { Connection: "close" });
    return;
  }
  if (body.status === "error") {
    sendJson(res, 400, { error: "request_read_error" });
    return;
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(body.body);
  } catch {
    sendJson(res, 400, { error: "invalid_json" });
    return;
  }

  const url = (parsed as { url?: unknown } | null)?.url;
  if (typeof url !== "string" || url === "") {
    sendJson(res, 400, { error: "missing_url" });
    return;
  }

  try {
    const resolution = await resolveFn(url, baseResolveOptions(config));
    const status = statusForOutcome(resolution.outcome);
    log.info("resolve_complete", {
      ip,
      host: safeHost(url),
      outcome: resolution.outcome,
      hops: resolution.chain.length,
      elapsedMs: resolution.elapsedMs,
    });
    sendJson(res, status, resolution);
  } catch (err) {
    if (err instanceof MalformedUrlError) {
      sendJson(res, 400, { error: "unparseable_url" });
      return;
    }
    log.error("resolve_failed", { ip, host: safeHost(url), err: (err as Error).message });
    sendJson(res, 500, { error: "internal_error" });
  }
}

export function createServer(deps: ServerDeps): http.Server {
  const config = deps.config;
  const rateLimiter =
    deps.rateLimiter ?? new RateLimiter(config.rateLimitWindowMs, config.rateLimitMax, deps.now);
  const resolveFn = deps.resolveFn ?? resolveChain;

  return http.createServer((req, res) => {
    const method = req.method ?? "GET";
    const path = (req.url ?? "/").split("?", 1)[0];

    // Health probe: never touches the network, never rate limited.
    if (method === "GET" && path === "/healthz") {
      sendJson(res, 200, { ok: true });
      return;
    }

    if (path === "/v1/resolve") {
      applyCors(req, res, config.corsAllowedOrigins);
      if (method === "OPTIONS") {
        res.writeHead(204);
        res.end();
        return;
      }
      if (method !== "POST") {
        res.setHeader("Allow", "POST, OPTIONS");
        sendJson(res, 405, { error: "method_not_allowed" });
        return;
      }
      void handleResolve(req, res, { config, rateLimiter, resolveFn });
      return;
    }

    sendJson(res, 404, { error: "not_found" });
  });
}
