import { afterEach, describe, expect, it } from "vitest";
import type { AddressInfo } from "node:net";

import { loadConfig } from "../src/config.js";
import type { RedirectResolution } from "../src/contract.js";
import type { ResolveOptions } from "../src/resolve.js";
import { createServer, statusForOutcome, type ResolveFn } from "../src/server.js";
import { sendText, startServer, type TestServer } from "./helpers/localServer.js";

interface App {
  origin: string;
  close: () => Promise<void>;
}

const apps: App[] = [];
const origins: TestServer[] = [];

afterEach(async () => {
  await Promise.all(apps.map((a) => a.close()));
  await Promise.all(origins.map((s) => s.close()));
  apps.length = 0;
  origins.length = 0;
});

async function origin(handler: Parameters<typeof startServer>[0]): Promise<TestServer> {
  const s = await startServer(handler);
  origins.push(s);
  return s;
}

async function startApp(
  options: { env?: NodeJS.ProcessEnv; resolveFn?: ResolveFn } = {},
): Promise<App> {
  const config = loadConfig(options.env ?? {});
  const server = createServer({ config, resolveFn: options.resolveFn });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const port = (server.address() as AddressInfo).port;
  const app: App = {
    origin: `http://127.0.0.1:${port}`,
    close: () => new Promise<void>((resolve) => server.close(() => resolve())),
  };
  apps.push(app);
  return app;
}

function post(app: App, body: string, headers: Record<string, string> = {}): Promise<Response> {
  return fetch(`${app.origin}/v1/resolve`, {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body,
  });
}

const resolvedStub = (outcome: RedirectResolution["outcome"]): ResolveFn => {
  return async () => ({
    chain: [{ url: "http://example.com/" }],
    outcome,
    ...(outcome === "resolved" ? { finalUrl: "http://example.com/" } : {}),
    elapsedMs: 1,
    resolver: "qrrrgh-resolver/1.0.0",
  });
};

describe("server: healthz", () => {
  it("returns 200 {ok:true} and never touches the resolver", async () => {
    const app = await startApp({
      resolveFn: async () => {
        throw new Error("healthz must not resolve");
      },
    });
    const res = await fetch(`${app.origin}/healthz`);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
  });
});

describe("server: request validation", () => {
  it("400 on invalid JSON", async () => {
    const app = await startApp({ resolveFn: resolvedStub("resolved") });
    const res = await post(app, "{not json");
    expect(res.status).toBe(400);
  });

  it("400 on missing url", async () => {
    const app = await startApp({ resolveFn: resolvedStub("resolved") });
    const res = await post(app, JSON.stringify({ foo: "bar" }));
    expect(res.status).toBe(400);
  });

  it("400 on unparseable url (real resolver)", async () => {
    const app = await startApp();
    const res = await post(app, JSON.stringify({ url: "http://" }));
    expect(res.status).toBe(400);
  });

  it("413 when the request body exceeds the cap", async () => {
    const app = await startApp({ resolveFn: resolvedStub("resolved") });
    const huge = JSON.stringify({ url: "http://example.com/" + "a".repeat(9000) });
    const res = await post(app, huge);
    expect(res.status).toBe(413);
  });
});

describe("server: outcome to HTTP status mapping", () => {
  it("maps blocked -> 422 with a RedirectResolution body (real resolver)", async () => {
    const app = await startApp();
    const res = await post(app, JSON.stringify({ url: "http://127.0.0.1/" }));
    expect(res.status).toBe(422);
    const body = (await res.json()) as RedirectResolution;
    expect(body.outcome).toBe("blocked");
    expect(Array.isArray(body.chain)).toBe(true);
    expect(body.chain.length).toBeGreaterThanOrEqual(1);
  });

  it("maps file:// scheme -> 422 blocked", async () => {
    const app = await startApp();
    const res = await post(app, JSON.stringify({ url: "file:///etc/passwd" }));
    expect(res.status).toBe(422);
  });

  it("maps timeout -> 504", async () => {
    const app = await startApp({ resolveFn: resolvedStub("timeout") });
    const res = await post(app, JSON.stringify({ url: "http://example.com/" }));
    expect(res.status).toBe(504);
  });

  it("maps resolved / max_hops / loop / network_error -> 200", async () => {
    for (const outcome of ["resolved", "max_hops", "loop", "network_error"] as const) {
      const app = await startApp({ resolveFn: resolvedStub(outcome) });
      const res = await post(app, JSON.stringify({ url: "http://example.com/" }));
      expect(res.status).toBe(200);
    }
  });

  it("statusForOutcome helper is correct", () => {
    expect(statusForOutcome("blocked")).toBe(422);
    expect(statusForOutcome("timeout")).toBe(504);
    expect(statusForOutcome("resolved")).toBe(200);
    expect(statusForOutcome("max_hops")).toBe(200);
    expect(statusForOutcome("loop")).toBe(200);
    expect(statusForOutcome("network_error")).toBe(200);
  });
});

describe("server: rate limiting", () => {
  it("429s the second request when the limit is 1", async () => {
    const app = await startApp({
      env: { RATE_LIMIT_MAX: "1", RATE_LIMIT_WINDOW_MS: "10000" },
      resolveFn: resolvedStub("resolved"),
    });
    const first = await post(app, JSON.stringify({ url: "http://example.com/" }));
    expect(first.status).toBe(200);
    const second = await post(app, JSON.stringify({ url: "http://example.com/" }));
    expect(second.status).toBe(429);
    expect(second.headers.get("retry-after")).toBeTruthy();
  });
});

describe("server: CORS", () => {
  it("echoes an allowed Origin on preflight", async () => {
    const app = await startApp({ resolveFn: resolvedStub("resolved") });
    const res = await fetch(`${app.origin}/v1/resolve`, {
      method: "OPTIONS",
      headers: { Origin: "http://localhost:5173", "Access-Control-Request-Method": "POST" },
    });
    expect(res.status).toBe(204);
    expect(res.headers.get("access-control-allow-origin")).toBe("http://localhost:5173");
  });

  it("allows the production web origin", async () => {
    const app = await startApp({ resolveFn: resolvedStub("resolved") });
    const res = await fetch(`${app.origin}/v1/resolve`, {
      method: "OPTIONS",
      headers: {
        Origin: "https://brave-bay-0ecf82e03.7.azurestaticapps.net",
        "Access-Control-Request-Method": "POST",
      },
    });
    expect(res.headers.get("access-control-allow-origin")).toBe(
      "https://brave-bay-0ecf82e03.7.azurestaticapps.net",
    );
  });

  it("does NOT echo a disallowed Origin", async () => {
    const app = await startApp({ resolveFn: resolvedStub("resolved") });
    const res = await fetch(`${app.origin}/v1/resolve`, {
      method: "OPTIONS",
      headers: { Origin: "https://evil.example", "Access-Control-Request-Method": "POST" },
    });
    expect(res.headers.get("access-control-allow-origin")).toBeNull();
  });

  it("sets CORS header on a real POST from an allowed origin", async () => {
    const app = await startApp({ resolveFn: resolvedStub("resolved") });
    const res = await post(app, JSON.stringify({ url: "http://example.com/" }), {
      Origin: "http://localhost:5173",
    });
    expect(res.headers.get("access-control-allow-origin")).toBe("http://localhost:5173");
  });
});

describe("server: routing", () => {
  it("405 for GET /v1/resolve", async () => {
    const app = await startApp({ resolveFn: resolvedStub("resolved") });
    const res = await fetch(`${app.origin}/v1/resolve`);
    expect(res.status).toBe(405);
  });

  it("404 for unknown paths", async () => {
    const app = await startApp({ resolveFn: resolvedStub("resolved") });
    const res = await fetch(`${app.origin}/nope`);
    expect(res.status).toBe(404);
  });
});

describe("server: production safety is enforced (not merely documented)", () => {
  // Capture the ResolveOptions the server builds from config, so we can prove the
  // wiring directly without needing a real TLS server for the TLS assertion.
  function capturing(): { fn: ResolveFn; last: () => ResolveOptions | undefined } {
    let captured: ResolveOptions | undefined;
    const fn: ResolveFn = async (_url, options) => {
      captured = options;
      return {
        chain: [{ url: "http://example.com/" }],
        outcome: "resolved",
        finalUrl: "http://example.com/",
        elapsedMs: 1,
        resolver: "qrrrgh-resolver/1.0.0",
      };
    };
    return { fn, last: () => captured };
  }

  it("under NODE_ENV=production it passes hardened options and NO dev bypass", async () => {
    const cap = capturing();
    const app = await startApp({
      env: {
        NODE_ENV: "production",
        DEV_ALLOW_LOOPBACK: "true",
        DEV_EXTRA_ALLOWED_PORTS: "1234",
        TLS_REJECT_UNAUTHORIZED: "false",
      },
      resolveFn: cap.fn,
    });
    const res = await post(app, JSON.stringify({ url: "http://example.com/" }));
    expect(res.status).toBe(200);
    const options = cap.last();
    // TLS verification cannot be turned off in production.
    expect(options?.rejectUnauthorized).toBe(true);
    // No relaxed guard / no extra ports are injected: the strict defaults inside
    // resolveChain (isBlockedIp, {80,443}) are used because these are left unset.
    expect(options?.isBlocked).toBeUndefined();
    expect(options?.allowedPorts).toBeUndefined();
  });

  it("outside production it DOES wire the dev bypass through (control)", async () => {
    const cap = capturing();
    const app = await startApp({
      env: {
        DEV_ALLOW_LOOPBACK: "true",
        DEV_EXTRA_ALLOWED_PORTS: "1234",
        TLS_REJECT_UNAUTHORIZED: "false",
      },
      resolveFn: cap.fn,
    });
    await post(app, JSON.stringify({ url: "http://example.com/" }));
    const options = cap.last();
    expect(options?.rejectUnauthorized).toBe(false);
    expect(typeof options?.isBlocked).toBe("function");
    expect(options?.allowedPorts?.has(1234)).toBe(true);
    expect(options?.allowedPorts?.has(80)).toBe(true);
    expect(options?.allowedPorts?.has(443)).toBe(true);
  });

  it("blocks a real loopback target in production despite DEV_ALLOW_LOOPBACK=true", async () => {
    const s = await origin((_req, res) => sendText(res, 200, "must never be reached"));
    const app = await startApp({
      env: {
        NODE_ENV: "production",
        DEV_ALLOW_LOOPBACK: "true",
        DEV_EXTRA_ALLOWED_PORTS: String(s.port),
      },
      // no resolveFn -> the real resolveChain runs
    });
    const res = await post(app, JSON.stringify({ url: `${s.origin}/` }));
    expect(res.status).toBe(422);
    const body = (await res.json()) as RedirectResolution;
    expect(body.outcome).toBe("blocked");
    // The user's device/network never contacted the destination.
    expect(s.requests).toHaveLength(0);
  });

  it("resolves the same real loopback target outside production (control)", async () => {
    const s = await origin((_req, res) => sendText(res, 200, "ok final"));
    const app = await startApp({
      env: {
        DEV_ALLOW_LOOPBACK: "true",
        DEV_EXTRA_ALLOWED_PORTS: String(s.port),
      },
    });
    const res = await post(app, JSON.stringify({ url: `${s.origin}/` }));
    expect(res.status).toBe(200);
    const body = (await res.json()) as RedirectResolution;
    expect(body.outcome).toBe("resolved");
    expect(s.requests.length).toBeGreaterThanOrEqual(1);
  });
});
