/**
 * Test helpers: spin up loopback HTTP servers so the suite is hermetic and never
 * touches the real internet. Also provides a relaxed IP guard that permits ONLY
 * loopback (so the local server is reachable) while still blocking every other
 * range, plus an injectable port allowlist for the ephemeral ports these servers
 * bind to.
 */

import http from "node:http";
import type { AddressInfo } from "node:net";

import { isBlockedIp } from "../../src/ipGuard.js";

export interface RecordedRequest {
  method: string;
  url: string;
}

export interface TestServer {
  port: number;
  host: string;
  origin: string;
  requests: RecordedRequest[];
  server: http.Server;
  close: () => Promise<void>;
}

export async function startServer(handler: http.RequestListener): Promise<TestServer> {
  const requests: RecordedRequest[] = [];
  const server = http.createServer((req, res) => {
    requests.push({ method: req.method ?? "GET", url: req.url ?? "/" });
    handler(req, res);
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address() as AddressInfo;
  const port = address.port;
  return {
    port,
    host: "127.0.0.1",
    origin: `http://127.0.0.1:${port}`,
    requests,
    server,
    close: () => new Promise<void>((resolve) => server.close(() => resolve())),
  };
}

/** Bind then immediately release a port so a connect attempt is refused. */
export async function reserveClosedPort(): Promise<number> {
  const s = await startServer(() => {});
  const port = s.port;
  await s.close();
  return port;
}

/**
 * IP guard for integration tests: allow loopback so the local server is
 * reachable, but defer to the real strict guard for everything else (so
 * metadata / private ranges stay blocked even in tests).
 */
export function loopbackAllowingGuard(ip: string): boolean {
  if (ip === "127.0.0.1" || ip === "::1") return false;
  return isBlockedIp(ip);
}

/** Convenience 200 text/plain responder. */
export function sendText(res: http.ServerResponse, status: number, body: string): void {
  res.writeHead(status, { "content-type": "text/plain; charset=utf-8" });
  res.end(body);
}

/** Convenience 200 text/html responder. */
export function sendHtml(res: http.ServerResponse, body: string): void {
  res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
  res.end(body);
}
