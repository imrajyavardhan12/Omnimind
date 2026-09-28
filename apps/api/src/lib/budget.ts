/**
 * Workspace budget guards (M9B protection slice).
 *
 * Pure helpers so the policy is unit-testable without a database: services
 * sum month-to-date spend via UsageLedgerRepository.sumCostSince() and pass
 * the numbers in. 15-cost-controls.md wants an 80% alert — M9B logs it via
 * the request logger's status line (429/402 surface); dedicated alert
 * delivery (webhooks/email) stays queued behind M9-full observability.
 */

/** Warn threshold — at/above this percent of budget, services log a warning. */
export const BUDGET_WARN_PERCENT = 80

export interface BudgetCheckInput {
  spentUsd: number
  budgetUsd: number
}

export interface BudgetCheckResult extends BudgetCheckInput {
  allowed: boolean
  /** 0–100+ (can exceed 100 when over budget). */
  percentUsed: number
  warn: boolean
}

export function checkWorkspaceBudget(input: BudgetCheckInput): BudgetCheckResult {
  const { spentUsd, budgetUsd } = input
  const percentUsed = budgetUsd > 0 ? (spentUsd / budgetUsd) * 100 : 0
  return {
    spentUsd,
    budgetUsd,
    allowed: spentUsd < budgetUsd,
    percentUsed,
    warn: percentUsed >= BUDGET_WARN_PERCENT,
  }
}

/** First instant of the UTC month containing `now` — the billing window start. */
export function getMonthStartUTC(now: Date = new Date()): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1))
}
