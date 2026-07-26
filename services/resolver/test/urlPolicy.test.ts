import { describe, expect, it } from "vitest";

import { resolveNextUrl, validateUrlPolicy } from "../src/urlPolicy.js";

describe("urlPolicy: scheme allowlist", () => {
  for (const scheme of ["file", "gopher", "ftp", "data", "blob", "javascript", "ws", "mailto"]) {
    it(`blocks ${scheme}:`, () => {
      const raw =
        scheme === "data"
          ? "data:text/html,<h1>x</h1>"
          : scheme === "javascript"
            ? "javascript:alert(1)"
            : scheme === "mailto"
              ? "mailto:a@b.com"
              : `${scheme}://example.com/`;
      const r = validateUrlPolicy(raw);
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.kind).toBe("blocked");
    });
  }

  for (const raw of ["http://example.com/", "https://example.com/"]) {
    it(`allows ${raw}`, () => {
      expect(validateUrlPolicy(raw).ok).toBe(true);
    });
  }
});

describe("urlPolicy: port allowlist", () => {
  it("allows 80 and 443", () => {
    expect(validateUrlPolicy("http://example.com:80/").ok).toBe(true);
    expect(validateUrlPolicy("https://example.com:443/").ok).toBe(true);
    expect(validateUrlPolicy("http://example.com/").ok).toBe(true);
  });
  for (const port of [22, 25, 8080, 3000, 6379, 11211, 0]) {
    it(`blocks port ${port}`, () => {
      const r = validateUrlPolicy(`http://example.com:${port}/`);
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.kind).toBe("blocked");
    });
  }
  it("honours an injected port allowlist for tests", () => {
    const r = validateUrlPolicy("http://example.com:8080/", { allowedPorts: new Set([80, 443, 8080]) });
    expect(r.ok).toBe(true);
  });
});

describe("urlPolicy: embedded credentials", () => {
  for (const raw of [
    "https://user:pass@example.com/",
    "https://user@example.com/",
    "https://trusted.no@evil.example/",
  ]) {
    it(`blocks ${raw}`, () => {
      const r = validateUrlPolicy(raw);
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.kind).toBe("blocked");
    });
  }
});

describe("urlPolicy: malformed vs blocked", () => {
  it("unparseable URL is malformed (-> 400)", () => {
    const r = validateUrlPolicy("http://");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.kind).toBe("malformed");
  });
  it("empty string is malformed", () => {
    const r = validateUrlPolicy("");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.kind).toBe("malformed");
  });
  it("absurdly long URL is malformed", () => {
    const raw = "http://example.com/" + "a".repeat(9000);
    const r = validateUrlPolicy(raw);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.kind).toBe("malformed");
  });
});

describe("urlPolicy: IPv6 literal handling", () => {
  it("strips brackets from the authority host", () => {
    const r = validateUrlPolicy("http://[2606:4700:4700::1111]/");
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.hostname).toBe("2606:4700:4700::1111");
      expect(r.hostHeader).toBe("[2606:4700:4700::1111]");
      expect(r.isIpLiteral).toBe(true);
    }
  });
});

describe("urlPolicy: IDN hosts", () => {
  it("punycodes non-ASCII hosts", () => {
    const r = validateUrlPolicy("https://xn--fsq.example/"); // already punycode
    expect(r.ok).toBe(true);
    const r2 = validateUrlPolicy("https://héllo.example/");
    expect(r2.ok).toBe(true);
    if (r2.ok) expect(r2.hostname).toBe("xn--hllo-bpa.example");
  });
});

describe("urlPolicy: resolveNextUrl", () => {
  it("resolves relative Location against the current hop", () => {
    expect(resolveNextUrl("/b", "http://h.example/a/c")).toBe("http://h.example/b");
    expect(resolveNextUrl("b", "http://h.example/a/c")).toBe("http://h.example/a/b");
    expect(resolveNextUrl("https://other.example/x", "http://h.example/a")).toBe(
      "https://other.example/x",
    );
  });
  it("returns null for an unparseable target", () => {
    expect(resolveNextUrl("http://", "http://h.example/")).toBeNull();
  });
});
