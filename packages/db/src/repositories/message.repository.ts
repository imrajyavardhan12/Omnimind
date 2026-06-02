import { and, asc, desc, eq } from 'drizzle-orm'
import type { Db } from '../client.js'
import { chatModelRuns, messages, type Message, type NewMessage } from '../schema/index.js'

/** A message plus the usage/cost/latency of the model run that produced it (null for user messages). */
export type MessageWithUsage = Message & {
  totalTokens: number | null
  costUsd: string | null
  latencyMs: number | null
}

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
   * Conversation history enriched with each assistant message's model-run
   * usage/cost/latency (LEFT JOIN chat_model_runs on messages.model_run_id, 1:1).
   * Used by the run UI so the completion footer (tokens/cost/time) persists in
   * history and survives a refresh, instead of vanishing when the live streaming
   * panel is replaced by the persisted message.
   */
  async findByConversationWithUsage(
    conversationId: string,
    workspaceId: string,
    limit = 200,
  ): Promise<MessageWithUsage[]> {
    const rows = await this.db
      .select({
        message: messages,
        totalTokens: chatModelRuns.totalTokens,
        costUsd: chatModelRuns.costUsd,
        latencyMs: chatModelRuns.latencyMs,
      })
      .from(messages)
      .leftJoin(chatModelRuns, eq(messages.modelRunId, chatModelRuns.id))
      .where(and(eq(messages.conversationId, conversationId), eq(messages.workspaceId, workspaceId)))
      .orderBy(asc(messages.createdAt))
      .limit(limit)
    return rows.map((r) => ({
      ...r.message,
      totalTokens: r.totalTokens,
      costUsd: r.costUsd,
      latencyMs: r.latencyMs,
    }))
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
