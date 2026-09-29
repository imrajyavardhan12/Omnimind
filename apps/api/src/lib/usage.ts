import type { UsageSummaryRow } from '@omnimind/db'
import type { UsageBucket, UsageDailyPoint, UsageSummary } from '@omnimind/types'

/**
 * Fold grouped ledger rows into a dashboard summary (M9 usage slice).
 *
 * Pure so the money math is unit-testable without a database. Cost stays in
 * integer micro-dollars throughout the fold and is formatted to 6dp strings
 * only at the boundary — never binary-float addition on USD values.
 */

const MICROS_PER_USD = 1_000_000

function toMicros(costUsd: string): number {
  const n = Number(costUsd)
  return Number.isFinite(n) ? Math.round(n * MICROS_PER_USD) : 0
}

function toUsdString(micros: number): string {
  return (micros / MICROS_PER_USD).toFixed(6)
}

export function summarizeUsage(rows: UsageSummaryRow[], from: Date, to: Date): UsageSummary {
  let totalMicros = 0
  let totalInputTokens = 0
  let totalOutputTokens = 0
  let totalTokens = 0
  let totalRuns = 0

  const byModel = new Map<string, UsageBucket & { micros: number }>()
  const daily = new Map<string, UsageDailyPoint & { micros: number }>()

  for (const row of rows) {
    const micros = toMicros(row.costUsd)
    totalMicros += micros
    totalInputTokens += row.inputTokens
    totalOutputTokens += row.outputTokens
    totalTokens += row.totalTokens
    totalRuns += row.runs

    const modelKey = `${row.provider}:${row.model}`
    const bucket = byModel.get(modelKey) ?? {
      provider: row.provider,
      model: row.model,
      costUsd: '0.000000',
      inputTokens: 0,
      outputTokens: 0,
      totalTokens: 0,
      runs: 0,
      micros: 0,
    }
    bucket.micros += micros
    bucket.inputTokens += row.inputTokens
    bucket.outputTokens += row.outputTokens
    bucket.totalTokens += row.totalTokens
    bucket.runs += row.runs
    byModel.set(modelKey, bucket)

    const point = daily.get(row.day) ?? {
      date: row.day,
      costUsd: '0.000000',
      totalTokens: 0,
      runs: 0,
      micros: 0,
    }
    point.micros += micros
    point.totalTokens += row.totalTokens
    point.runs += row.runs
    daily.set(row.day, point)
  }

  return {
    from: from.toISOString(),
    to: to.toISOString(),
    totalCostUsd: toUsdString(totalMicros),
    totalInputTokens,
    totalOutputTokens,
    totalTokens,
    totalRuns,
    byModel: [...byModel.values()]
      .sort((a, b) => b.micros - a.micros)
      .map(({ micros, ...rest }) => ({ ...rest, costUsd: toUsdString(micros) })),
    daily: [...daily.values()]
      .sort((a, b) => (a.date < b.date ? -1 : 1))
      .map(({ micros, ...rest }) => ({ ...rest, costUsd: toUsdString(micros) })),
  }
}
