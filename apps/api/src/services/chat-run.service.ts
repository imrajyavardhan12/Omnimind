import { randomUUID } from 'node:crypto'
import type { Db } from '@omnimind/db'
import {
  ChatModelRunRepository,
  ChatRunEventRepository,
  ChatRunRepository,
  ChatRunWriteRepository,
  ConversationRepository,
  FileExtractionRepository,
  FileRepository,
  MessageRepository,
  ModelCatalogRepository,
  ModelCatalogService,
  ProviderKeyRepository,
  UsageLedgerRepository,
} from '@omnimind/db'
import type {
  ChatModelRun,
  ChatRun,
  NewChatModelRun,
  NewChatRun,
  NewMessage,
  NewMessageAttachment,
} from '@omnimind/db'
import { isUniqueViolation } from '@omnimind/db'
import { LLMGateway, calculateCost } from '@omnimind/ai'
import type { LLMGatewayRequest, NormalizedAttachment } from '@omnimind/ai'
import type {
  ChatRunModelConfig,
  ChatRunStatus,
  CreateRunRequest,
  GatewayError,
  GatewayMessage,
  NormalizedUsage,
  StreamEnvelope,
  StreamEventType,
} from '@omnimind/types'
import { fileCategoryForMime, isAllowedMimeType, MAX_FILES_PER_MESSAGE, MAX_TOTAL_BYTES_PER_MESSAGE } from '@omnimind/types'
import { decryptProviderKey } from '../lib/encryption.js'
import { downloadObject, type R2Deps } from '../lib/r2.js'
import { checkWorkspaceBudget, getMonthStartUTC } from '../lib/budget.js'
import { rateLimitKey, type RateLimiter } from '../lib/rate-limit.js'
import type { RunCoordinator } from './run-coordinator.js'

export type ChatRunServiceErrorCode =
  | 'CONVERSATION_NOT_FOUND'
  | 'CHAT_RUN_NOT_FOUND'
  | 'ATTACHMENT_NOT_FOUND'
  | 'ATTACHMENT_NOT_READY'
  | 'ATTACHMENT_LIMIT_EXCEEDED'
  | 'BUDGET_EXCEEDED'
  | 'RATE_LIMITED'

export interface ChatRunPolicyOptions {
  /** Monthly workspace budget in USD — absent means no budget gate (tests/legacy). */
  monthlyBudgetUsd?: number
  /** Per-user fixed-window limiter — absent means no rate gate. */
  rateLimiter?: RateLimiter
  /** Test seam: returns month-to-date spend without touching the ledger. */
  budgetProbe?: (workspaceId: string) => Promise<number>
  now?: () => number
}

export class ChatRunServiceError extends Error {
  public readonly retryAfterMs?: number
  constructor(
    public readonly code: ChatRunServiceErrorCode,
    message: string,
    options?: { retryAfterMs?: number },
  ) {
    super(message)
    this.name = 'ChatRunServiceError'
    if (options?.retryAfterMs !== undefined) this.retryAfterMs = options.retryAfterMs
  }
}

export interface StartRunParams {
  workspaceId: string
  userId: string
  conversationId: string
  input: CreateRunRequest['input']
  models: CreateRunRequest['models']
  context?: CreateRunRequest['context']
  idempotencyKey?: string
}

export interface StartRunResult {
  runId: string
  conversationId: string
  /** True when an existing run was returned via idempotency-key dedup. */
  existing: boolean
  /**
   * Resolves when the detached run execution finishes. The HTTP handler must
   * NOT await this (create-then-subscribe). Tests await it to assert terminal
   * state. executeRun is fully guarded and never rejects.
   */
  completion: Promise<void>
}

interface ModelRunDescriptor {
  id: string
  provider: ChatRunModelConfig['provider']
  model: string
  settings: ChatRunModelConfig['settings']
}

interface ExecuteContext {
  runId: string
  conversationId: string
  workspaceId: string
  userId: string
  modelRuns: ModelRunDescriptor[]
  attachments: NormalizedAttachment[]
  messageLimit?: number
}

type ModelOutcome = 'completed' | 'failed' | 'cancelled'

/**
 * ChatRunService is the chat orchestrator (07-backend-architecture.md). It owns
 * the full run lifecycle for single/compare mode: durable run + model-run rows,
 * user/assistant message persistence, provider streaming via the LLM Gateway,
 * typed SSE envelope emission with monotonic sequence numbers, usage/cost
 * accounting, cancellation, and partial-failure handling.
 *
 * For M5B model runs execute sequentially; concurrent fan-out is a later
 * milestone. Live transport is the in-process RunCoordinator; every event is
 * also persisted to chat_run_events for replay/reconnect.
 */
export class ChatRunService {
  private readonly chatRunRepo: ChatRunRepository
  private readonly chatModelRunRepo: ChatModelRunRepository
  private readonly chatRunEventRepo: ChatRunEventRepository
  private readonly chatRunWriteRepo: ChatRunWriteRepository
  private readonly conversationRepo: ConversationRepository
  private readonly messageRepo: MessageRepository
  private readonly fileRepo: FileRepository
  private readonly extractionRepo: FileExtractionRepository
  private readonly providerKeyRepo: ProviderKeyRepository
  private readonly modelCatalogRepo: ModelCatalogRepository
  private readonly usageRepo: UsageLedgerRepository
  private readonly gateway: LLMGateway

  constructor(
    db: Db,
    private readonly encryptionSecret: string,
    private readonly coordinator: RunCoordinator,
    private readonly r2: R2Deps,
    private readonly policy: ChatRunPolicyOptions = {},
  ) {
    this.chatRunRepo = new ChatRunRepository(db)
    this.chatModelRunRepo = new ChatModelRunRepository(db)
    this.chatRunEventRepo = new ChatRunEventRepository(db)
    this.chatRunWriteRepo = new ChatRunWriteRepository(db)
    this.conversationRepo = new ConversationRepository(db)
    this.messageRepo = new MessageRepository(db)
    this.fileRepo = new FileRepository(db)
    this.extractionRepo = new FileExtractionRepository(db)
    this.providerKeyRepo = new ProviderKeyRepository(db)
    this.modelCatalogRepo = new ModelCatalogRepository(db)
    this.usageRepo = new UsageLedgerRepository(db)
    this.gateway = new LLMGateway({ modelCatalogService: new ModelCatalogService(db) })
  }

  /**
   * Validate idempotency + ownership, atomically create the run setup rows, and
   * kick off detached execution. Returns once the setup batch has committed.
   */
  async startRun(params: StartRunParams): Promise<StartRunResult> {
    const { workspaceId, userId, conversationId, input, models, context, idempotencyKey } = params

    if (idempotencyKey) {
      const existing = await this.chatRunRepo.findByIdempotencyKey(workspaceId, idempotencyKey)
      if (existing) {
        // A non-failed run with this key is the canonical result — return it.
        if (existing.status !== 'failed') {
          return {
            runId: existing.id,
            conversationId: existing.conversationId,
            existing: true,
            completion: Promise.resolve(),
          }
        }
        // A failed run is retryable with the same key (per M5B spec): release the
        // key from the failed row so the new run can claim it under the unique
        // index. The failed run is preserved for audit.
        await this.chatRunRepo.releaseIdempotencyKey(existing.id)
      }
    }

    // M9B protection: rate gate is cheap (no DB) and runs before any write.
    // Idempotency dedup above stays first so retries with the same key return
    // the canonical run without consuming quota.
    if (this.policy.rateLimiter) {
      const now = this.policy.now?.() ?? Date.now()
      const verdict = this.policy.rateLimiter.check(rateLimitKey('chat-runs', userId), now)
      if (!verdict.allowed) {
        throw new ChatRunServiceError('RATE_LIMITED', 'Chat run rate limit exceeded — try again shortly', {
          ...(verdict.retryAfterMs !== undefined && { retryAfterMs: verdict.retryAfterMs }),
        })
      }
    }

    const conversation = await this.conversationRepo.findById(conversationId, workspaceId)
    if (!conversation) {
      throw new ChatRunServiceError('CONVERSATION_NOT_FOUND', 'Conversation not found')
    }

    // M9B protection: monthly workspace budget gate (DB aggregate, no write).
    // Runs before run creation so blocked requests never orphan rows.
    if (this.policy.monthlyBudgetUsd !== undefined) {
      const spentUsd = this.policy.budgetProbe
        ? await this.policy.budgetProbe(workspaceId)
        : await this.usageRepo.sumCostSince(workspaceId, getMonthStartUTC())
      const verdict = checkWorkspaceBudget({ spentUsd, budgetUsd: this.policy.monthlyBudgetUsd })
      if (verdict.warn && verdict.allowed) {
        console.warn(JSON.stringify({
          ts: new Date().toISOString(),
          level: 'warn',
          msg: 'budget_warn',
          workspaceId,
          spentUsd: verdict.spentUsd,
          budgetUsd: verdict.budgetUsd,
          percentUsed: Math.round(verdict.percentUsed * 100) / 100,
        }))
      }
      if (!verdict.allowed) {
        throw new ChatRunServiceError(
          'BUDGET_EXCEEDED',
          `Workspace monthly budget exceeded ($${verdict.spentUsd.toFixed(2)} of $${verdict.budgetUsd.toFixed(2)} used)`,
        )
      }
    }

    const runId = randomUUID()
    const userMessageId = randomUUID()
    const mode: 'single' | 'compare' = models.length > 1 ? 'compare' : 'single'

    const modelRuns: ModelRunDescriptor[] = models.map((m) => ({
      id: randomUUID(),
      provider: m.provider,
      model: m.model,
      settings: m.settings,
    }))

    const run: NewChatRun = {
      id: runId,
      workspaceId,
      conversationId,
      createdByUserId: userId,
      inputMessageId: userMessageId,
      mode,
      status: 'queued',
      ...(idempotencyKey !== undefined && { idempotencyKey }),
    }

    const userMessage: NewMessage = {
      id: userMessageId,
      conversationId,
      workspaceId,
      role: 'user',
      contentText: input.text,
      createdByUserId: userId,
    }

    const modelRunRows: NewChatModelRun[] = modelRuns.map((d) => ({
      id: d.id,
      chatRunId: runId,
      workspaceId,
      provider: d.provider,
      model: d.model,
      status: 'queued',
      ...(d.settings !== undefined && { settingsJson: d.settings }),
    }))

    // Attachments are validated BEFORE any write: a bad file id aborts run
    // creation instead of orphaning a run with dangling references.
    const attachmentIds = input.attachmentIds ?? []
    if (attachmentIds.length > MAX_FILES_PER_MESSAGE) {
      throw new ChatRunServiceError(
        'ATTACHMENT_LIMIT_EXCEEDED',
        `Too many attachments (max ${MAX_FILES_PER_MESSAGE} files per message)`,
      )
    }
    const attachments = await this.resolveAttachments(workspaceId, attachmentIds)
    const attachmentLinks: NewMessageAttachment[] = attachments.map((a) => ({
      messageId: userMessageId,
      fileId: a.fileId,
      attachmentRole: 'user_upload',
    }))

    try {
      await this.chatRunWriteRepo.createRunSetup({ run, userMessage, modelRuns: modelRunRows, attachments: attachmentLinks })
    } catch (err) {
      // The UNIQUE (workspace_id, idempotency_key) index is the authoritative
      // dedup guard. A concurrent request that raced past findByIdempotencyKey
      // and claimed the key first makes this insert throw 23505; re-fetch and
      // return the winning run instead of surfacing a 500.
      if (idempotencyKey && isUniqueViolation(err)) {
        const winner = await this.chatRunRepo.findByIdempotencyKey(workspaceId, idempotencyKey)
        if (winner) {
          return {
            runId: winner.id,
            conversationId: winner.conversationId,
            existing: true,
            completion: Promise.resolve(),
          }
        }
      }
      throw err
    }

    const completion = this.executeRun({
      runId,
      conversationId,
      workspaceId,
      userId,
      modelRuns,
      attachments,
      ...(context?.messageLimit !== undefined && { messageLimit: context.messageLimit }),
    })

    return { runId, conversationId, existing: false, completion }
  }

  async getRun(params: {
    runId: string
    workspaceId: string
  }): Promise<{ run: ChatRun; modelRuns: ChatModelRun[] }> {
    const run = await this.chatRunRepo.findById(params.runId)
    if (!run || run.workspaceId !== params.workspaceId) {
      throw new ChatRunServiceError('CHAT_RUN_NOT_FOUND', 'Chat run not found')
    }
    const modelRuns = await this.chatModelRunRepo.findByChatRun(params.runId)
    return { run, modelRuns }
  }

  async cancelRun(params: {
    runId: string
    workspaceId: string
  }): Promise<{ status: ChatRunStatus }> {
    const run = await this.chatRunRepo.findById(params.runId)
    if (!run || run.workspaceId !== params.workspaceId) {
      throw new ChatRunServiceError('CHAT_RUN_NOT_FOUND', 'Chat run not found')
    }
    if (run.status === 'completed' || run.status === 'failed' || run.status === 'cancelled') {
      return { status: run.status }
    }
    const aborted = this.coordinator.abort(params.runId)
    if (!aborted) {
      // Not executing in this instance (e.g. after a restart). The detached
      // loop cannot transition it, so mark terminal directly. Live subscribers,
      // if any, will not receive a run.cancelled here — acceptable single-instance.
      await this.chatRunRepo.updateStatus(params.runId, 'cancelled', { completedAt: new Date() })
    }
    return { status: 'cancelled' }
  }

  // --- internal execution ---

  private async executeRun(ctx: ExecuteContext): Promise<void> {
    const { runId, conversationId, workspaceId } = ctx
    const controller = this.coordinator.registerRun(runId)
    const signal = controller.signal

    let sequence = 0
    const emit = (type: StreamEventType, data: object): void => {
      sequence += 1
      const seq = sequence
      const envelope: StreamEnvelope<string, unknown> = {
        type,
        runId,
        sequence: seq,
        timestamp: new Date().toISOString(),
        data,
      }
      this.coordinator.publish(runId, envelope)
      // Persist for replay/reconnect. Non-fatal: a dropped event row must not
      // tear down an in-flight stream.
      void this.chatRunEventRepo
        .create({ chatRunId: runId, sequence: seq, eventType: type, payloadJson: envelope })
        .catch((err: unknown) => {
          console.error(`[chat-run] failed to persist event seq=${seq} run=${runId}`, err)
        })
    }

    try {
      await this.chatRunRepo.updateStatus(runId, 'running', { startedAt: new Date() })
      emit('run.started', { conversationId })

      const history = await this.buildMessages(conversationId, workspaceId, ctx.messageLimit)

      let anyCompleted = false

      for (const mr of ctx.modelRuns) {
        if (signal.aborted) {
          await this.chatModelRunRepo.updateStatus(mr.id, 'cancelled', { completedAt: new Date() })
          emit('model.cancelled', { modelRunId: mr.id })
          continue
        }
        const outcome = await this.runOneModel({ ctx, mr, signal, messages: history, emit })
        if (outcome === 'completed') anyCompleted = true
      }

      if (signal.aborted) {
        await this.chatRunRepo.updateStatus(runId, 'cancelled', { completedAt: new Date() })
        emit('run.cancelled', {})
      } else if (anyCompleted) {
        await this.chatRunRepo.updateStatus(runId, 'completed', { completedAt: new Date() })
        emit('run.completed', {})
      } else {
        await this.chatRunRepo.updateStatus(runId, 'failed', { completedAt: new Date() })
        emit('run.failed', { error: { code: 'ALL_MODELS_FAILED', message: 'All model runs failed' } })
      }
    } catch (err) {
      try {
        await this.chatRunRepo.updateStatus(runId, 'failed', { completedAt: new Date() })
      } catch {
        // best-effort terminal state
      }
      emit('run.failed', { error: { code: 'INTERNAL_ERROR', message: 'Run execution failed' } })
      console.error(`[chat-run] run ${runId} execution error`, err)
    } finally {
      this.coordinator.finish(runId)
    }
  }

  private async runOneModel(args: {
    ctx: ExecuteContext
    mr: ModelRunDescriptor
    signal: AbortSignal
    messages: GatewayMessage[]
    emit: (type: StreamEventType, data: object) => void
  }): Promise<ModelOutcome> {
    const { ctx, mr, signal, messages, emit } = args
    const { runId, conversationId, workspaceId, userId } = ctx
    const modelRunId = mr.id

    const startedAt = new Date()
    await this.chatModelRunRepo.updateStatus(modelRunId, 'running', { startedAt })
    emit('model.started', { modelRunId, provider: mr.provider, model: mr.model })

    // Provider key is fetched + decrypted inside the per-model scope and never
    // held across the run, stashed, or logged.
    let providerKey: string
    try {
      const keyRow = await this.providerKeyRepo.findEncrypted(workspaceId, mr.provider)
      if (!keyRow) {
        return this.failModel(modelRunId, 'PROVIDER_KEY_MISSING', `No provider key configured for ${mr.provider}`, mr.provider, emit)
      }
      providerKey = decryptProviderKey(keyRow.encryptedKey, this.encryptionSecret)
    } catch {
      return this.failModel(modelRunId, 'PROVIDER_KEY_INVALID', 'Failed to decrypt provider key', mr.provider, emit)
    }

    const pricing = await this.modelCatalogRepo.findByProviderModel(mr.provider, mr.model)

    let text = ''
    let usage: NormalizedUsage | undefined
    let finishReason: string | undefined
    let streamError: GatewayError | undefined

    try {
      const req: LLMGatewayRequest = {
        provider: mr.provider,
        model: mr.model,
        messages,
        providerKey,
        abortSignal: signal,
        ...(ctx.attachments.length > 0 && { attachments: ctx.attachments }),
      }
      if (mr.settings?.systemPrompt !== undefined) req.system = mr.settings.systemPrompt
      if (mr.settings?.temperature !== undefined) req.temperature = mr.settings.temperature
      if (mr.settings?.maxOutputTokens !== undefined) req.maxOutputTokens = mr.settings.maxOutputTokens

      for await (const chunk of this.gateway.stream(req)) {
        if (chunk.type === 'delta') {
          text += chunk.delta
          emit('model.delta', { modelRunId, text: chunk.delta })
        } else if (chunk.type === 'done') {
          finishReason = chunk.finishReason
          usage = chunk.usage
        } else {
          streamError = chunk.error
        }
      }
    } catch {
      streamError = { code: 'UNKNOWN_PROVIDER_ERROR', message: 'Provider stream error' }
    }

    if (signal.aborted || streamError?.code === 'CANCELLED') {
      if (text.length > 0) {
        // Cancel with a visible partial: persist it as the model run's output
        // message (status stays 'cancelled') so the partial survives refresh
        // and the next turn's context sees an answered pair instead of a
        // dangling unanswered question. The provider never reports totals on
        // an aborted stream, so usage falls back to estimated zeros.
        const cancelledAt = new Date()
        const latencyMs = cancelledAt.getTime() - startedAt.getTime()
        const cancelledInputTokens = usage?.inputTokens ?? 0
        const cancelledOutputTokens = usage?.outputTokens ?? 0
        const cancelledTotalTokens = usage?.totalTokens ?? cancelledInputTokens + cancelledOutputTokens
        const cancelledUsageSource: 'provider' | 'estimated' = usage ? 'provider' : 'estimated'
        const cancelledCostUsd = pricing
          ? calculateCost(cancelledInputTokens, cancelledOutputTokens, pricing.inputCostPer1m, pricing.outputCostPer1m)
          : '0.000000'

        const partialMessageId = randomUUID()
        await this.chatRunWriteRepo.completeModelRun({
          assistantMessage: {
            id: partialMessageId,
            conversationId,
            workspaceId,
            role: 'assistant',
            contentText: text,
            modelRunId,
            provider: mr.provider,
            model: mr.model,
            createdByUserId: null,
          },
          modelRunId,
          modelRun: {
            status: 'cancelled',
            outputMessageId: partialMessageId,
            inputTokens: cancelledInputTokens,
            outputTokens: cancelledOutputTokens,
            totalTokens: cancelledTotalTokens,
            usageSource: cancelledUsageSource,
            costUsd: cancelledCostUsd,
            latencyMs,
            completedAt: cancelledAt,
          },
          usageEntry: {
            workspaceId,
            userId,
            conversationId,
            chatRunId: runId,
            chatModelRunId: modelRunId,
            provider: mr.provider,
            model: mr.model,
            inputTokens: cancelledInputTokens,
            outputTokens: cancelledOutputTokens,
            totalTokens: cancelledTotalTokens,
            usageSource: cancelledUsageSource,
            costUsd: cancelledCostUsd,
          },
        })
      } else {
        // Cancelled before the first token: nothing the user saw, so no
        // assistant message. The user's own prompt is deliberately left in
        // place (deleting user-typed input on cancel would be data loss).
        await this.chatModelRunRepo.updateStatus(modelRunId, 'cancelled', { completedAt: new Date() })
      }
      emit('model.cancelled', { modelRunId })
      return 'cancelled'
    }

    if (streamError) {
      return this.failModel(modelRunId, streamError.code, streamError.message, mr.provider, emit, streamError.retryable)
    }

    const completedAt = new Date()
    const latencyMs = completedAt.getTime() - startedAt.getTime()
    const inputTokens = usage?.inputTokens ?? 0
    const outputTokens = usage?.outputTokens ?? 0
    const totalTokens = usage?.totalTokens ?? inputTokens + outputTokens
    const usageSource: 'provider' | 'estimated' = usage ? 'provider' : 'estimated'
    const costUsd = pricing
      ? calculateCost(inputTokens, outputTokens, pricing.inputCostPer1m, pricing.outputCostPer1m)
      : '0.000000'

    const assistantMessageId = randomUUID()
    await this.chatRunWriteRepo.completeModelRun({
      assistantMessage: {
        id: assistantMessageId,
        conversationId,
        workspaceId,
        role: 'assistant',
        contentText: text,
        modelRunId,
        provider: mr.provider,
        model: mr.model,
        createdByUserId: null,
      },
      modelRunId,
      modelRun: {
        status: 'completed',
        outputMessageId: assistantMessageId,
        inputTokens,
        outputTokens,
        totalTokens,
        usageSource,
        costUsd,
        latencyMs,
        completedAt,
      },
      usageEntry: {
        workspaceId,
        userId,
        conversationId,
        chatRunId: runId,
        chatModelRunId: modelRunId,
        provider: mr.provider,
        model: mr.model,
        inputTokens,
        outputTokens,
        totalTokens,
        usageSource,
        costUsd,
      },
    })

    emit('model.completed', {
      modelRunId,
      ...(finishReason !== undefined && { finishReason }),
      ...(usage !== undefined && { usage }),
      costUsd,
      latencyMs,
    })
    emit('usage.updated', { usage: { inputTokens, outputTokens, totalTokens }, costUsd })
    return 'completed'
  }

  private async failModel(
    modelRunId: string,
    code: string,
    message: string,
    provider: string,
    emit: (type: StreamEventType, data: object) => void,
    retryable?: boolean,
  ): Promise<'failed'> {
    await this.chatModelRunRepo.updateStatus(modelRunId, 'failed', {
      errorCode: code,
      errorMessage: message,
      completedAt: new Date(),
    })
    emit('model.failed', {
      modelRunId,
      error: { code, message, provider, ...(retryable !== undefined && { retryable }) },
    })
    return 'failed'
  }

  /**
   * Validate attachment ids and resolve them into gateway-ready attachments.
   *
   * - findById is workspace-scoped and excludes soft-deleted rows, so missing,
   *   foreign-workspace, and deleted files all 404 identically (no existence
   *   oracle across workspaces).
   * - Only `ready` files are usable: `uploaded` audio (transcription deferred)
   *   and mid-pipeline files are rejected explicitly, never silently skipped.
   * - Images fetch bytes from R2 here (orchestrator owns storage); extracted
   *   text comes from the latest extraction row. Truncation budgets live in
   *   the gateway's per-model preparation, so full text flows downstream.
   */
  private async resolveAttachments(
    workspaceId: string,
    attachmentIds: string[],
  ): Promise<NormalizedAttachment[]> {
    if (attachmentIds.length === 0) return []
    const resolved: NormalizedAttachment[] = []
    let totalBytes = 0
    for (const id of attachmentIds) {
      const file = await this.fileRepo.findById(id, workspaceId)
      if (!file) {
        throw new ChatRunServiceError('ATTACHMENT_NOT_FOUND', 'Attachment not found')
      }
      if (file.status !== 'ready') {
        throw new ChatRunServiceError(
          'ATTACHMENT_NOT_READY',
          `Attachment '${file.filename}' is not ready (status: ${file.status})`,
        )
      }
      if (!isAllowedMimeType(file.mimeType)) {
        // Unreachable through the upload route (allowlisted there) — fail closed.
        throw new ChatRunServiceError('ATTACHMENT_NOT_READY', `Attachment '${file.filename}' has an unsupported type`)
      }
      totalBytes += file.sizeBytes
      const category = fileCategoryForMime(file.mimeType)
      let text: string | undefined
      let imageBytes: Uint8Array | undefined
      if (category === 'image') {
        // R2 outage here propagates to the 500 boundary: the server-side
        // dependency failed, not the request.
        imageBytes = new Uint8Array(await downloadObject(this.r2, file.storageKey))
      } else if (category !== 'audio') {
        const latest = await this.extractionRepo.findLatestByFileId(file.id)
        text = latest?.outputText ?? undefined
      }
      resolved.push({
        fileId: file.id,
        filename: file.filename,
        mimeType: file.mimeType,
        category,
        ...(text !== undefined && { text }),
        ...(imageBytes !== undefined && { imageBytes }),
      })
    }
    if (totalBytes > MAX_TOTAL_BYTES_PER_MESSAGE) {
      throw new ChatRunServiceError(
        'ATTACHMENT_LIMIT_EXCEEDED',
        `Attachments exceed the per-message total (max ${MAX_TOTAL_BYTES_PER_MESSAGE} bytes)`,
      )
    }
    return resolved
  }

  /**
   * Assemble gateway messages from the last N conversation messages (the
   * just-persisted user message is always included because the repository
   * fetches the newest N at the database level). Tool messages are excluded.
   */
  private async buildMessages(
    conversationId: string,
    workspaceId: string,
    messageLimit?: number,
  ): Promise<GatewayMessage[]> {
    const limit = messageLimit ?? 20
    const recent = await this.messageRepo.findRecentByConversation(conversationId, workspaceId, limit)
    const result: GatewayMessage[] = []
    for (const m of recent) {
      if (m.role === 'user' || m.role === 'assistant' || m.role === 'system') {
        result.push({ role: m.role, content: m.contentText })
      }
    }
    return result
  }
}
