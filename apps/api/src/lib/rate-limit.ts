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

/** Upper bound on tracked keys — eviction above this keeps memory bounded. */
const MAX_TRACKED_KEYS = 10_000

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
    // Bounded memory: one entry per active key. Idle keys are evicted lazily
    // here so a long-lived process can't accumulate them without bound.
    if (fresh.length === 0) {
      this.hits.delete(key)
    } else {
      this.hits.set(key, fresh)
      if (this.hits.size > MAX_TRACKED_KEYS) this.evictIdleKeys(now)
    }
    if (fresh.length >= this.maxRequests) {
      const oldest = Math.min(...fresh)
      return { allowed: false, retryAfterMs: Math.max(0, oldest + this.windowMs - now) }
    }
    const next = [...fresh, now]
    this.hits.set(key, next)
    if (this.hits.size > MAX_TRACKED_KEYS) this.evictIdleKeys(now)
    return { allowed: true }
  }

  /**
   * Drop keys whose entire window has expired (oldest first). Called only
   * when the map exceeds MAX_TRACKED_KEYS, so the common path stays O(1)-ish.
   */
  private evictIdleKeys(now: number): void {
    const windowStart = now - this.windowMs
    for (const [key, stamps] of this.hits) {
      const latest = stamps.length > 0 ? Math.max(...stamps) : windowStart
      if (latest <= windowStart) this.hits.delete(key)
      if (this.hits.size <= MAX_TRACKED_KEYS) break
    }
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
