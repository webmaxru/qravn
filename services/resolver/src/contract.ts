/**
 * Local mirror of the redirect portion of the FROZEN shared contract at
 * `contracts/v1/assessment.d.ts`. The Rust safety core serializes exactly these
 * shapes and another agent parses them against the same contract, so these
 * declarations must stay byte-for-byte compatible with the source of truth.
 *
 * Do NOT edit these to fit the implementation; edit the implementation to fit
 * these. JSON field names are camelCase on the wire.
 */

/** How a hop handed control to the next URL. */
export type RedirectMechanism = "http_status" | "html_meta_refresh" | "unknown";

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

/** Result of expanding a shortened or redirecting URL. */
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
