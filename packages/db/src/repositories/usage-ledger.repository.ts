import { and, desc, eq, gte, sql } from 'drizzle-orm'
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
}
