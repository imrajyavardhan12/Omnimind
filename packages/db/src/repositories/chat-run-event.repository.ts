import { and, asc, eq, gt } from 'drizzle-orm'
import type { Db } from '../client.js'
import {
  chatRunEvents,
  type ChatRunEvent,
  type NewChatRunEvent,
} from '../schema/index.js'

export class ChatRunEventRepository {
  constructor(private readonly db: Db) {}

  async create(input: NewChatRunEvent): Promise<ChatRunEvent> {
    const rows = await this.db.insert(chatRunEvents).values(input).returning()
    return rows[0]!
  }

  async findByChatRun(
    chatRunId: string,
    afterSequence?: number,
  ): Promise<ChatRunEvent[]> {
    const conditions = [eq(chatRunEvents.chatRunId, chatRunId)]
    if (afterSequence !== undefined) {
      conditions.push(gt(chatRunEvents.sequence, afterSequence))
    }
    return this.db
      .select()
      .from(chatRunEvents)
      .where(and(...conditions))
      .orderBy(asc(chatRunEvents.sequence))
  }
}
