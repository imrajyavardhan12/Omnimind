/**
 * In-process fixed-window rate limiter (M9B protection slice).
 *
 * 15-cost-controls.md mandates Upstash Redis for distributed limits. The
 * distributed swap is deliberately deferred: single-instance dev, tests, and
 * the current single-API deployment don't need the extra infra yet, and every
 * call site goes through the `RateLimiter` interface so the swap is a wiring
 * change (Upstash-backed class + env keys already reserved in
 * packages/config/src/env.ts), not a call-site change.
 *
 * Single-process limitation: with >1 API replica, each replica enforces its
 * own window — effective limit ≈ per-replica limit × replicas. Acceptable for
 * abuse-guardrails today; the Redis swap removes it when horizontal scale
 * demands it.
 */

export interface RateLimitResult {
  allowed: boolean
  /** ms until the oldest entry in the window expires (set when denied). */
  retryAfterMs?: number
}

export interface RateLimiter {
  check(key: string, now?: number): RateLimitResult
}

export interface RateLimiterOptions {
  maxRequests: number
  windowMs: number
}

export class InMemoryRateLimiter implements RateLimiter {
  private readonly maxRequests: number
  private readonly windowMs: number
  private readonly hits = new Map<string, number[]>()

  constructor(options: RateLimiterOptions) {
    this.maxRequests = options.maxRequests
    this.windowMs = options.windowMs
  }

  check(key: string, now: number = Date.now()): RateLimitResult {
    const windowStart = now - this.windowMs
    const existing = this.hits.get(key) ?? []
    const fresh = existing.filter((t) => t > windowStart)
    if (fresh.length >= this.maxRequests) {
      const oldest = Math.min(...fresh)
      this.hits.set(key, fresh)
      return { allowed: false, retryAfterMs: Math.max(0, oldest + this.windowMs - now) }
    }
    fresh.push(now)
    this.hits.set(key, fresh)
    return { allowed: true }
  }

  /** Test/ops escape hatch — not used in request paths. */
  clear(): void {
    this.hits.clear()
  }
}

/** Per-user key namespace — never key on raw IP alone (NAT over-blocking). */
export function rateLimitKey(scope: string, userId: string): string {
  return `${scope}:user:${userId}`
}
