/**
 * Minimal structured logger.
 *
 * Product invariant #14: full URLs may carry tokens, so they are NEVER logged
 * at info level. Callers log hostnames and outcomes. Output is line-delimited
 * JSON on stdout/stderr for easy ingestion by the platform.
 */

export type LogLevel = "debug" | "info" | "warn" | "error";

const LEVELS: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

function currentThreshold(): number {
  const raw = (process.env.LOG_LEVEL ?? "info").toLowerCase();
  if (raw === "silent" || raw === "off" || raw === "none") return Number.POSITIVE_INFINITY;
  return LEVELS[raw as LogLevel] ?? LEVELS.info;
}

function emit(level: LogLevel, msg: string, fields?: Record<string, unknown>): void {
  if (LEVELS[level] < currentThreshold()) return;
  const record = {
    ts: new Date().toISOString(),
    level,
    msg,
    ...fields,
  };
  const line = JSON.stringify(record);
  if (level === "error" || level === "warn") process.stderr.write(line + "\n");
  else process.stdout.write(line + "\n");
}

export const log = {
  debug: (msg: string, fields?: Record<string, unknown>) => emit("debug", msg, fields),
  info: (msg: string, fields?: Record<string, unknown>) => emit("info", msg, fields),
  warn: (msg: string, fields?: Record<string, unknown>) => emit("warn", msg, fields),
  error: (msg: string, fields?: Record<string, unknown>) => emit("error", msg, fields),
};

/**
 * Reduce a URL to a host-only token that is safe to log. Never returns path,
 * query, or fragment, any of which can carry secrets.
 */
export function safeHost(url: string): string {
  try {
    const u = new URL(url);
    return u.port ? `${u.hostname}:${u.port}` : u.hostname;
  } catch {
    return "<unparseable>";
  }
}
