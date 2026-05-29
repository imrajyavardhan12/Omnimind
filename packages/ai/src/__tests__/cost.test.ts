import { describe, expect, it } from 'vitest'
import { calculateCost } from '../cost.js'

describe('calculateCost', () => {
  it('calculates zero cost for zero tokens', () => {
    expect(calculateCost(0, 0, '3.000000', '15.000000')).toBe('0.000000')
  })

  it('calculates cost for GPT-4o pricing ($3/1M in, $15/1M out)', () => {
    const cost = calculateCost(1000, 500, '3.000000', '15.000000')
    // input:  1000 * 3 / 1_000_000 = 0.003000
    // output: 500 * 15 / 1_000_000 = 0.007500
    // total:  0.010500
    expect(cost).toBe('0.010500')
  })

  it('calculates cost for cheap models ($0.15/1M in, $0.60/1M out)', () => {
    const cost = calculateCost(10000, 5000, '0.150000', '0.600000')
    // input:  10000 * 0.15 / 1_000_000 = 0.001500
    // output: 5000 * 0.60 / 1_000_000  = 0.003000
    // total:  0.004500
    expect(cost).toBe('0.004500')
  })

  it('handles large token counts without floating-point drift', () => {
    const cost = calculateCost(1_000_000, 1_000_000, '3.000000', '15.000000')
    // input:  1M * 3 / 1M = 3.000000
    // output: 1M * 15 / 1M = 15.000000
    // total:  18.000000
    expect(cost).toBe('18.000000')
  })

  it('handles fractional cent pricing without precision loss', () => {
    const cost = calculateCost(100, 100, '0.075000', '0.300000')
    // input:  100 * 0.075 / 1_000_000 = 0.0000075 → truncates to 0.000007
    // output: 100 * 0.3 / 1_000_000 = 0.00003 → 0.000030
    // total:  0.000037
    expect(cost).toBe('0.000037')
  })

  it('handles cost strings without trailing zeros', () => {
    const cost = calculateCost(1000, 1000, '3', '15')
    // input:  1000 * 3 / 1_000_000 = 0.003000
    // output: 1000 * 15 / 1_000_000 = 0.015000
    // total:  0.018000
    expect(cost).toBe('0.018000')
  })

  it('returns consistent 6-decimal format', () => {
    const cost = calculateCost(1, 1, '1.000000', '1.000000')
    expect(cost).toMatch(/^\d+\.\d{6}$/)
  })

  it('coerces missing token counts to zero instead of throwing', () => {
    // Providers may omit usage totals → undefined tokens reach the helper.
    const cost = calculateCost(undefined as unknown as number, 100, '3.000000', '15.000000')
    // input contributes 0, output: 100 * 15 / 1_000_000 = 0.001500
    expect(cost).toBe('0.001500')
  })

  it('truncates fractional token counts instead of throwing', () => {
    const cost = calculateCost(1000.9, 0, '3.000000', '15.000000')
    // 1000 * 3 / 1_000_000 = 0.003000 (0.9 truncated)
    expect(cost).toBe('0.003000')
  })

  it('handles cost strings without trailing-zero padding on the fraction', () => {
    const cost = calculateCost(1_000_000, 0, '0.5', '0')
    // 1M * 0.5 / 1M = 0.500000
    expect(cost).toBe('0.500000')
  })
})
