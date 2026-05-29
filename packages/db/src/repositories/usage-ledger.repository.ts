import { and, desc, eq } from 'drizzle-orm'
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
}
