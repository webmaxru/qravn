/**
 * Fixed-window per-key rate limiter (keyed by client IP).
 *
 * This endpoint makes outbound requests and costs money, so it must never be
 * usable as a free proxy or traffic amplifier. Pure in-memory; for multi-replica
 * deployments a shared store would be layered on top, but per-replica limiting
 * already caps blast radius under Container Apps' small replica counts.
 */

export interface RateLimitResult {
  allowed: boolean;
  /** Seconds until the window resets (for a Retry-After header). */
  retryAfterSeconds: number;
}

interface Window {
  count: number;
  resetAt: number;
}

export class RateLimiter {
  private readonly windows = new Map<string, Window>();

  constructor(
    private readonly windowMs: number,
    private readonly max: number,
    private readonly now: () => number = Date.now,
  ) {}

  check(key: string): RateLimitResult {
    const t = this.now();
    const existing = this.windows.get(key);
    if (!existing || existing.resetAt <= t) {
      this.windows.set(key, { count: 1, resetAt: t + this.windowMs });
      return { allowed: true, retryAfterSeconds: 0 };
    }
    if (existing.count >= this.max) {
      return {
        allowed: false,
        retryAfterSeconds: Math.max(1, Math.ceil((existing.resetAt - t) / 1000)),
      };
    }
    existing.count += 1;
    return { allowed: true, retryAfterSeconds: 0 };
  }

  /** Drop expired windows so the map does not grow without bound. */
  sweep(): void {
    const t = this.now();
    for (const [key, win] of this.windows) {
      if (win.resetAt <= t) this.windows.delete(key);
    }
  }

  get size(): number {
    return this.windows.size;
  }
}
