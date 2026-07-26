import { describe, expect, it } from "vitest";

import type { RedirectResolution } from "../src/contract.js";
import { resolveChain } from "../src/resolve.js";
import { loopbackAllowingGuard, sendText, startServer } from "./helpers/localServer.js";

const OUTCOMES = new Set([
  "resolved",
  "max_hops",
  "timeout",
  "network_error",
  "blocked",
  "loop",
]);
const MECHANISMS = new Set(["http_status", "html_meta_refresh", "unknown"]);

/**
 * Runtime assertion that a value matches the RedirectResolution shape in
 * contracts/v1/assessment.d.ts. The Rust core parses exactly this shape, so any
 * drift here is a contract break.
 */
function assertRedirectResolution(value: unknown): asserts value is RedirectResolution {
  expect(typeof value).toBe("object");
  const v = value as Record<string, unknown>;

  expect(Array.isArray(v.chain)).toBe(true);
  const chain = v.chain as unknown[];
  expect(chain.length).toBeGreaterThanOrEqual(1);
  for (const hopUnknown of chain) {
    const hop = hopUnknown as Record<string, unknown>;
    expect(typeof hop.url).toBe("string");
    if (hop.status !== undefined) expect(typeof hop.status).toBe("number");
    if (hop.via !== undefined) expect(MECHANISMS.has(hop.via as string)).toBe(true);
    // Only the three contract keys may appear on a hop.
    for (const key of Object.keys(hop)) expect(["url", "status", "via"]).toContain(key);
  }

  expect(OUTCOMES.has(v.outcome as string)).toBe(true);
  if (v.elapsedMs !== undefined) expect(typeof v.elapsedMs).toBe("number");
  if (v.resolver !== undefined) expect(typeof v.resolver).toBe("string");

  // finalUrl is present only when the outcome is "resolved".
  if (v.outcome === "resolved") {
    expect(typeof v.finalUrl).toBe("string");
  } else {
    expect(v.finalUrl).toBeUndefined();
  }

  // hopCount == chain.length - 1 is the invariant the core relies on.
  const hopCount = chain.length - 1;
  expect(hopCount).toBeGreaterThanOrEqual(0);

  for (const key of Object.keys(v)) {
    expect(["chain", "finalUrl", "outcome", "elapsedMs", "resolver"]).toContain(key);
  }
}

describe("contract: RedirectResolution shape", () => {
  it("a resolved result validates against the contract", async () => {
    const s = await startServer((req, res) => {
      if ((req.url ?? "/") === "/start") {
        res.writeHead(302, { Location: "/end" });
        res.end();
      } else {
        sendText(res, 200, "final");
      }
    });
    try {
      const r = await resolveChain(`${s.origin}/start`, {
        isBlocked: loopbackAllowingGuard,
        allowedPorts: new Set([s.port]),
      });
      assertRedirectResolution(r);
      expect(r.outcome).toBe("resolved");
      expect(r.chain).toHaveLength(2);
      expect(r.finalUrl).toBe(`${s.origin}/end`);
      expect(r.resolver).toBe("qrrrgh-resolver/1.0.0");
    } finally {
      await s.close();
    }
  });

  it("a blocked result validates and omits finalUrl", async () => {
    const r = await resolveChain("http://169.254.169.254/");
    assertRedirectResolution(r);
    expect(r.outcome).toBe("blocked");
    expect(r.finalUrl).toBeUndefined();
  });
});
