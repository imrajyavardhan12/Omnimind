import { describe, it, expect } from 'vitest'
import { isUniqueViolation } from '../errors.js'

describe('isUniqueViolation', () => {
  it('detects a Postgres unique violation by SQLSTATE 23505', () => {
    const err = Object.assign(new Error('duplicate key'), { code: '23505' })
    expect(isUniqueViolation(err)).toBe(true)
  })

  it('detects a unique violation wrapped one level deep in cause', () => {
    const inner = Object.assign(new Error('dup'), { code: '23505' })
    const outer = Object.assign(new Error('batch failed'), { cause: inner })
    expect(isUniqueViolation(outer)).toBe(true)
  })

  it('returns false for a different SQLSTATE', () => {
    const err = Object.assign(new Error('fk violation'), { code: '23503' })
    expect(isUniqueViolation(err)).toBe(false)
  })

  it('returns false for a plain error', () => {
    expect(isUniqueViolation(new Error('boom'))).toBe(false)
  })

  it('returns false for null/undefined/non-objects', () => {
    expect(isUniqueViolation(null)).toBe(false)
    expect(isUniqueViolation(undefined)).toBe(false)
    expect(isUniqueViolation('23505')).toBe(false)
  })
})
