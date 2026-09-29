import { describe, it, expect } from 'vitest'
import { InMemoryRateLimiter, rateLimitKey } from '../rate-limit.js'

describe('InMemoryRateLimiter', () => {
  it('allows up to the max within the window', () => {
    const limiter = new InMemoryRateLimiter({ maxRequests: 3, windowMs: 60_000 })
    expect(limiter.check('u1', 0).allowed).toBe(true)
    expect(limiter.check('u1', 1_000).allowed).toBe(true)
    expect(limiter.check('u1', 2_000).allowed).toBe(true)
    const denied = limiter.check('u1', 3_000)
    expect(denied.allowed).toBe(false)
    expect(denied.retryAfterMs).toBeGreaterThan(0)
  })

  it('isolates keys per user', () => {
    const limiter = new InMemoryRateLimiter({ maxRequests: 1, windowMs: 60_000 })
    expect(limiter.check('a', 0).allowed).toBe(true)
    expect(limiter.check('a', 1).allowed).toBe(false)
    expect(limiter.check('b', 1).allowed).toBe(true)
  })

  it('expires old entries so the window slides', () => {
    const limiter = new InMemoryRateLimiter({ maxRequests: 1, windowMs: 1_000 })
    expect(limiter.check('u1', 0).allowed).toBe(true)
    expect(limiter.check('u1', 500).allowed).toBe(false)
    expect(limiter.check('u1', 1_001).allowed).toBe(true)
  })

  it('does not count denied attempts against the window', () => {
    const limiter = new InMemoryRateLimiter({ maxRequests: 1, windowMs: 1_000 })
    expect(limiter.check('u1', 0).allowed).toBe(true)
    expect(limiter.check('u1', 500).allowed).toBe(false)
    // The denied attempt at t=500 must not push the window out: at t=1001 the
    // original entry expired, so the next request is allowed.
    expect(limiter.check('u1', 1_001).allowed).toBe(true)
  })
})

describe('rateLimitKey', () => {
  it('namespaces by scope and user', () => {
    expect(rateLimitKey('chat-runs', 'user_1')).toBe('chat-runs:user:user_1')
    expect(rateLimitKey('chat-runs', 'user_1')).not.toBe(rateLimitKey('council-runs', 'user_1'))
  })
})

describe('InMemoryRateLimiter memory bounds', () => {
  it('evicts fully-expired keys once the tracked set grows past the cap', () => {
    const limiter = new InMemoryRateLimiter({ maxRequests: 1, windowMs: 1_000 })
    const hits = (limiter as unknown as { hits: Map<string, number[]> }).hits
    for (let i = 0; i < 10_050; i++) limiter.check(`user-${i}`, 0)
    expect(hits.size).toBeLessThanOrEqual(10_050)
    // All entries are now idle (window expired); the next check sweeps them.
    limiter.check('fresh-user', 5_000)
    expect(hits.has('user-0')).toBe(false)
    expect(hits.has('fresh-user')).toBe(true)
  })
})
