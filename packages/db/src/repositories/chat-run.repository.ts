import { and, desc, eq, lt } from 'drizzle-orm'
import type { Db } from '../client.js'
import { chatRuns, type ChatRun, type NewChatRun } from '../schema/index.js'

export class ChatRunRepository {
  constructor(private readonly db: Db) {}

  async create(input: NewChatRun): Promise<ChatRun> {
    const rows = await this.db.insert(chatRuns).values(input).returning()
    return rows[0]!
  }

  async findById(id: string): Promise<ChatRun | undefined> {
    const rows = await this.db
      .select()
      .from(chatRuns)
      .where(eq(chatRuns.id, id))
      .limit(1)
    return rows[0]
  }

  async findByIdempotencyKey(
    workspaceId: string,
    idempotencyKey: string,
  ): Promise<ChatRun | undefined> {
    const rows = await this.db
      .select()
      .from(chatRuns)
      .where(
        and(
          eq(chatRuns.workspaceId, workspaceId),
          eq(chatRuns.idempotencyKey, idempotencyKey),
        ),
      )
      .limit(1)
    return rows[0]
  }

  async updateStatus(
    id: string,
    status: ChatRun['status'],
    fields?: { startedAt?: Date; completedAt?: Date; inputMessageId?: string },
  ): Promise<ChatRun | undefined> {
    const rows = await this.db
      .update(chatRuns)
      .set({
        status,
        updatedAt: new Date(),
        ...(fields?.startedAt !== undefined && { startedAt: fields.startedAt }),
        ...(fields?.completedAt !== undefined && { completedAt: fields.completedAt }),
        ...(fields?.inputMessageId !== undefined && { inputMessageId: fields.inputMessageId }),
      })
      .where(eq(chatRuns.id, id))
      .returning()
    return rows[0]
  }

  async findByConversation(
    conversationId: string,
    limit = 50,
    cursor?: string,
  ): Promise<ChatRun[]> {
    const conditions = [eq(chatRuns.conversationId, conversationId)]
    if (cursor) {
      const cursorDate = new Date(cursor)
      if (Number.isNaN(cursorDate.getTime())) {
        throw new Error(`Invalid pagination cursor: ${cursor}`)
      }
      conditions.push(lt(chatRuns.createdAt, cursorDate))
    }
    return this.db
      .select()
      .from(chatRuns)
      .where(and(...conditions))
      .orderBy(desc(chatRuns.createdAt))
      .limit(limit)
  }
}
