/**
 * Runtime configuration, entirely from environment variables with safe defaults.
 * No secrets live here or in any committed file.
 */

import {
  META_REFRESH_MAX_DELAY_SECONDS,
} from "./constants.js";
import { log } from "./logger.js";

export interface Config {
  port: number;
  host: string;
  corsAllowedOrigins: ReadonlySet<string>;
  rateLimitWindowMs: number;
  rateLimitMax: number;
  hopTimeoutMs: number;
  totalTimeoutMs: number;
  metaRefreshMaxDelaySeconds: number;
  /**
   * Verify TLS certificates on every hop. Forced ON in production regardless of
   * `TLS_REJECT_UNAUTHORIZED`; disabling it would allow a MITM on every hop.
   */
  rejectUnauthorized: boolean;
  trustProxy: boolean;
  /**
   * DEV/TEST ONLY. When true the resolver additionally permits loopback targets
   * (127.0.0.1 / ::1) so it can be exercised against a local test server. It is
   * loopback-only (never private/link-local/metadata). **Forced OFF in
   * production** (`NODE_ENV==="production"`) regardless of `DEV_ALLOW_LOOPBACK`:
   * a comment is not a control, so the core SSRF guard cannot be switched off by
   * a stray environment variable.
   */
  devAllowLoopback: boolean;
  /**
   * DEV/TEST ONLY extra ports to permit (e.g. an ephemeral local server).
   * **Forced empty in production** regardless of `DEV_EXTRA_ALLOWED_PORTS`.
   */
  extraAllowedPorts: ReadonlySet<number>;
}

const DEFAULT_CORS_ORIGINS = [
  "https://brave-bay-0ecf82e03.7.azurestaticapps.net",
  "http://localhost:5173",
  "http://localhost:4173",
  "http://127.0.0.1:5173",
  "http://127.0.0.1:4173",
];

function intFromEnv(env: NodeJS.ProcessEnv, name: string, fallback: number): number {
  const raw = env[name];
  if (raw === undefined || raw.trim() === "") return fallback;
  const n = Number(raw);
  return Number.isFinite(n) && n >= 0 ? Math.floor(n) : fallback;
}

function boolFromEnv(env: NodeJS.ProcessEnv, name: string, fallback: boolean): boolean {
  const raw = env[name];
  if (raw === undefined) return fallback;
  return /^(1|true|yes|on)$/i.test(raw.trim());
}

function portsFromEnv(env: NodeJS.ProcessEnv, name: string): Set<number> {
  const raw = env[name];
  if (!raw || raw.trim() === "") return new Set();
  const ports = raw
    .split(",")
    .map((p) => Number(p.trim()))
    .filter((p) => Number.isInteger(p) && p > 0 && p <= 65535);
  return new Set(ports);
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  // NODE_ENV=production is authoritative and is baked into the shipped image
  // (see Dockerfile), so the container is hardened by default even if the
  // platform's environment config is wrong.
  const isProduction = env.NODE_ENV === "production";

  const originsRaw = env.CORS_ALLOWED_ORIGINS;
  const origins =
    originsRaw && originsRaw.trim() !== ""
      ? originsRaw.split(",").map((o) => o.trim()).filter((o) => o !== "")
      : DEFAULT_CORS_ORIGINS;

  // Dev bypasses and TLS relaxation are read from the environment, then FORCED
  // off in production regardless of what the environment says. This service is a
  // URL-fetcher accepting attacker-supplied input from the public internet; it
  // must not be one stray env var away from switching off its own SSRF guard or
  // certificate validation. Refusals are logged loudly at error level because
  // they mean someone's deployment config is dangerous and should be fixed now.
  const requestedDevAllowLoopback = boolFromEnv(env, "DEV_ALLOW_LOOPBACK", false);
  const requestedExtraPorts = portsFromEnv(env, "DEV_EXTRA_ALLOWED_PORTS");
  const requestedRejectUnauthorized = boolFromEnv(env, "TLS_REJECT_UNAUTHORIZED", true);

  if (isProduction) {
    if (requestedDevAllowLoopback) {
      log.error("dev_bypass_refused_in_production", {
        setting: "DEV_ALLOW_LOOPBACK",
        note: "loopback SSRF bypass IGNORED because NODE_ENV=production; fix your deployment config",
      });
    }
    if (requestedExtraPorts.size > 0) {
      log.error("dev_bypass_refused_in_production", {
        setting: "DEV_EXTRA_ALLOWED_PORTS",
        note: "extra destination ports IGNORED because NODE_ENV=production; only 80/443 are permitted",
      });
    }
    if (!requestedRejectUnauthorized) {
      log.error("dev_bypass_refused_in_production", {
        setting: "TLS_REJECT_UNAUTHORIZED",
        note: "TLS certificate validation CANNOT be disabled in production; verification stays ON",
      });
    }
  }

  // In production these degrade to the hardened value (we keep serving, closed on
  // the security control) rather than crashing: a crash-loop during an incident
  // invites an operator to weaken the guard to restore service, which is worse.
  const devAllowLoopback = isProduction ? false : requestedDevAllowLoopback;
  const extraAllowedPorts: ReadonlySet<number> = isProduction ? new Set() : requestedExtraPorts;
  const rejectUnauthorized = isProduction ? true : requestedRejectUnauthorized;

  return {
    port: intFromEnv(env, "PORT", 8080),
    host: env.HOST && env.HOST.trim() !== "" ? env.HOST.trim() : "0.0.0.0",
    corsAllowedOrigins: new Set(origins),
    rateLimitWindowMs: intFromEnv(env, "RATE_LIMIT_WINDOW_MS", 10_000),
    rateLimitMax: intFromEnv(env, "RATE_LIMIT_MAX", 20),
    hopTimeoutMs: intFromEnv(env, "HOP_TIMEOUT_MS", 2_000),
    totalTimeoutMs: intFromEnv(env, "TOTAL_TIMEOUT_MS", 10_000),
    metaRefreshMaxDelaySeconds: intFromEnv(
      env,
      "META_REFRESH_MAX_DELAY_SECONDS",
      META_REFRESH_MAX_DELAY_SECONDS,
    ),
    rejectUnauthorized,
    // Azure Container Apps ingress sets X-Forwarded-For; enable when deployed.
    trustProxy: boolFromEnv(env, "TRUST_PROXY", false),
    devAllowLoopback,
    extraAllowedPorts,
  };
}
