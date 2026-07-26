/**
 * GENERATED FILE - DO NOT EDIT.
 *
 * Generated from contracts/v1/assessment.d.ts by tools/sync-contract.mjs.
 * Change the contract there, then run: node tools/sync-contract.mjs
 */

export const SCHEMA_VERSION = 1;

/** The only four public verdicts. There is deliberately no "safe". */
export type Verdict =
  | "known_malicious"
  | "suspicious"
  | "insufficient_evidence"
  | "no_known_threat_found";

export type Severity = "info" | "low" | "medium" | "high" | "critical";

export type PayloadKind =
  | "url"
  | "text"
  | "wifi"
  | "email"
  | "phone"
  | "sms"
  | "geo"
  | "contact"
  | "calendar"
  | "crypto"
  | "otp"
  | "deeplink"
  | "empty"
  | "binary";

/**
 * What the UI is permitted to offer. Derived by the core, never by the client.
 * `open_blocked` means the client must not present an open affordance at all.
 */
export type RecommendedAction =
  | "open_allowed"
  | "open_with_confirmation"
  | "open_blocked"
  | "copy"
  | "expand_redirect_online"
  | "scan_again"
  | "report";

/**
 * Which URL a finding describes. Added in v1.1.
 *
 * Once a redirect chain is expanded there are two different URLs in play, and
 * conflating them would make the UI lie: "this link uses an IP address" is a
 * very different statement about the scanned code than about the page it
 * eventually reaches. Absent means "scanned".
 */
export type FindingSubject = "scanned" | "final";

export interface Finding {
  code: string;
  severity: Severity;
  /** Values already sanitized by the core for safe interpolation. */
  params: Record<string, string>;
  /** Localized, fully interpolated text. Empty when no catalog was supplied. */
  title: string;
  detail: string;
  /** Which URL this finding is about. Absent is equivalent to "scanned". */
  subject?: FindingSubject;
}

export interface Limitation {
  code: string;
  params: Record<string, string>;
  text: string;
}

/**
 * Structural decomposition of a URL. `host` is the AUTHORITY host, which is
 * the only host that matters for safety. A userinfo segment is reported
 * separately because `https://trusted.no@evil.example` reads as trusted.no to
 * a human but resolves to evil.example.
 */
export interface UrlBreakdown {
  scheme: string;
  username?: string;
  hasPassword: boolean;
  /** Authority host, ASCII/Punycode form. */
  host: string;
  /** Unicode presentation form, when different from `host`. */
  unicodeHost?: string;
  port?: number;
  path: string;
  query?: string;
  fragment?: string;
  registrableDomain?: string;
  publicSuffix?: string;
  subdomains: string[];
  isIpLiteral: boolean;
  hasCredentials: boolean;
  hasPunycode: boolean;
  isMixedScript: boolean;
  /** Unicode script names detected in the host, e.g. ["Latin", "Cyrillic"]. */
  scripts: string[];
}

/** How a hop handed control to the next URL. */
export type RedirectMechanism =
  | "http_status"
  | "html_meta_refresh"
  | "unknown";

/** One hop of a redirect chain, as observed by the isolated resolver. */
export interface RedirectHop {
  /** Absolute URL requested at this hop. Hop 0 is the scanned URL itself. */
  url: string;
  /** HTTP status observed, when a response was received. */
  status?: number;
  /** How this hop pointed at the next one. Absent on the final hop. */
  via?: RedirectMechanism;
}

/** Why a resolution stopped. Anything other than `resolved` is partial. */
export type RedirectOutcome =
  | "resolved"
  | "max_hops"
  | "timeout"
  | "network_error"
  | "blocked"
  | "loop";

/**
 * Result of expanding a shortened or redirecting URL.
 *
 * This is produced by isolated server infrastructure and passed IN to the
 * core. Neither the core nor the user's device ever performs this fetch: the
 * whole point of the product is that checking a hostile code does not tell the
 * destination that anyone looked at it.
 */
export interface RedirectResolution {
  /** Ordered hops beginning with the scanned URL. Always at least one entry. */
  chain: RedirectHop[];
  /** Final absolute URL reached. Absent unless `outcome` is "resolved". */
  finalUrl?: string;
  outcome: RedirectOutcome;
  /** Milliseconds the resolver spent. Informational only. */
  elapsedMs?: number;
  /** Resolver name and version, for provenance in support cases. */
  resolver?: string;
}

/** Core's analysis of a supplied redirect chain. Present only when one was given. */
export interface RedirectAnalysis {
  /** Number of hops after the scanned URL. Zero means it did not redirect. */
  hopCount: number;
  outcome: RedirectOutcome;
  /** Decomposition of the final URL, when one was reached. */
  finalUrl?: UrlBreakdown;
  /** Registrable domains traversed in order, consecutive duplicates removed. */
  domainsTraversed: string[];
  /** True when the destination is a different registrable domain than the scan. */
  crossedRegistrableDomain: boolean;
  /** True when an https hop was followed by an http hop. */
  downgradedToHttp: boolean;
}

export interface Assessment {
  schemaVersion: number;
  payloadKind: PayloadKind;
  /** Exact decoded payload, never modified. Treat as hostile. */
  rawPayload: string;
  /** Presentation form, safe to render. Bidi/control characters neutralized. */
  displayPayload: string;
  url?: UrlBreakdown;
  /**
   * Analysis of the expanded redirect chain. Present only when the host
   * supplied a `redirectResolution`. Findings about the destination carry
   * `subject: "final"`.
   */
  redirect?: RedirectAnalysis;
  findings: Finding[];
  limitations: Limitation[];
  verdict: Verdict;
  /** 0.0-1.0. Confidence in the verdict, not probability of maliciousness. */
  confidence: number;
  /** 0.0-1.0 from the compact classifier. Absent when unavailable. */
  classifierScore?: number;
  recommendedActions: RecommendedAction[];
  /** Localized one-line summary of the verdict. */
  summary: string;
  engineVersion: string;
  rulesVersion: string;
  locale: string;
  evaluatedAtMs: number;
}

/** Supplied once at engine construction. */
export interface EngineConfig {
  /** Rule package JSON. Omit to use the bundled defaults. */
  rules?: unknown;
  /** Localization catalogs keyed by locale, e.g. { nb: {...}, en: {...} }. */
  catalogs?: Record<string, Record<string, { title: string; detail: string }>>;
  /** BCP-47 locale. Falls back to "en" when a catalog is missing. */
  locale?: string;
}

export interface AssessInput {
  payload: string;
  /** Injected clock. The core never reads system time. */
  nowMs: number;
  /** Overrides the engine locale for this call. */
  locale?: string;
  /**
   * Redirect chain resolved by isolated server infrastructure, supplied only
   * after the user explicitly asked for online expansion. Omit it and the core
   * behaves exactly as it does offline, reporting
   * `limitation.redirect_not_expanded`.
   *
   * The core treats every URL in here as hostile attacker-controlled input.
   */
  redirectResolution?: RedirectResolution;
}

/**
 * WebAssembly surface exported by core/bindings/wasm.
 * Arguments and returns are JSON strings so the boundary stays stable across
 * wasm-bindgen, UniFFI, and any future binding technology.
 *
 *   const engine = new SafetyEngine(JSON.stringify(config));
 *   const result: Assessment = JSON.parse(engine.assess(JSON.stringify(input)));
 */
export interface SafetyEngineWasm {
  /** @param inputJson JSON of AssessInput @returns JSON of Assessment */
  assess(inputJson: string): string;
  version(): string;
  free(): void;
}
