import { and, desc, eq, ne } from 'drizzle-orm'
import type { Db } from '../client.js'
import { conversations, type Conversation, type NewConversation } from '../schema/index.js'

export class ConversationRepository {
  constructor(private readonly db: Db) {}

  async findById(id: string, workspaceId: string): Promise<Conversation | undefined> {
    const rows = await this.db
      .select()
      .from(conversations)
      .where(and(eq(conversations.id, id), eq(conversations.workspaceId, workspaceId), ne(conversations.status, 'deleted')))
      .limit(1)
    return rows[0]
  }

  async findByWorkspace(
    workspaceId: string,
    limit = 50,
    status?: Conversation['status'],
  ): Promise<Conversation[]> {
    const statusFilter = status
      ? eq(conversations.status, status)
      : ne(conversations.status, 'deleted')
    return this.db
      .select()
      .from(conversations)
      .where(and(eq(conversations.workspaceId, workspaceId), statusFilter))
      .orderBy(desc(conversations.updatedAt))
      .limit(limit)
  }

  async create(input: NewConversation): Promise<Conversation> {
    const rows = await this.db.insert(conversations).values(input).returning()
    return rows[0]!
  }

  async update(
    id: string,
    workspaceId: string,
    patch: Partial<Pick<Conversation, 'title' | 'status'>>,
  ): Promise<Conversation | undefined> {
    const rows = await this.db
      .update(conversations)
      .set({ ...patch, updatedAt: new Date() })
      .where(and(eq(conversations.id, id), eq(conversations.workspaceId, workspaceId), ne(conversations.status, 'deleted')))
      .returning()
    return rows[0]
  }

  async softDelete(id: string, workspaceId: string): Promise<boolean> {
    const rows = await this.db
      .update(conversations)
      .set({ status: 'deleted', updatedAt: new Date() })
      .where(and(eq(conversations.id, id), eq(conversations.workspaceId, workspaceId)))
      .returning()
    return rows.length > 0
  }
}
