import { describe, it, expect } from 'vitest'
import { summarizeUsage } from '../usage.js'

const FROM = new Date('2026-09-01T00:00:00.000Z')
const TO = new Date('2026-09-28T00:00:00.000Z')

describe('summarizeUsage', () => {
  it('folds an empty ledger into zero totals', () => {
    const summary = summarizeUsage([], FROM, TO)
    expect(summary.totalCostUsd).toBe('0.000000')
    expect(summary.totalRuns).toBe(0)
    expect(summary.byModel).toEqual([])
    expect(summary.daily).toEqual([])
    expect(summary.from).toBe(FROM.toISOString())
  })

  it('sums cost without float drift and sorts models by spend', () => {
    const summary = summarizeUsage(
      [
        { provider: 'openai', model: 'gpt-4o', day: '2026-09-02', costUsd: '0.010500', inputTokens: 100, outputTokens: 50, totalTokens: 150, runs: 1 },
        { provider: 'openai', model: 'gpt-4o', day: '2026-09-01', costUsd: '0.000100', inputTokens: 10, outputTokens: 5, totalTokens: 15, runs: 1 },
        { provider: 'anthropic', model: 'claude-sonnet', day: '2026-09-01', costUsd: '0.020000', inputTokens: 200, outputTokens: 100, totalTokens: 300, runs: 2 },
      ],
      FROM,
      TO,
    )
    // 0.010500 + 0.000100 + 0.020000 — exact in micros, drift-free.
    expect(summary.totalCostUsd).toBe('0.030600')
    expect(summary.totalTokens).toBe(465)
    expect(summary.totalRuns).toBe(4)
    expect(summary.byModel.map((b) => b.model)).toEqual(['claude-sonnet', 'gpt-4o'])
    expect(summary.byModel[0]).toMatchObject({ provider: 'anthropic', costUsd: '0.020000', runs: 2 })
    expect(summary.daily.map((d) => d.date)).toEqual(['2026-09-01', '2026-09-02'])
    expect(summary.daily[0]).toMatchObject({ costUsd: '0.020100', totalTokens: 315, runs: 3 })
  })

  it('treats unparsable costs as zero instead of NaN-poisoning the total', () => {
    const summary = summarizeUsage(
      [{ provider: 'x', model: 'y', day: '2026-09-01', costUsd: 'not-a-number', inputTokens: 1, outputTokens: 1, totalTokens: 2, runs: 1 }],
      FROM,
      TO,
    )
    expect(summary.totalCostUsd).toBe('0.000000')
    expect(summary.totalTokens).toBe(2)
  })
})
