import { describe, it, expect } from 'vitest'
import { BUDGET_WARN_PERCENT, checkWorkspaceBudget, getMonthStartUTC } from '../budget.js'

describe('checkWorkspaceBudget', () => {
  it('allows spend under budget without warning', () => {
    const result = checkWorkspaceBudget({ spentUsd: 10, budgetUsd: 50 })
    expect(result.allowed).toBe(true)
    expect(result.warn).toBe(false)
    expect(result.percentUsed).toBe(20)
  })

  it('warns at 80% while still allowing', () => {
    expect(BUDGET_WARN_PERCENT).toBe(80)
    const result = checkWorkspaceBudget({ spentUsd: 40, budgetUsd: 50 })
    expect(result.allowed).toBe(true)
    expect(result.warn).toBe(true)
  })

  it('blocks at or above budget', () => {
    expect(checkWorkspaceBudget({ spentUsd: 50, budgetUsd: 50 }).allowed).toBe(false)
    const over = checkWorkspaceBudget({ spentUsd: 75, budgetUsd: 50 })
    expect(over.allowed).toBe(false)
    expect(over.percentUsed).toBe(150)
  })
})

describe('getMonthStartUTC', () => {
  it('returns the first instant of the UTC month', () => {
    const start = getMonthStartUTC(new Date('2026-09-28T15:30:00Z'))
    expect(start.toISOString()).toBe('2026-09-01T00:00:00.000Z')
  })
})
