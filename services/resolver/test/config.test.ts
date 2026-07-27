/**
 * These are the most important tests in the suite: they assert the service
 * CANNOT be misconfigured into being dangerous. `NODE_ENV=production` must
 * neutralise every dev bypass and TLS relaxation, no matter what the environment
 * says. A comment is not a control; these tests are the control.
 */

import { describe, expect, it } from "vitest";

import { loadConfig } from "../src/config.js";

describe("config: safe defaults", () => {
  it("an empty environment is already hardened", () => {
    const c = loadConfig({});
    expect(c.devAllowLoopback).toBe(false);
    expect(c.extraAllowedPorts.size).toBe(0);
    expect(c.rejectUnauthorized).toBe(true);
    expect(c.trustProxy).toBe(false);
    expect(c.port).toBe(8080);
    expect(c.host).toBe("0.0.0.0");
  });

  it("keeps production CORS origins configurable by environment", () => {
    const c = loadConfig({
      CORS_ALLOWED_ORIGINS: "https://web.example, https://api-client.example",
    });
    expect([...c.corsAllowedOrigins]).toEqual([
      "https://web.example",
      "https://api-client.example",
    ]);
  });
});

describe("config: dev bypasses take effect ONLY outside production", () => {
  it("honours the bypasses when NODE_ENV is unset", () => {
    const c = loadConfig({
      DEV_ALLOW_LOOPBACK: "true",
      DEV_EXTRA_ALLOWED_PORTS: "1234,5678",
      TLS_REJECT_UNAUTHORIZED: "false",
    });
    expect(c.devAllowLoopback).toBe(true);
    expect([...c.extraAllowedPorts].sort((a, b) => a - b)).toEqual([1234, 5678]);
    expect(c.rejectUnauthorized).toBe(false);
  });

  it("honours the bypasses under NODE_ENV=development", () => {
    const c = loadConfig({
      NODE_ENV: "development",
      DEV_ALLOW_LOOPBACK: "1",
      DEV_EXTRA_ALLOWED_PORTS: "4321",
      TLS_REJECT_UNAUTHORIZED: "false",
    });
    expect(c.devAllowLoopback).toBe(true);
    expect(c.extraAllowedPorts.has(4321)).toBe(true);
    expect(c.rejectUnauthorized).toBe(false);
  });
});

describe("config: production refuses every dev bypass", () => {
  const prod = (extra: NodeJS.ProcessEnv): ReturnType<typeof loadConfig> =>
    loadConfig({ NODE_ENV: "production", ...extra });

  it("ignores DEV_ALLOW_LOOPBACK=true (loopback stays blocked)", () => {
    expect(prod({ DEV_ALLOW_LOOPBACK: "true" }).devAllowLoopback).toBe(false);
  });

  it("ignores DEV_ALLOW_LOOPBACK in every truthy spelling", () => {
    for (const v of ["true", "1", "yes", "on", "TRUE", "On"]) {
      expect(prod({ DEV_ALLOW_LOOPBACK: v }).devAllowLoopback).toBe(false);
    }
  });

  it("ignores DEV_EXTRA_ALLOWED_PORTS (only 80/443 remain)", () => {
    expect(prod({ DEV_EXTRA_ALLOWED_PORTS: "1234,5678" }).extraAllowedPorts.size).toBe(0);
  });

  it("forces rejectUnauthorized=true even when TLS_REJECT_UNAUTHORIZED=false", () => {
    expect(prod({ TLS_REJECT_UNAUTHORIZED: "false" }).rejectUnauthorized).toBe(true);
  });

  it("neutralises all three dangerous settings at once", () => {
    const c = prod({
      DEV_ALLOW_LOOPBACK: "true",
      DEV_EXTRA_ALLOWED_PORTS: "1234",
      TLS_REJECT_UNAUTHORIZED: "false",
    });
    expect(c.devAllowLoopback).toBe(false);
    expect(c.extraAllowedPorts.size).toBe(0);
    expect(c.rejectUnauthorized).toBe(true);
  });

  it("leaves non-security settings (PORT, rate limits) working in production", () => {
    const c = prod({ PORT: "9000", RATE_LIMIT_MAX: "3" });
    expect(c.port).toBe(9000);
    expect(c.rateLimitMax).toBe(3);
  });
});
