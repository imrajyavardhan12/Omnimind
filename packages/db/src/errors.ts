/**
 * Postgres SQLSTATE for a unique-constraint violation. Neon surfaces this on
 * `NeonDbError.code`; drizzle propagates the error unchanged from neon-http.
 */
const UNIQUE_VIOLATION = '23505'

/**
 * True when the error is a Postgres unique-constraint violation (SQLSTATE 23505).
 *
 * Used to make a UNIQUE index the authoritative idempotency guard: a write that
 * loses a race to claim a key throws 23505, which callers translate into a
 * dedup (re-fetch + return the winning row) rather than a 500. Checks the error
 * and one level of `cause` so a wrapped error is still recognised.
 */
export function isUniqueViolation(err: unknown): boolean {
  return hasSqlState(err, UNIQUE_VIOLATION)
}

function hasSqlState(err: unknown, code: string): boolean {
  if (typeof err !== 'object' || err === null) return false
  const candidate = err as { code?: unknown; cause?: unknown }
  if (candidate.code === code) return true
  return candidate.cause !== undefined && hasSqlState(candidate.cause, code)
}
