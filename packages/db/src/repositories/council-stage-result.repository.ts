import { asc, eq } from 'drizzle-orm'
import type { Db } from '../client.js'
import {
  councilStageResults,
  type CouncilStageResult,
  type NewCouncilStageResult,
} from '../schema/index.js'

export class CouncilStageResultRepository {
  constructor(private readonly db: Db) {}

  async create(input: NewCouncilStageResult): Promise<CouncilStageResult> {
    const rows = await this.db.insert(councilStageResults).values(input).returning()
    return rows[0]!
  }

  /** Stage outputs for a run, oldest first (stage execution order). */
  async findByCouncilRun(councilRunId: string): Promise<CouncilStageResult[]> {
    return this.db
      .select()
      .from(councilStageResults)
      .where(eq(councilStageResults.councilRunId, councilRunId))
      .orderBy(asc(councilStageResults.createdAt))
  }

  async updateStatus(
    id: string,
    status: CouncilStageResult['status'],
    fields?: { payloadJson?: unknown; completedAt?: Date },
  ): Promise<CouncilStageResult | undefined> {
    const rows = await this.db
      .update(councilStageResults)
      .set({
        status,
        updatedAt: new Date(),
        ...(fields?.payloadJson !== undefined && { payloadJson: fields.payloadJson }),
        ...(fields?.completedAt !== undefined && { completedAt: fields.completedAt }),
      })
      .where(eq(councilStageResults.id, id))
      .returning()
    return rows[0]
  }
}
