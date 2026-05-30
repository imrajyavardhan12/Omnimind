import { eq } from 'drizzle-orm'
import type { Db } from '../client.js'
import {
  chatModelRuns,
  chatRuns,
  messages,
  usageLedger,
  type NewChatModelRun,
  type NewChatRun,
  type NewMessage,
  type NewUsageLedgerEntry,
} from '../schema/index.js'

/**
 * Partial column updates applied to a chat_model_run when a model completes.
 * Mirrors the writable subset of ChatModelRun used by the orchestrator.
 */
export interface ChatModelRunCompletionFields {
  status: NewChatModelRun['status']
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
  completedAt?: Date
}

/**
 * The neon-http Drizzle driver does not support interactive transactions
 * (`db.transaction(async tx => ...)` throws). It DOES support `db.batch([...])`,
 * which Neon executes as a single atomic server-side transaction. This
 * repository owns the multi-table atomic write groups for the chat run engine
 * so the table/column knowledge stays in the data layer while the orchestrator
 * service composes the run lifecycle.
 *
 * Callers MUST pre-generate row ids (crypto.randomUUID) so interdependent rows
 * (user message -> chat_run.input_message_id, assistant message ->
 * chat_model_run.output_message_id) can be written as independent statements in
 * a single batch with no read-after-write dependency inside the transaction.
 */
export class ChatRunWriteRepository {
  constructor(private readonly db: Db) {}

  /**
   * Atomic run setup: insert the user message, the chat_run (with
   * input_message_id already pointing at the user message), and one
   * chat_model_run per selected model. All ids must be pre-generated.
   *
   * Statement order matters: the user message is inserted before the chat_run
   * that references it, and the chat_run before the model runs that reference
   * it, so foreign keys resolve within the single batch transaction.
   */
  async createRunSetup(input: {
    run: NewChatRun
    userMessage: NewMessage
    modelRuns: NewChatModelRun[]
  }): Promise<void> {
    const statements = [
      this.db.insert(messages).values(input.userMessage),
      this.db.insert(chatRuns).values(input.run),
      ...input.modelRuns.map((mr) => this.db.insert(chatModelRuns).values(mr)),
    ]
    await this.runBatch(statements)
  }

  /**
   * Atomic model completion: insert the assistant message, update the
   * chat_model_run (output_message_id + usage/cost/latency/status), and append
   * the usage_ledger entry. The assistant message is inserted before the
   * model-run update that references it via output_message_id.
   */
  async completeModelRun(input: {
    assistantMessage: NewMessage
    modelRunId: string
    modelRun: ChatModelRunCompletionFields
    usageEntry: NewUsageLedgerEntry
  }): Promise<void> {
    const updateSet: Record<string, unknown> = {
      status: input.modelRun.status,
      updatedAt: new Date(),
    }
    for (const [key, value] of Object.entries(input.modelRun)) {
      if (key !== 'status' && value !== undefined) updateSet[key] = value
    }

    const statements = [
      this.db.insert(messages).values(input.assistantMessage),
      this.db.update(chatModelRuns).set(updateSet).where(eq(chatModelRuns.id, input.modelRunId)),
      this.db.insert(usageLedger).values(input.usageEntry),
    ]
    await this.runBatch(statements)
  }

  /**
   * neon-http `db.batch` is typed to require a non-empty readonly tuple; we
   * build dynamic arrays (model-run count varies), so assert to the batch
   * parameter type. Each element is a valid Drizzle batch statement.
   */
  private async runBatch(statements: unknown[]): Promise<void> {
    type BatchArg = Parameters<Db['batch']>[0]
    await this.db.batch(statements as unknown as BatchArg)
  }
}
