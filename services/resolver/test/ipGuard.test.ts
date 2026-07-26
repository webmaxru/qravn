import { describe, expect, it } from "vitest";

import { classifyIp, isBlockedIp, parseIpv4, parseIpv6 } from "../src/ipGuard.js";

describe("ipGuard: blocked IPv4 ranges", () => {
  const blocked: Array<[string, string]> = [
    ["127.0.0.1", "loopback"],
    ["127.255.255.254", "loopback"],
    ["10.0.0.1", "private"],
    ["10.255.255.255", "private"],
    ["172.16.0.1", "private"],
    ["172.31.255.255", "private"],
    ["192.168.0.1", "private"],
    ["192.168.1.1", "private"],
    ["169.254.0.1", "link-local"],
    ["169.254.169.254", "link-local"], // cloud metadata endpoint
    ["100.64.0.1", "cgnat"],
    ["100.127.255.255", "cgnat"],
    ["0.0.0.0", "unspecified"],
    ["0.1.2.3", "unspecified"],
    ["224.0.0.1", "multicast"],
    ["239.255.255.255", "multicast"],
    ["240.0.0.1", "reserved"],
    ["255.255.255.255", "broadcast"],
    ["192.0.2.1", "documentation"],
    ["198.51.100.7", "documentation"],
    ["203.0.113.9", "documentation"],
    ["198.18.0.1", "benchmarking"],
    ["192.0.0.1", "reserved"],
    ["192.88.99.1", "reserved"],
  ];
  for (const [ip, cls] of blocked) {
    it(`blocks ${ip} (${cls})`, () => {
      expect(classifyIp(ip)).toBe(cls);
      expect(isBlockedIp(ip)).toBe(true);
    });
  }
});

describe("ipGuard: allowed public IPv4", () => {
  const allowed = ["8.8.8.8", "1.1.1.1", "93.184.216.34", "151.101.0.1", "203.0.114.1"];
  for (const ip of allowed) {
    it(`allows ${ip}`, () => {
      expect(classifyIp(ip)).toBe("public");
      expect(isBlockedIp(ip)).toBe(false);
    });
  }
});

describe("ipGuard: IPv4 literals normalised by URL parser cannot bypass", () => {
  it("octal/hex/dword forms resolve to 127.0.0.1 via WHATWG URL", () => {
    // These are the forms the URL parser canonicalises; prove the canonical
    // result is still blocked.
    for (const raw of ["0177.0.0.1", "0x7f.0.0.1", "2130706433", "0x7f000001"]) {
      const host = new URL(`http://${raw}/`).hostname;
      expect(host).toBe("127.0.0.1");
      expect(isBlockedIp(host)).toBe(true);
    }
  });
});

describe("ipGuard: blocked IPv6 ranges", () => {
  const blocked: Array<[string, string]> = [
    ["::1", "loopback"],
    ["::", "unspecified"],
    ["fe80::1", "reserved"], // link-local, outside global unicast
    ["fc00::1", "reserved"], // unique-local
    ["fd12:3456::1", "reserved"], // unique-local
    ["ff02::1", "reserved"], // multicast
    ["2001:db8::1", "documentation"],
    ["2001::1", "teredo"],
    ["2002::1", "6to4"],
    ["64:ff9b::1", "reserved"], // NAT64
    ["100::1", "reserved"], // discard-only
    ["3fff::1", "documentation"],
  ];
  for (const [ip, cls] of blocked) {
    it(`blocks ${ip} (${cls})`, () => {
      expect(classifyIp(ip)).toBe(cls);
      expect(isBlockedIp(ip)).toBe(true);
    });
  }
});

describe("ipGuard: IPv4-mapped / IPv4-compatible IPv6 must not slip through", () => {
  const forms = [
    "::ffff:127.0.0.1",
    "::ffff:169.254.169.254",
    "::ffff:10.0.0.1",
    "::ffff:192.168.1.1",
    "::ffff:7f00:1", // hex form of ::ffff:127.0.0.1
    "::127.0.0.1", // deprecated IPv4-compatible
  ];
  for (const ip of forms) {
    it(`blocks ${ip}`, () => {
      expect(isBlockedIp(ip)).toBe(true);
    });
  }

  it("blocks even IPv4-mapped public addresses (never legitimate from DNS)", () => {
    expect(isBlockedIp("::ffff:8.8.8.8")).toBe(true);
    expect(classifyIp("::ffff:8.8.8.8")).toBe("ipv4-mapped");
  });
});

describe("ipGuard: allowed public IPv6", () => {
  const allowed = ["2606:4700:4700::1111", "2001:4860:4860::8888", "2620:fe::fe"];
  for (const ip of allowed) {
    it(`allows ${ip}`, () => {
      expect(classifyIp(ip)).toBe("public");
      expect(isBlockedIp(ip)).toBe(false);
    });
  }
});

describe("ipGuard: zone ids and invalid input", () => {
  it("strips the zone id before classifying link-local", () => {
    expect(isBlockedIp("fe80::1%eth0")).toBe(true);
  });
  it("treats junk as invalid (and therefore blocked)", () => {
    expect(classifyIp("not-an-ip")).toBe("invalid");
    expect(isBlockedIp("not-an-ip")).toBe(true);
    expect(classifyIp("999.1.1.1")).toBe("invalid");
  });
});

describe("ipGuard: low-level parsers", () => {
  it("parseIpv4 accepts canonical dotted-decimal only", () => {
    expect(parseIpv4("1.2.3.4")).toBe(((1 << 24) | (2 << 16) | (3 << 8) | 4) >>> 0);
    expect(parseIpv4("256.0.0.1")).toBeNull();
    expect(parseIpv4("1.2.3")).toBeNull();
    expect(parseIpv4("1.2.3.4.5")).toBeNull();
  });
  it("parseIpv6 expands :: and embedded IPv4", () => {
    expect(parseIpv6("::1")).toBe(1n);
    expect(parseIpv6("::")).toBe(0n);
    expect(parseIpv6("::ffff:127.0.0.1")).toBe((0xffffn << 32n) | 0x7f000001n);
    expect(parseIpv6("bad::gg")).toBeNull();
  });
});
