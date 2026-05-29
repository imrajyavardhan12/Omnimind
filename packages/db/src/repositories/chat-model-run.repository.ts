import { eq } from 'drizzle-orm'
import type { Db } from '../client.js'
import {
  chatModelRuns,
  type ChatModelRun,
  type NewChatModelRun,
} from '../schema/index.js'

export interface ChatModelRunUpdateFields {
  status?: ChatModelRun['status']
  outputMessageId?: string
  providerRequestId?: string
  errorCode?: string
  errorMessage?: string
  inputTokens?: number
  outputTokens?: number
  totalTokens?: number
  usageSource?: 'provider' | 'estimated'
  costUsd?: string
  latencyMs?: number
  startedAt?: Date
  completedAt?: Date
}

export class ChatModelRunRepository {
  constructor(private readonly db: Db) {}

  async create(input: NewChatModelRun): Promise<ChatModelRun> {
    const rows = await this.db.insert(chatModelRuns).values(input).returning()
    return rows[0]!
  }

  async findById(id: string): Promise<ChatModelRun | undefined> {
    const rows = await this.db
      .select()
      .from(chatModelRuns)
      .where(eq(chatModelRuns.id, id))
      .limit(1)
    return rows[0]
  }

  async findByChatRun(chatRunId: string): Promise<ChatModelRun[]> {
    return this.db
      .select()
      .from(chatModelRuns)
      .where(eq(chatModelRuns.chatRunId, chatRunId))
  }

  async updateStatus(
    id: string,
    status: ChatModelRun['status'],
    fields?: Omit<ChatModelRunUpdateFields, 'status'>,
  ): Promise<ChatModelRun | undefined> {
    const set: Record<string, unknown> = { status, updatedAt: new Date() }
    if (fields) {
      for (const [key, value] of Object.entries(fields)) {
        if (value !== undefined) set[key] = value
      }
    }
    const rows = await this.db
      .update(chatModelRuns)
      .set(set)
      .where(eq(chatModelRuns.id, id))
      .returning()
    return rows[0]
  }
}
