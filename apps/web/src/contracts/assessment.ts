/** qrrrgh shared assessment contract, version 1. Copied from contracts\v1\assessment.d.ts. */
export const SCHEMA_VERSION = 1;

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
  params: Record<string, string>;
  title: string;
  detail: string;
}

export interface Limitation {
  code: string;
  params: Record<string, string>;
  text: string;
}

export interface UrlBreakdown {
  scheme: string;
  username?: string;
  hasPassword: boolean;
  host: string;
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
  scripts: string[];
}

export interface Assessment {
  schemaVersion: number;
  payloadKind: PayloadKind;
  rawPayload: string;
  displayPayload: string;
  url?: UrlBreakdown;
  findings: Finding[];
  limitations: Limitation[];
  verdict: Verdict;
  confidence: number;
  classifierScore?: number;
  recommendedActions: RecommendedAction[];
  summary: string;
  engineVersion: string;
  rulesVersion: string;
  locale: string;
  evaluatedAtMs: number;
}

export interface EngineConfig {
  rules?: unknown;
  catalogs?: Record<string, Record<string, { title: string; detail: string }>>;
  locale?: string;
}

export interface AssessInput {
  payload: string;
  nowMs: number;
  locale?: string;
}

export interface SafetyEngineWasm {
  assess(inputJson: string): string;
  version(): string;
  free(): void;
}
