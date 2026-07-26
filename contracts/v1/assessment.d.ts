/**
 * qrrrgh shared assessment contract, version 1.
 *
 * This file is the FROZEN seam between the Rust safety core and every client
 * surface (web, iOS, Android, backend). The Rust core serializes exactly these
 * shapes; clients deserialize exactly these shapes.
 *
 * Rules:
 *  - Never change the meaning of an existing field. Add new optional fields.
 *  - Every `code` string must exist in ./finding-codes.json.
 *  - Every code must have text in localization/{nb,nn,en}.json.
 *  - The core decides. Clients render. Clients must never re-derive a verdict.
 *  - JSON field names are camelCase on the wire (Rust uses serde rename_all).
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

export interface Finding {
  code: string;
  severity: Severity;
  /** Values already sanitized by the core for safe interpolation. */
  params: Record<string, string>;
  /** Localized, fully interpolated text. Empty when no catalog was supplied. */
  title: string;
  detail: string;
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

export interface Assessment {
  schemaVersion: number;
  payloadKind: PayloadKind;
  /** Exact decoded payload, never modified. Treat as hostile. */
  rawPayload: string;
  /** Presentation form, safe to render. Bidi/control characters neutralized. */
  displayPayload: string;
  url?: UrlBreakdown;
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
