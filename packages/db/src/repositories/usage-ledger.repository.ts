import { and, desc, eq, gte, lte, sql } from 'drizzle-orm'
import type { Db } from '../client.js'
import {
  usageLedger,
  type UsageLedgerEntry,
  type NewUsageLedgerEntry,
} from '../schema/index.js'

export interface UsageLedgerFilters {
  provider?: string
  model?: string
  limit?: number
}

/** One grouped row from getSummary: provider × model × UTC day. */
export interface UsageSummaryRow {
  provider: string
  model: string
  day: string
  /** numeric(12,6) sum — arrives as a string via pg numeric. */
  costUsd: string
  inputTokens: number
  outputTokens: number
  totalTokens: number
  runs: number
}

export class UsageLedgerRepository {
  constructor(private readonly db: Db) {}

  async create(input: NewUsageLedgerEntry): Promise<UsageLedgerEntry> {
    const rows = await this.db.insert(usageLedger).values(input).returning()
    return rows[0]!
  }

  async findByWorkspace(
    workspaceId: string,
    filters: UsageLedgerFilters = {},
  ): Promise<UsageLedgerEntry[]> {
    const conditions = [eq(usageLedger.workspaceId, workspaceId)]
    if (filters.provider) {
      conditions.push(eq(usageLedger.provider, filters.provider))
    }
    if (filters.model) {
      conditions.push(eq(usageLedger.model, filters.model))
    }
    return this.db
      .select()
      .from(usageLedger)
      .where(and(...conditions))
      .orderBy(desc(usageLedger.createdAt))
      .limit(filters.limit ?? 100)
  }

  /**
   * Total USD spent by a workspace since `since` (month-to-date for M9B
   * budget enforcement). cost_usd is numeric(12,6) — summed in SQL as float
   * and returned as a number; callers compare against the configured budget.
   * Append-only ledger is never mutated here.
   */
  async sumCostSince(workspaceId: string, since: Date): Promise<number> {
    const rows = await this.db
      .select({ total: sql<number>`coalesce(sum(${usageLedger.costUsd}::float8), 0)` })
      .from(usageLedger)
      .where(and(eq(usageLedger.workspaceId, workspaceId), gte(usageLedger.createdAt, since)))
    const total = rows[0]?.total ?? 0
    return typeof total === 'number' ? total : Number(total)
  }

  /**
   * Grouped usage rows for the dashboard summary (M9 usage slice). One query
   * grouped by provider × model × UTC day; the caller folds rows into totals,
   * by-model buckets, and a daily series (see apps/api/src/lib/usage.ts).
   * Bounded at 5000 groups — a workspace with more distinct triples per window
   * is pathological; the cap keeps the dashboard read cheap.
   */
  async getSummary(
    workspaceId: string,
    from: Date,
    to: Date,
  ): Promise<UsageSummaryRow[]> {
    const day = sql<string>`to_char(${usageLedger.createdAt}, 'YYYY-MM-DD')`
    return this.db
      .select({
        provider: usageLedger.provider,
        model: usageLedger.model,
        day,
        costUsd: sql<string>`sum(${usageLedger.costUsd})`,
        inputTokens: sql<number>`coalesce(sum(${usageLedger.inputTokens}), 0)::int`,
        outputTokens: sql<number>`coalesce(sum(${usageLedger.outputTokens}), 0)::int`,
        totalTokens: sql<number>`coalesce(sum(${usageLedger.totalTokens}), 0)::int`,
        runs: sql<number>`count(*)::int`,
      })
      .from(usageLedger)
      .where(
        and(
          eq(usageLedger.workspaceId, workspaceId),
          gte(usageLedger.createdAt, from),
          lte(usageLedger.createdAt, to),
        ),
      )
      .groupBy(usageLedger.provider, usageLedger.model, day)
      .limit(5000)
  }
}
