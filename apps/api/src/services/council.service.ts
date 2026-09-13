import { randomUUID } from 'node:crypto'
import type { Db } from '@omnimind/db'
import {
  ConversationRepository,
  CouncilRunRepository,
  CouncilStageResultRepository,
  ModelCatalogRepository,
  ModelCatalogService,
  ProviderKeyRepository,
  UsageLedgerRepository,
  type CouncilRun,
  type CouncilStageResult,
  type NewCouncilRun,
  type NewCouncilStageResult,
} from '@omnimind/db'
import { LLMGateway, aggregateRankings, calculateCost, parsePeerRanking } from '@omnimind/ai'
import type { LLMGatewayRequest } from '@omnimind/ai'
import type {
  AggregateResult,
  CouncilEventType,
  CouncilMember,
  CouncilRunStatus,
  CreateCouncilRunRequest,
  GatewayMessage,
  NormalizedUsage,
  ParsedBallot,
  StreamEnvelope,
} from '@omnimind/types'
import { decryptProviderKey } from '../lib/encryption.js'
import type { RunCoordinator } from './run-coordinator.js'

/**
 * Versioned prompt templates for the council workflow. Stored on every ballot
 * payload (promptTemplateId/Version) so output quality stays attributable to
 * the exact wording that produced it (13-council-workflow.md prompt versioning).
 * Lifted from the legacy useCouncil.ts prompts; the anonymity structure
 * (labels only, FINAL RANKING section) is unchanged.
 */
export const COUNCIL_PROMPT_TEMPLATE_ID = 'council-v1'
export const COUNCIL_PROMPT_TEMPLATE_VERSION = '1'

export function buildRankingPrompt(
  query: string,
  answers: { label: string; text: string }[],
): string {
  const anonymized = answers
    .map((r) => `**Response ${r.label}:**\n${r.text}`)
    .join('\n\n---\n\n')
  return `You are evaluating responses to this question: "${query}"

Here are the anonymized responses from different AI models:

${anonymized}

---

Please evaluate each response for accuracy, completeness, clarity, and insight.
Then rank all responses from best to worst.

IMPORTANT: You must end your evaluation with a clear ranking in this exact format:
FINAL RANKING:
1. Response [letter]
2. Response [letter]
... and so on for all responses

Provide your evaluation:`
}

export function buildSynthesisPrompt(
  query: string,
  ranked: { label: string; provider: string; model: string; text: string; averageRank: number }[],
): string {
  const rankedResponses = ranked
    .map(
      (r, index) =>
        `**#${index + 1} - Response ${r.label} (${r.provider}/${r.model})** (Average rank: ${r.averageRank.toFixed(2)}):\n${r.text}`,
    )
    .join('\n\n---\n\n')
  return `You are the Chairman of an AI Council. Your task is to synthesize the collective wisdom of the council into a final, comprehensive answer.

**Original Question:** ${query}

**Council Responses (ranked by peer review):**

${rankedResponses}

---

As Chairman, synthesize these perspectives into a single, well-structured answer that:
1. Incorporates the best insights from each council member
2. Resolves any contradictions between responses
3. Provides a clear, comprehensive answer to the original question
4. Acknowledges areas of uncertainty if the council was divided

Provide your synthesized answer:`
}

export type CouncilServiceErrorCode = 'CONVERSATION_NOT_FOUND' | 'COUNCIL_RUN_NOT_FOUND'

export class CouncilServiceError extends Error {
  constructor(
    public readonly code: CouncilServiceErrorCode,
    message: string,
  ) {
    super(message)
    this.name = 'CouncilServiceError'
  }
}

export interface StartCouncilRunParams {
  workspaceId: string
  userId: string
  query: string
  councilModels: CouncilMember[]
  chairmanModel: CouncilMember
  conversationId?: string
}

export interface StartCouncilRunResult {
  runId: string
  /**
   * Resolves when the detached workflow finishes. The HTTP handler must NOT
   * await this (create-then-subscribe). Tests await it to assert terminal
   * state. executeRun is fully guarded and never rejects.
   */
  completion: Promise<void>
}

interface MemberDescriptor extends CouncilMember {
  /** Anonymized answer label (A, B, C, …) assigned in request order. */
  label: string
}

interface ExecuteContext {
  runId: string
  workspaceId: string
  userId: string
  query: string
  members: MemberDescriptor[]
  chairman: CouncilMember
  conversationId?: string
}

interface CollectedCall {
  text: string
  usage?: NormalizedUsage
  finishReason?: string
  /**
   * Gateway errors carry a narrow provider-error code union; key-resolution
   * failures (PROVIDER_KEY_MISSING/INVALID) are service-level, so the
   * collected error uses the wide shape both assign to.
   */
  streamError?: { code: string; message: string; retryable?: boolean }
}

interface CostedUsage {
  inputTokens: number
  outputTokens: number
  totalTokens: number
  usageSource: 'provider' | 'estimated'
  costUsd: string
}

/**
 * CouncilService is the durable Council Mode workflow (13-council-workflow.md,
 * M8B slice). Stages execute sequentially; models within a stage execute
 * sequentially (M5B precedent — concurrent fan-out is a later milestone).
 *
 * Durability note (deferred Inngest): live transport is the in-process
 * RunCoordinator and the durable record is council_runs + council_stage_results
 * rows written as each stage lands — NOT a persisted event log (the data model
 * deliberately has no council events table). A queue-backed worker is a future
 * ADR when extraction/council latency demands it (see ADR 0007 precedent).
 * Consequences: an API restart mid-run orphans it (cancel marks it terminal);
 * SSE is live-only, state comes from GET detail.
 */
export class CouncilService {
  private readonly councilRunRepo: CouncilRunRepository
  private readonly stageRepo: CouncilStageResultRepository
  private readonly conversationRepo: ConversationRepository
  private readonly providerKeyRepo: ProviderKeyRepository
  private readonly modelCatalogRepo: ModelCatalogRepository
  private readonly usageRepo: UsageLedgerRepository
  private readonly gateway: LLMGateway

  constructor(
    db: Db,
    private readonly encryptionSecret: string,
    private readonly coordinator: RunCoordinator,
  ) {
    this.councilRunRepo = new CouncilRunRepository(db)
    this.stageRepo = new CouncilStageResultRepository(db)
    this.conversationRepo = new ConversationRepository(db)
    this.providerKeyRepo = new ProviderKeyRepository(db)
    this.modelCatalogRepo = new ModelCatalogRepository(db)
    this.usageRepo = new UsageLedgerRepository(db)
    this.gateway = new LLMGateway({ modelCatalogService: new ModelCatalogService(db) })
  }

  async startRun(params: StartCouncilRunParams): Promise<StartCouncilRunResult> {
    const { workspaceId, userId, query, councilModels, chairmanModel, conversationId } = params

    if (conversationId !== undefined) {
      const conversation = await this.conversationRepo.findById(conversationId, workspaceId)
      if (!conversation) {
        throw new CouncilServiceError('CONVERSATION_NOT_FOUND', 'Conversation not found')
      }
    }

    const runId = randomUUID()
    const members: MemberDescriptor[] = councilModels.map((m, i) => ({
      ...m,
      label: String.fromCharCode(65 + i),
    }))

    const run: NewCouncilRun = {
      id: runId,
      workspaceId,
      createdByUserId: userId,
      query,
      chairmanProvider: chairmanModel.provider,
      chairmanModel: chairmanModel.model,
      status: 'queued',
      ...(conversationId !== undefined && { conversationId }),
    }
    await this.councilRunRepo.create(run)

    const completion = this.executeRun({
      runId,
      workspaceId,
      userId,
      query,
      members,
      chairman: chairmanModel,
      ...(conversationId !== undefined && { conversationId }),
    })

    return { runId, completion }
  }

  async getRun(params: {
    runId: string
    workspaceId: string
  }): Promise<{ run: CouncilRun; stageResults: CouncilStageResult[] }> {
    const run = await this.councilRunRepo.findById(params.runId)
    if (!run || run.workspaceId !== params.workspaceId) {
      throw new CouncilServiceError('COUNCIL_RUN_NOT_FOUND', 'Council run not found')
    }
    const stageResults = await this.stageRepo.findByCouncilRun(params.runId)
    return { run, stageResults }
  }

  async cancelRun(params: {
    runId: string
    workspaceId: string
  }): Promise<{ status: CouncilRunStatus }> {
    const run = await this.councilRunRepo.findById(params.runId)
    if (!run || run.workspaceId !== params.workspaceId) {
      throw new CouncilServiceError('COUNCIL_RUN_NOT_FOUND', 'Council run not found')
    }
    if (run.status === 'completed' || run.status === 'failed' || run.status === 'cancelled') {
      return { status: run.status }
    }
    const aborted = this.coordinator.abort(params.runId)
    if (!aborted) {
      // Not executing in this instance (e.g. after a restart). The detached
      // loop cannot transition it, so mark terminal directly.
      await this.councilRunRepo.updateStatus(params.runId, 'cancelled', { completedAt: new Date() })
    }
    return { status: 'cancelled' }
  }

  // --- internal execution ---

  private async executeRun(ctx: ExecuteContext): Promise<void> {
    const { runId } = ctx
    const controller = this.coordinator.registerRun(runId)
    const signal = controller.signal

    let sequence = 0
    const emit = (type: CouncilEventType, data: object): void => {
      sequence += 1
      const envelope: StreamEnvelope<string, unknown> = {
        type,
        runId,
        sequence,
        timestamp: new Date().toISOString(),
        data,
      }
      this.coordinator.publish(runId, envelope)
    }

    const failRun = async (code: string, message: string): Promise<void> => {
      await this.councilRunRepo.updateStatus(runId, 'failed', { completedAt: new Date() })
      emit('council.failed', { error: { code, message } })
    }

    try {
      await this.councilRunRepo.updateStatus(runId, 'stage1', { startedAt: new Date() })
      emit('council.started', {
        conversationId: ctx.conversationId ?? null,
        councilSize: ctx.members.length,
      })

      // --- Stage 1: independent answers ---
      emit('council.stage.started', { stage: 'stage1' })
      const answers: {
        rowId: string
        label: string
        provider: string
        model: string
        text: string
        usage?: NormalizedUsage
        cost: CostedUsage
        latencyMs: number
        finishReason?: string
      }[] = []
      for (const member of ctx.members) {
        if (signal.aborted) return this.cancelled(ctx, emit)
        const row = await this.createStageRow(runId, 'stage1', member.provider, member.model)
        emit('council.model.started', {
          modelRunId: row.id,
          provider: member.provider,
          model: member.model,
          label: member.label,
        })
        const startedAt = Date.now()
        const call = await this.callModel(ctx, member, [{ role: 'user', content: ctx.query }], signal)
        const latencyMs = Date.now() - startedAt
        if (signal.aborted || call.streamError?.code === 'CANCELLED') {
          await this.stageRepo.updateStatus(row.id, 'cancelled')
          return this.cancelled(ctx, emit)
        }
        if (call.streamError) {
          await this.failStageRow(row.id, call.streamError.code, call.streamError.message)
          emit('council.model.failed', {
            modelRunId: row.id,
            provider: member.provider,
            model: member.model,
            label: member.label,
            error: {
              code: call.streamError.code,
              message: call.streamError.message,
              ...(call.streamError.retryable !== undefined && { retryable: call.streamError.retryable }),
            },
          })
          continue
        }
        const cost = await this.costFor(call.usage, member.provider, member.model)
        await this.stageRepo.updateStatus(row.id, 'completed', {
          payloadJson: {
            kind: 'stage1_answer',
            label: member.label,
            provider: member.provider,
            model: member.model,
            text: call.text,
            ...(call.usage !== undefined && { usage: call.usage }),
            costUsd: cost.costUsd,
            latencyMs,
            ...(call.finishReason !== undefined && { finishReason: call.finishReason }),
          },
        })
        await this.writeUsage(ctx, member.provider, member.model, cost)
        emit('council.model.completed', {
          modelRunId: row.id,
          provider: member.provider,
          model: member.model,
          label: member.label,
        })
        answers.push({
          rowId: row.id,
          label: member.label,
          provider: member.provider,
          model: member.model,
          text: call.text,
          ...(call.usage !== undefined && { usage: call.usage }),
          cost,
          latencyMs,
          ...(call.finishReason !== undefined && { finishReason: call.finishReason }),
        })
      }
      if (answers.length < 2) {
        await failRun('COUNCIL_INSUFFICIENT_RESPONSES', 'Need at least 2 successful responses for peer review')
        return
      }
      emit('council.stage.completed', { stage: 'stage1' })

      // --- Stage 2: anonymized peer review ---
      await this.councilRunRepo.updateStatus(runId, 'stage2')
      emit('council.stage.started', { stage: 'stage2' })
      const shownLabels = answers.map((a) => a.label)
      const rankingPrompt = buildRankingPrompt(
        ctx.query,
        answers.map((a) => ({ label: a.label, text: a.text })),
      )
      const ballots: ParsedBallot[] = []
      for (const member of ctx.members) {
        if (signal.aborted) return this.cancelled(ctx, emit)
        const row = await this.createStageRow(runId, 'stage2', member.provider, member.model)
        emit('council.model.started', {
          modelRunId: row.id,
          provider: member.provider,
          model: member.model,
          label: member.label,
        })
        const startedAt = Date.now()
        const call = await this.callModel(ctx, member, [{ role: 'user', content: rankingPrompt }], signal)
        const latencyMs = Date.now() - startedAt
        if (signal.aborted || call.streamError?.code === 'CANCELLED') {
          await this.stageRepo.updateStatus(row.id, 'cancelled')
          return this.cancelled(ctx, emit)
        }
        if (call.streamError) {
          await this.failStageRow(row.id, call.streamError.code, call.streamError.message)
          emit('council.model.failed', {
            modelRunId: row.id,
            provider: member.provider,
            model: member.model,
            label: member.label,
            error: {
              code: call.streamError.code,
              message: call.streamError.message,
              ...(call.streamError.retryable !== undefined && { retryable: call.streamError.retryable }),
            },
          })
          continue
        }
        const ballot: ParsedBallot = {
          ...parsePeerRanking({ reviewText: call.text, labels: shownLabels, reviewerLabel: member.label }),
          promptTemplateId: COUNCIL_PROMPT_TEMPLATE_ID,
          promptTemplateVersion: COUNCIL_PROMPT_TEMPLATE_VERSION,
        }
        const cost = await this.costFor(call.usage, member.provider, member.model)
        await this.stageRepo.updateStatus(row.id, 'completed', {
          payloadJson: {
            kind: 'stage2_review',
            reviewerLabel: member.label,
            reviewerProvider: member.provider,
            reviewerModel: member.model,
            reviewText: call.text,
            ballot,
            ...(call.usage !== undefined && { usage: call.usage }),
            costUsd: cost.costUsd,
            latencyMs,
          },
        })
        await this.writeUsage(ctx, member.provider, member.model, cost)
        emit('council.model.completed', {
          modelRunId: row.id,
          provider: member.provider,
          model: member.model,
          label: member.label,
        })
        emit('council.ranking.completed', { ballot })
        ballots.push(ballot)
      }
      if (ballots.length === 0) {
        await failRun('COUNCIL_NO_BALLOTS', 'No reviewer produced a ranking')
        return
      }
      emit('council.stage.completed', { stage: 'stage2' })

      // --- Stage 3: aggregation + chairman synthesis ---
      await this.councilRunRepo.updateStatus(runId, 'stage3')
      emit('council.stage.started', { stage: 'stage3' })
      const result: AggregateResult = {
        aggregates: aggregateRankings({ ballots, labels: shownLabels }),
        ballots,
        method: 'borda_plus_average_rank',
      }
      await this.stageRepo.create({
        id: randomUUID(),
        councilRunId: runId,
        stage: 'stage3',
        status: 'completed',
        payloadJson: { kind: 'aggregate', result },
      })
      emit('council.aggregate.completed', { result })

      const byLabel = new Map(answers.map((a) => [a.label, a]))
      const ranked = result.aggregates.map((agg) => {
        const answer = byLabel.get(agg.label)!
        return {
          label: agg.label,
          provider: answer.provider,
          model: answer.model,
          text: answer.text,
          averageRank: agg.averageRank,
        }
      })
      const synthesisPrompt = buildSynthesisPrompt(ctx.query, ranked)
      if (signal.aborted) return this.cancelled(ctx, emit)
      const synthRow = await this.createStageRow(runId, 'stage3', ctx.chairman.provider, ctx.chairman.model)
      emit('council.model.started', {
        modelRunId: synthRow.id,
        provider: ctx.chairman.provider,
        model: ctx.chairman.model,
      })
      const synthStartedAt = Date.now()
      const synth = await this.callModel(
        ctx,
        ctx.chairman,
        [{ role: 'user', content: synthesisPrompt }],
        signal,
        (delta) => emit('council.synthesis.delta', { text: delta }),
      )
      const synthLatencyMs = Date.now() - synthStartedAt
      if (signal.aborted || synth.streamError?.code === 'CANCELLED') {
        await this.stageRepo.updateStatus(synthRow.id, 'cancelled')
        return this.cancelled(ctx, emit)
      }
      if (synth.streamError) {
        await this.failStageRow(synthRow.id, synth.streamError.code, synth.streamError.message)
        emit('council.model.failed', {
          modelRunId: synthRow.id,
          provider: ctx.chairman.provider,
          model: ctx.chairman.model,
          error: {
            code: synth.streamError.code,
            message: synth.streamError.message,
            ...(synth.streamError.retryable !== undefined && { retryable: synth.streamError.retryable }),
          },
        })
        await failRun('COUNCIL_SYNTHESIS_FAILED', 'Chairman synthesis failed')
        return
      }
      const synthCost = await this.costFor(synth.usage, ctx.chairman.provider, ctx.chairman.model)
      await this.stageRepo.updateStatus(synthRow.id, 'completed', {
        payloadJson: {
          kind: 'synthesis',
          text: synth.text,
          ...(synth.usage !== undefined && { usage: synth.usage }),
          costUsd: synthCost.costUsd,
          latencyMs: synthLatencyMs,
          ...(synth.finishReason !== undefined && { finishReason: synth.finishReason }),
        },
      })
      await this.writeUsage(ctx, ctx.chairman.provider, ctx.chairman.model, synthCost)
      emit('council.model.completed', {
        modelRunId: synthRow.id,
        provider: ctx.chairman.provider,
        model: ctx.chairman.model,
      })
      emit('council.stage.completed', { stage: 'stage3' })
      await this.councilRunRepo.updateStatus(runId, 'completed', { completedAt: new Date() })
      emit('council.completed', {})
    } catch (err) {
      try {
        await this.councilRunRepo.updateStatus(runId, 'failed', { completedAt: new Date() })
      } catch {
        // best-effort terminal state
      }
      emit('council.failed', { error: { code: 'INTERNAL_ERROR', message: 'Council execution failed' } })
      console.error(`[council] run ${runId} execution error`, err)
    } finally {
      this.coordinator.finish(runId)
    }
  }

  private async cancelled(
    ctx: ExecuteContext,
    emit: (type: CouncilEventType, data: object) => void,
  ): Promise<void> {
    await this.councilRunRepo.updateStatus(ctx.runId, 'cancelled', { completedAt: new Date() })
    emit('council.cancelled', {})
  }

  private async createStageRow(
    runId: string,
    stage: 'stage1' | 'stage2' | 'stage3',
    provider?: string,
    model?: string,
  ): Promise<CouncilStageResult> {
    const row: NewCouncilStageResult = {
      id: randomUUID(),
      councilRunId: runId,
      stage,
      status: 'running',
      ...(provider !== undefined && { modelProvider: provider }),
      ...(model !== undefined && { modelId: model }),
    }
    return this.stageRepo.create(row)
  }

  private async failStageRow(id: string, code: string, message: string): Promise<void> {
    await this.stageRepo.updateStatus(id, 'failed', {
      payloadJson: { kind: 'failed', error: { code, message } },
    })
  }

  private async callModel(
    ctx: ExecuteContext,
    member: CouncilMember,
    messages: GatewayMessage[],
    signal: AbortSignal,
    onDelta?: (text: string) => void,
  ): Promise<CollectedCall> {
    let providerKey: string
    try {
      const keyRow = await this.providerKeyRepo.findEncrypted(ctx.workspaceId, member.provider)
      if (!keyRow) {
        return {
          text: '',
          streamError: {
            code: 'PROVIDER_KEY_MISSING',
            message: `No provider key configured for ${member.provider}`,
          },
        }
      }
      providerKey = decryptProviderKey(keyRow.encryptedKey, this.encryptionSecret)
    } catch {
      return {
        text: '',
        streamError: { code: 'PROVIDER_KEY_INVALID', message: 'Failed to decrypt provider key' },
      }
    }

    let text = ''
    let usage: NormalizedUsage | undefined
    let finishReason: string | undefined
    let streamError: { code: string; message: string; retryable?: boolean } | undefined

    try {
      const req: LLMGatewayRequest = {
        provider: member.provider,
        model: member.model,
        messages,
        providerKey,
        abortSignal: signal,
      }
      for await (const chunk of this.gateway.stream(req)) {
        if (chunk.type === 'delta') {
          text += chunk.delta
          onDelta?.(chunk.delta)
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
    return { text, ...(usage !== undefined && { usage }), ...(finishReason !== undefined && { finishReason }), ...(streamError !== undefined && { streamError }) }
  }

  private async costFor(
    usage: NormalizedUsage | undefined,
    provider: string,
    model: string,
  ): Promise<CostedUsage> {
    const pricing = await this.modelCatalogRepo.findByProviderModel(provider, model)
    const inputTokens = usage?.inputTokens ?? 0
    const outputTokens = usage?.outputTokens ?? 0
    const totalTokens = usage?.totalTokens ?? inputTokens + outputTokens
    return {
      inputTokens,
      outputTokens,
      totalTokens,
      usageSource: usage ? 'provider' : 'estimated',
      costUsd: pricing
        ? calculateCost(inputTokens, outputTokens, pricing.inputCostPer1m, pricing.outputCostPer1m)
        : '0.000000',
    }
  }

  private async writeUsage(
    ctx: ExecuteContext,
    provider: string,
    model: string,
    cost: CostedUsage,
  ): Promise<void> {
    await this.usageRepo.create({
      workspaceId: ctx.workspaceId,
      userId: ctx.userId,
      provider,
      model,
      inputTokens: cost.inputTokens,
      outputTokens: cost.outputTokens,
      totalTokens: cost.totalTokens,
      usageSource: cost.usageSource,
      costUsd: cost.costUsd,
      ...(ctx.conversationId !== undefined && { conversationId: ctx.conversationId }),
    })
  }
}
