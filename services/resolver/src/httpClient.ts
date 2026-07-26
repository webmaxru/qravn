/**
 * Single-hop HTTP(S) fetch with the SSRF connection guarantees.
 *
 * DNS-rebinding defence: the caller has already resolved the hostname and
 * validated every returned IP. We connect using a custom `lookup` that ignores
 * the hostname and returns ONLY that pre-validated, pinned IP. Node therefore
 * never performs a second resolution, so an attacker cannot return a public IP
 * to our check and a private IP to the real connection. The original hostname is
 * still used for the Host header and TLS SNI, so virtual hosting and certificate
 * validation stay correct.
 *
 * Other guarantees: no cookies / referer / auth headers, identity encoding,
 * per-hop timeout, hard overall deadline via AbortSignal, response body capped
 * at MAX_BODY_BYTES and only read when the content type is HTML, connections are
 * never pooled or reused (`agent: false`).
 */

import http from "node:http";
import https from "node:https";
import type { LookupFunction } from "node:net";

import { MAX_BODY_BYTES, USER_AGENT } from "./constants.js";
import { parseMetaRefresh, type MetaRefresh } from "./metaRefresh.js";

export type HopErrorKind = "timeout" | "network";

export class HopError extends Error {
  readonly kind: HopErrorKind;
  constructor(kind: HopErrorKind, message: string) {
    super(message);
    this.name = "HopError";
    this.kind = kind;
  }
}

export interface HopRequestOptions {
  url: string;
  hostname: string;
  hostHeader: string;
  port: number;
  pinnedAddress: string;
  pinnedFamily: 4 | 6;
  signal: AbortSignal;
  timeoutMs: number;
  rejectUnauthorized: boolean;
}

export interface HopResponse {
  status: number;
  /** Raw Location header when the status is a 3xx redirect. */
  location: string | null;
  /** Parsed meta refresh directive when an HTML body was read. */
  metaRefresh: MetaRefresh | null;
}

const NETWORK_ERROR_CODES = new Set([
  "ECONNREFUSED",
  "ECONNRESET",
  "EHOSTUNREACH",
  "ENETUNREACH",
  "ENOTFOUND",
  "EAI_AGAIN",
  "EPIPE",
  "ECONNABORTED",
  "EPROTO",
]);

function classifyError(err: unknown): HopError {
  if (err instanceof HopError) return err;
  const code = (err as NodeJS.ErrnoException)?.code;
  const name = (err as Error)?.name;
  if (code === "ETIMEDOUT" || name === "AbortError" || code === "ABORT_ERR") {
    return new HopError("timeout", `request aborted: ${code ?? name}`);
  }
  if (code && (NETWORK_ERROR_CODES.has(code) || code.startsWith("ERR_TLS") || code.startsWith("CERT_") || code.startsWith("UNABLE_TO_") || code.startsWith("DEPTH_"))) {
    return new HopError("network", `network error: ${code}`);
  }
  return new HopError("network", `network error: ${code ?? name ?? "unknown"}`);
}

function isHtml(contentType: string | undefined): boolean {
  if (!contentType) return false;
  return contentType.toLowerCase().split(";", 1)[0]!.trim() === "text/html";
}

export function requestHop(options: HopRequestOptions): Promise<HopResponse> {
  const target = new URL(options.url);
  const isHttps = target.protocol === "https:";
  const requestFn = isHttps ? https.request : http.request;

  // Pin the connection to the pre-validated IP. `all` is honoured because some
  // Node internals request every address.
  const pinnedLookup: LookupFunction = ((hostname, opts, cb) => {
    if (typeof opts === "function") {
      (opts as (err: null, addr: string, fam: number) => void)(
        null,
        options.pinnedAddress,
        options.pinnedFamily,
      );
      return;
    }
    if (opts && opts.all) {
      (cb as unknown as (err: null, addrs: Array<{ address: string; family: number }>) => void)(
        null,
        [{ address: options.pinnedAddress, family: options.pinnedFamily }],
      );
      return;
    }
    cb(null, options.pinnedAddress, options.pinnedFamily);
  }) as LookupFunction;

  const requestOptions: https.RequestOptions = {
    method: "GET",
    hostname: options.hostname,
    port: options.port,
    path: `${target.pathname}${target.search}`,
    headers: {
      host: options.hostHeader,
      "user-agent": USER_AGENT,
      accept: "text/html,application/xhtml+xml,*/*;q=0.8",
      "accept-encoding": "identity",
    },
    lookup: pinnedLookup,
    family: options.pinnedFamily,
    agent: false,
    signal: options.signal,
    timeout: options.timeoutMs,
  };
  if (isHttps) {
    requestOptions.servername = options.hostname;
    requestOptions.rejectUnauthorized = options.rejectUnauthorized;
  }

  return new Promise<HopResponse>((resolve, reject) => {
    let settled = false;
    const done = (fn: () => void): void => {
      if (settled) return;
      settled = true;
      fn();
    };

    const req = requestFn(requestOptions, (res) => {
      const status = res.statusCode ?? 0;
      const location = typeof res.headers.location === "string" ? res.headers.location : null;

      // 3xx: we only need the Location header; discard any body.
      if (status >= 300 && status < 400) {
        res.destroy();
        done(() => resolve({ status, location, metaRefresh: null }));
        return;
      }

      // Non-HTML: this is the final destination; discard the body unread.
      if (!isHtml(res.headers["content-type"])) {
        res.destroy();
        done(() => resolve({ status, location: null, metaRefresh: null }));
        return;
      }

      // HTML: read at most MAX_BODY_BYTES to look for a meta refresh, then stop.
      const chunks: Buffer[] = [];
      let received = 0;
      res.on("data", (chunk: Buffer) => {
        received += chunk.length;
        chunks.push(received > MAX_BODY_BYTES ? chunk.subarray(0, chunk.length - (received - MAX_BODY_BYTES)) : chunk);
        if (received >= MAX_BODY_BYTES) res.destroy();
      });
      const finish = (): void => {
        const html = Buffer.concat(chunks).toString("utf8");
        done(() => resolve({ status, location: null, metaRefresh: parseMetaRefresh(html) }));
      };
      res.on("end", finish);
      res.on("close", finish);
      res.on("error", (err) => done(() => reject(classifyError(err))));
    });

    req.on("timeout", () => {
      req.destroy(new HopError("timeout", "per-hop timeout"));
    });
    req.on("error", (err) => done(() => reject(classifyError(err))));
    req.end();
  });
}
