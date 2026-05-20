import { asc, eq } from 'drizzle-orm'
import type { Db } from '../client.js'
import { messages, type Message, type NewMessage } from '../schema/index.js'

export class MessageRepository {
  constructor(private readonly db: Db) {}

  async findByConversation(conversationId: string, limit = 200): Promise<Message[]> {
    return this.db
      .select()
      .from(messages)
      .where(eq(messages.conversationId, conversationId))
      .orderBy(asc(messages.createdAt))
      .limit(limit)
  }

  async create(input: NewMessage): Promise<Message> {
    const rows = await this.db.insert(messages).values(input).returning()
    return rows[0]!
  }
}
