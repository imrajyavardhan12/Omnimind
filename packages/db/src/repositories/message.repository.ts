import { and, asc, desc, eq } from 'drizzle-orm'
import type { Db } from '../client.js'
import { messages, type Message, type NewMessage } from '../schema/index.js'

export class MessageRepository {
  constructor(private readonly db: Db) {}

  async findByConversation(conversationId: string, workspaceId: string, limit = 200): Promise<Message[]> {
    return this.db
      .select()
      .from(messages)
      .where(and(eq(messages.conversationId, conversationId), eq(messages.workspaceId, workspaceId)))
      .orderBy(asc(messages.createdAt))
      .limit(limit)
  }

  /**
   * The most recent `limit` messages, returned in chronological (oldest-first)
   * order. Used to assemble model context: ordering DESC + LIMIT in the database
   * guarantees the newest messages (including the just-persisted user prompt) are
   * always included, unlike fetching the oldest N and slicing in memory.
   */
  async findRecentByConversation(conversationId: string, workspaceId: string, limit = 20): Promise<Message[]> {
    const rows = await this.db
      .select()
      .from(messages)
      .where(and(eq(messages.conversationId, conversationId), eq(messages.workspaceId, workspaceId)))
      .orderBy(desc(messages.createdAt))
      .limit(limit)
    return rows.reverse()
  }

  async create(input: NewMessage): Promise<Message> {
    const rows = await this.db.insert(messages).values(input).returning()
    return rows[0]!
  }
}
