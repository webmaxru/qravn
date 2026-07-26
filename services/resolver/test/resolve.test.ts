import { afterEach, describe, expect, it } from "vitest";

import { resolveChain, type ResolveOptions } from "../src/resolve.js";
import {
  loopbackAllowingGuard,
  reserveClosedPort,
  sendHtml,
  sendText,
  startServer,
  type TestServer,
} from "./helpers/localServer.js";

const servers: TestServer[] = [];

afterEach(async () => {
  await Promise.all(servers.map((s) => s.close()));
  servers.length = 0;
});

async function server(handler: Parameters<typeof startServer>[0]): Promise<TestServer> {
  const s = await startServer(handler);
  servers.push(s);
  return s;
}

function opts(port: number, extra: Partial<ResolveOptions> = {}): ResolveOptions {
  return {
    isBlocked: loopbackAllowingGuard,
    allowedPorts: new Set([port]),
    hopTimeoutMs: 1_000,
    totalTimeoutMs: 5_000,
    ...extra,
  };
}

function path(url: string | undefined): string {
  return (url ?? "/").split("?")[0] ?? "/";
}

describe("resolveChain: hop budget", () => {
  it("follows exactly 5 redirects and resolves with a 6-entry chain", async () => {
    const s = await server((req, res) => {
      const m = /^\/r\/(\d+)$/.exec(path(req.url));
      if (!m) return sendText(res, 404, "nf");
      const n = Number(m[1]);
      if (n < 5) {
        res.writeHead(302, { Location: `/r/${n + 1}` });
        res.end();
      } else {
        sendText(res, 200, "final");
      }
    });

    const r = await resolveChain(`${s.origin}/r/0`, opts(s.port));
    expect(r.outcome).toBe("resolved");
    expect(r.chain).toHaveLength(6);
    expect(r.chain[0]?.via).toBe("http_status");
    expect(r.chain[0]?.status).toBe(302);
    expect(r.chain[5]?.status).toBe(200);
    expect(r.chain[5]?.via).toBeUndefined();
    expect(r.finalUrl).toBe(`${s.origin}/r/5`);
    expect(r.resolver).toBe("qrrrgh-resolver/1.0.0");
  });

  it("stops at a 6th redirect with outcome max_hops and a 6-entry chain", async () => {
    const s = await server((req, res) => {
      const m = /^\/r\/(\d+)$/.exec(path(req.url));
      if (!m) return sendText(res, 404, "nf");
      const n = Number(m[1]);
      if (n < 6) {
        res.writeHead(302, { Location: `/r/${n + 1}` });
        res.end();
      } else {
        sendText(res, 200, "final");
      }
    });

    const r = await resolveChain(`${s.origin}/r/0`, opts(s.port));
    expect(r.outcome).toBe("max_hops");
    expect(r.chain).toHaveLength(6);
    expect(r.finalUrl).toBeUndefined();
    expect(r.chain[5]?.status).toBe(302);
    expect(r.chain[5]?.via).toBe("http_status");
  });
});

describe("resolveChain: loops", () => {
  it("detects a two-URL cycle", async () => {
    const s = await server((req, res) => {
      const p = path(req.url);
      if (p === "/a") res.writeHead(302, { Location: "/b" });
      else if (p === "/b") res.writeHead(302, { Location: "/a" });
      else res.writeHead(404);
      res.end();
    });

    const r = await resolveChain(`${s.origin}/a`, opts(s.port));
    expect(r.outcome).toBe("loop");
    expect(r.chain).toHaveLength(2);
    expect(r.chain[1]?.via).toBe("http_status");
    expect(r.finalUrl).toBeUndefined();
  });
});

describe("resolveChain: network failures", () => {
  it("returns timeout when the server never responds", async () => {
    const s = await server(() => {
      /* hang: never write a response */
    });
    const r = await resolveChain(`${s.origin}/hang`, opts(s.port, {
      hopTimeoutMs: 150,
      totalTimeoutMs: 800,
    }));
    expect(r.outcome).toBe("timeout");
  });

  it("returns network_error when the connection is refused", async () => {
    const port = await reserveClosedPort();
    const r = await resolveChain(`http://127.0.0.1:${port}/`, {
      isBlocked: loopbackAllowingGuard,
      allowedPorts: new Set([port]),
      hopTimeoutMs: 1_000,
      totalTimeoutMs: 3_000,
    });
    expect(r.outcome).toBe("network_error");
  });
});

describe("resolveChain: Location handling", () => {
  it("resolves a relative Location against the current hop", async () => {
    const s = await server((req, res) => {
      const p = path(req.url);
      if (p === "/start") {
        res.writeHead(302, { Location: "/dest" });
        res.end();
      } else {
        sendText(res, 200, "final");
      }
    });

    const r = await resolveChain(`${s.origin}/start`, opts(s.port));
    expect(r.outcome).toBe("resolved");
    expect(r.chain[1]?.url).toBe(`${s.origin}/dest`);
    expect(r.finalUrl).toBe(`${s.origin}/dest`);
  });

  it("stops (resolved) when a 3xx has no Location header", async () => {
    const s = await server((req, res) => {
      res.writeHead(302);
      res.end();
    });
    const r = await resolveChain(`${s.origin}/noloc`, opts(s.port));
    expect(r.outcome).toBe("resolved");
    expect(r.chain).toHaveLength(1);
    expect(r.chain[0]?.status).toBe(302);
    expect(r.finalUrl).toBe(`${s.origin}/noloc`);
  });
});

describe("resolveChain: meta refresh", () => {
  it("follows a short-delay meta refresh via html_meta_refresh", async () => {
    const s = await server((req, res) => {
      const p = path(req.url);
      if (p === "/meta") {
        sendHtml(res, '<html><head><meta http-equiv="refresh" content="0; url=/dest"></head></html>');
      } else {
        sendText(res, 200, "final");
      }
    });

    const r = await resolveChain(`${s.origin}/meta`, opts(s.port));
    expect(r.outcome).toBe("resolved");
    expect(r.chain[0]?.via).toBe("html_meta_refresh");
    expect(r.chain[1]?.url).toBe(`${s.origin}/dest`);
  });

  it("ignores a long-delay meta refresh", async () => {
    const s = await server((req, res) => {
      sendHtml(res, '<meta http-equiv="refresh" content="30; url=/dest">');
    });
    const r = await resolveChain(`${s.origin}/slow`, opts(s.port));
    expect(r.outcome).toBe("resolved");
    expect(r.chain).toHaveLength(1);
  });

  it("truncates an oversized body and still completes (meta beyond 64KB unseen)", async () => {
    const s = await server((req, res) => {
      const padding = "<!-- " + "x".repeat(200 * 1024) + " -->";
      sendHtml(res, padding + '<meta http-equiv="refresh" content="0; url=/dest">');
    });
    const r = await resolveChain(`${s.origin}/big`, opts(s.port));
    expect(r.outcome).toBe("resolved");
    expect(r.chain).toHaveLength(1); // the meta refresh past the cap was never read
  });
});

describe("resolveChain: SSRF policy at every hop", () => {
  it("blocks the cloud metadata endpoint (169.254.169.254) with the default strict guard", async () => {
    const r = await resolveChain("http://169.254.169.254/latest/meta-data/");
    expect(r.outcome).toBe("blocked");
    expect(r.chain).toHaveLength(1);
    expect(r.finalUrl).toBeUndefined();
  });

  it("blocks a hostname that resolves to a private IP", async () => {
    const resolver = async () => [{ address: "10.0.0.5", family: 4 as const }];
    const r = await resolveChain("http://sneaky.test/", { resolver, allowedPorts: new Set([80]) });
    expect(r.outcome).toBe("blocked");
  });

  it("blocks when ANY resolved address is private (mixed A records)", async () => {
    const resolver = async () => [
      { address: "8.8.8.8", family: 4 as const },
      { address: "127.0.0.1", family: 4 as const },
    ];
    const r = await resolveChain("http://mixed.test/", { resolver, allowedPorts: new Set([80]) });
    expect(r.outcome).toBe("blocked");
  });

  it("re-validates a redirect target and blocks a hop that points at metadata", async () => {
    const s = await server((req, res) => {
      const p = path(req.url);
      if (p === "/open") {
        res.writeHead(302, { Location: "http://169.254.169.254/latest/" });
        res.end();
      } else {
        sendText(res, 200, "x");
      }
    });
    const r = await resolveChain(`${s.origin}/open`, opts(s.port, {
      allowedPorts: new Set([s.port, 80]),
    }));
    expect(r.outcome).toBe("blocked");
    expect(r.chain).toHaveLength(2);
    expect(r.chain[0]?.via).toBe("http_status");
    expect(r.chain[0]?.status).toBe(302);
  });

  it("blocks disallowed schemes and ports on the scanned URL", async () => {
    expect((await resolveChain("file:///etc/passwd")).outcome).toBe("blocked");
    expect((await resolveChain("gopher://example.com/")).outcome).toBe("blocked");
    expect((await resolveChain("http://example.com:22/")).outcome).toBe("blocked");
    expect((await resolveChain("https://user:pass@example.com/")).outcome).toBe("blocked");
  });

  it("throws MalformedUrlError for an unparseable scanned URL", async () => {
    await expect(resolveChain("http://")).rejects.toThrow();
  });
});

describe("resolveChain: DNS rebinding defence (IP pinning)", () => {
  it("pins the first validated IP and never re-resolves to the attacker's second answer", async () => {
    let receivedHost: string | undefined;
    const s = await server((req, res) => {
      receivedHost = req.headers.host;
      sendText(res, 200, "final");
    });

    let calls = 0;
    // Classic rebinding: safe/public answer first (our check), hostile private
    // answer on any subsequent lookup (the real connection, if we re-resolved).
    const resolver = async (host: string) => {
      calls += 1;
      expect(host).toBe("pin.test");
      return calls === 1
        ? [{ address: "127.0.0.1", family: 4 as const }]
        : [{ address: "10.0.0.1", family: 4 as const }];
    };

    const r = await resolveChain(`http://pin.test:${s.port}/final`, {
      isBlocked: loopbackAllowingGuard,
      allowedPorts: new Set([s.port]),
      resolver,
      hopTimeoutMs: 1_000,
      totalTimeoutMs: 3_000,
    });

    // Resolved => the connection reached the pinned safe IP (our server).
    expect(r.outcome).toBe("resolved");
    expect(r.finalUrl).toBe(`http://pin.test:${s.port}/final`);
    // Our layer resolved exactly once; no TOCTOU re-resolution happened.
    expect(calls).toBe(1);
    // The safe server actually received the request (had we re-resolved we would
    // have connected to the unreachable, blocked 10.0.0.1 instead).
    expect(s.requests).toHaveLength(1);
    // Host header preserved for correct virtual hosting / SNI.
    expect(receivedHost).toBe(`pin.test:${s.port}`);
  });

  it("blocks when the pinned lookup's only answer is private", async () => {
    const resolver = async () => [{ address: "169.254.169.254", family: 4 as const }];
    const r = await resolveChain("http://rebind.test/", {
      resolver,
      allowedPorts: new Set([80]),
    });
    expect(r.outcome).toBe("blocked");
  });
});
