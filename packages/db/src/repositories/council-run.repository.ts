import { and, desc, eq, lt } from 'drizzle-orm'
import type { Db } from '../client.js'
import { councilRuns, type CouncilRun, type NewCouncilRun } from '../schema/index.js'

export class CouncilRunRepository {
  constructor(private readonly db: Db) {}

  async create(input: NewCouncilRun): Promise<CouncilRun> {
    const rows = await this.db.insert(councilRuns).values(input).returning()
    return rows[0]!
  }

  async findById(id: string): Promise<CouncilRun | undefined> {
    const rows = await this.db
      .select()
      .from(councilRuns)
      .where(eq(councilRuns.id, id))
      .limit(1)
    return rows[0]
  }

  async updateStatus(
    id: string,
    status: CouncilRun['status'],
    fields?: { startedAt?: Date; completedAt?: Date },
  ): Promise<CouncilRun | undefined> {
    const rows = await this.db
      .update(councilRuns)
      .set({
        status,
        updatedAt: new Date(),
        ...(fields?.startedAt !== undefined && { startedAt: fields.startedAt }),
        ...(fields?.completedAt !== undefined && { completedAt: fields.completedAt }),
      })
      .where(eq(councilRuns.id, id))
      .returning()
    return rows[0]
  }

  async findByConversation(
    conversationId: string,
    limit = 50,
    cursor?: string,
  ): Promise<CouncilRun[]> {
    const conditions = [eq(councilRuns.conversationId, conversationId)]
    if (cursor) {
      const cursorDate = new Date(cursor)
      if (Number.isNaN(cursorDate.getTime())) {
        throw new Error(`Invalid pagination cursor: ${cursor}`)
      }
      conditions.push(lt(councilRuns.createdAt, cursorDate))
    }
    return this.db
      .select()
      .from(councilRuns)
      .where(and(...conditions))
      .orderBy(desc(councilRuns.createdAt))
      .limit(limit)
  }
}
