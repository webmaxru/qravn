/**
 * SSRF IP-range guard.
 *
 * This is the load-bearing security control. It is a PURE function of a single
 * IP literal (no DNS, no network) so it can be exhaustively unit-tested. The
 * resolver resolves DNS itself, then runs every resulting address through
 * `isBlockedIp` BEFORE connecting, and pins the connection to a validated IP.
 *
 * Policy: allow only genuinely public unicast addresses. Everything else -
 * loopback, private, link-local (incl. the 169.254.169.254 cloud metadata
 * endpoint), CGNAT, reserved/benchmarking/documentation ranges, multicast,
 * broadcast, unique-local, and all IPv4-mapped / IPv4-compatible IPv6 - is
 * blocked. IPv4 literals in URLs are already normalised to dotted-decimal by
 * the WHATWG URL parser, which neutralises octal/hex/dword bypass forms.
 */

import net from "node:net";

export type IpClass =
  | "public"
  | "invalid"
  | "unspecified"
  | "loopback"
  | "private"
  | "link-local"
  | "cgnat"
  | "reserved"
  | "benchmarking"
  | "documentation"
  | "multicast"
  | "broadcast"
  | "unique-local"
  | "teredo"
  | "6to4"
  | "ipv4-mapped"
  | "ipv4-compatible";

interface V4Range {
  base: number;
  prefix: number;
  cls: IpClass;
}

function v4ToInt(a: number, b: number, c: number, d: number): number {
  // >>> 0 keeps the value an unsigned 32-bit integer.
  return ((a << 24) | (b << 16) | (c << 8) | d) >>> 0;
}

function cidr4(cidr: string, cls: IpClass): V4Range {
  const [addr, prefixStr] = cidr.split("/");
  const parsed = parseIpv4(addr ?? "");
  if (parsed === null) throw new Error(`bad cidr ${cidr}`);
  return { base: parsed, prefix: Number(prefixStr), cls };
}

// Ordered so the most specific / most descriptive class wins where ranges nest.
const V4_BLOCKS: readonly V4Range[] = [
  cidr4("0.0.0.0/8", "unspecified"),
  cidr4("10.0.0.0/8", "private"),
  cidr4("100.64.0.0/10", "cgnat"),
  cidr4("127.0.0.0/8", "loopback"),
  cidr4("169.254.0.0/16", "link-local"),
  cidr4("172.16.0.0/12", "private"),
  cidr4("192.0.0.0/24", "reserved"),
  cidr4("192.0.2.0/24", "documentation"),
  cidr4("192.88.99.0/24", "reserved"),
  cidr4("192.168.0.0/16", "private"),
  cidr4("198.18.0.0/15", "benchmarking"),
  cidr4("198.51.100.0/24", "documentation"),
  cidr4("203.0.113.0/24", "documentation"),
  cidr4("224.0.0.0/4", "multicast"),
  cidr4("255.255.255.255/32", "broadcast"),
  cidr4("240.0.0.0/4", "reserved"),
];

/** Parse a canonical dotted-decimal IPv4 string to a uint32, or null. */
export function parseIpv4(input: string): number | null {
  const parts = input.split(".");
  if (parts.length !== 4) return null;
  const octets: number[] = [];
  for (const part of parts) {
    if (!/^\d{1,3}$/.test(part)) return null;
    const n = Number(part);
    if (n > 255) return null;
    octets.push(n);
  }
  return v4ToInt(octets[0]!, octets[1]!, octets[2]!, octets[3]!);
}

function inV4Range(ip: number, range: V4Range): boolean {
  if (range.prefix === 0) return true;
  const mask = range.prefix === 32 ? 0xffffffff : (0xffffffff << (32 - range.prefix)) >>> 0;
  return (ip & mask) >>> 0 === (range.base & mask) >>> 0;
}

function classifyIpv4Int(ip: number): IpClass {
  for (const range of V4_BLOCKS) {
    if (inV4Range(ip, range)) return range.cls;
  }
  return "public";
}

/**
 * Parse any textual IPv6 (including `::`, embedded IPv4, and `%zone`) into a
 * 128-bit BigInt, or null when malformed.
 */
export function parseIpv6(input: string): bigint | null {
  let s = input.trim();
  const zone = s.indexOf("%");
  if (zone !== -1) s = s.slice(0, zone);
  if (s.length === 0) return null;

  // Rewrite a trailing embedded IPv4 dotted-quad into two hextets.
  if (s.includes(".")) {
    const idx = s.lastIndexOf(":");
    if (idx === -1) return null;
    const v4 = parseIpv4(s.slice(idx + 1));
    if (v4 === null) return null;
    const hi = ((v4 >>> 16) & 0xffff).toString(16);
    const lo = (v4 & 0xffff).toString(16);
    s = `${s.slice(0, idx + 1)}${hi}:${lo}`;
  }

  const halves = s.split("::");
  if (halves.length > 2) return null;

  const splitGroups = (part: string): string[] => (part === "" ? [] : part.split(":"));
  const head = splitGroups(halves[0] ?? "");
  const hasCompression = halves.length === 2;
  const tail = hasCompression ? splitGroups(halves[1] ?? "") : null;

  let groups: string[];
  if (tail === null) {
    groups = head;
    if (groups.length !== 8) return null;
  } else {
    const missing = 8 - (head.length + tail.length);
    if (missing < 1) return null; // "::" must stand for at least one zero group
    groups = [...head, ...Array.from({ length: missing }, () => "0"), ...tail];
  }
  if (groups.length !== 8) return null;

  let acc = 0n;
  for (const g of groups) {
    if (!/^[0-9a-fA-F]{1,4}$/.test(g)) return null;
    acc = (acc << 16n) | BigInt(parseInt(g, 16));
  }
  return acc;
}

function inV6Cidr(ip: bigint, base: bigint, prefix: number): boolean {
  if (prefix === 0) return true;
  const mask = ((1n << 128n) - 1n) ^ ((1n << BigInt(128 - prefix)) - 1n);
  return (ip & mask) === (base & mask);
}

// A handful of special-purpose ranges that live INSIDE global unicast 2000::/3
// and therefore are not caught by the "must be global unicast" gate below.
const V6_INNER_BLOCKS: ReadonlyArray<{ base: bigint; prefix: number; cls: IpClass }> = [
  { base: parseIpv6("2001::")!, prefix: 32, cls: "teredo" },
  { base: parseIpv6("2001:db8::")!, prefix: 32, cls: "documentation" },
  { base: parseIpv6("2002::")!, prefix: 16, cls: "6to4" },
  { base: parseIpv6("3fff::")!, prefix: 20, cls: "documentation" },
];

const V6_GLOBAL_UNICAST_BASE = parseIpv6("2000::")!;

function classifyIpv6Int(v: bigint): IpClass {
  // IPv4-mapped ::ffff:0:0/96 - block the whole class; DNS never legitimately
  // returns these, and they are a classic guard-bypass vector.
  if (v >> 32n === 0xffffn) return "ipv4-mapped";

  // Everything in ::/96 (unspecified ::, loopback ::1, IPv4-compatible ::a.b.c.d).
  if (v >> 32n === 0n) {
    if (v === 0n) return "unspecified";
    if (v === 1n) return "loopback";
    return "ipv4-compatible";
  }

  for (const range of V6_INNER_BLOCKS) {
    if (inV6Cidr(v, range.base, range.prefix)) return range.cls;
  }

  // Only 2000::/3 is global unicast; anything else (fc00::/7 unique-local,
  // fe80::/10 link-local, ff00::/8 multicast, NAT64 64:ff9b::/96, and all
  // currently-reserved space) is blocked.
  if (!inV6Cidr(v, V6_GLOBAL_UNICAST_BASE, 3)) return "reserved";

  return "public";
}

/** Classify a bare IP literal (no surrounding brackets). */
export function classifyIp(ip: string): IpClass {
  const kind = net.isIP(ip);
  if (kind === 4) {
    const n = parseIpv4(ip);
    return n === null ? "invalid" : classifyIpv4Int(n);
  }
  if (kind === 6) {
    const n = parseIpv6(ip);
    return n === null ? "invalid" : classifyIpv6Int(n);
  }
  return "invalid";
}

/** True unless the address is a genuinely public unicast IP. */
export function isBlockedIp(ip: string): boolean {
  return classifyIp(ip) !== "public";
}
