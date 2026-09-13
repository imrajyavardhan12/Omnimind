import type {
  AggregateResult,
  CouncilRunStatus,
  CouncilStartedData,
  CouncilStage,
  ParsedBallot,
} from '@omnimind/types'
import type { CouncilRunDto, CouncilStageResultDto } from './councilApi'

export interface CouncilStreamEnvelope {
  type: string
  runId: string
  sequence: number
  timestamp: string
  data: unknown
}

export type CouncilPanelStatus = 'idle' | 'queued' | 'running' | 'completed' | 'failed' | 'cancelled'

export interface AnswerPanel {
  rowId: string
  label: string
  provider: string
  model: string
  status: CouncilPanelStatus
  /** Persisted answer text — set only by detail load (events carry none). */
  text?: string
  error?: { code: string; message: string }
}

export interface ReviewPanel {
  rowId: string
  reviewerLabel: string
  provider: string
  model: string
  status: CouncilPanelStatus
  ballot?: ParsedBallot
  error?: { code: string; message: string }
}

/** `idle` before submit, `creating` while POST is in flight, then the run status. */
export type CouncilPhase = 'idle' | 'creating' | CouncilRunStatus

export interface CouncilState {
  runId?: string
  query?: string
  chairmanProvider?: string
  chairmanModel?: string
  phase: CouncilPhase
  /** Current stage from `council.stage.started` (null before the first one). */
  stage: CouncilStage | null
  answers: Record<string, AnswerPanel>
  answerOrder: string[]
  reviews: Record<string, ReviewPanel>
  reviewOrder: string[]
  aggregate?: AggregateResult
  /** Transient chairman text; superseded by persisted synthesis on detail load. */
  synthesisBuffer: string
  synthesisRowId?: string
  synthesisDone: boolean
  lastSequence: number
  error?: { code: string; message: string }
}

export const initialCouncilState: CouncilState = {
  phase: 'idle',
  stage: null,
  answers: {},
  answerOrder: [],
  reviews: {},
  reviewOrder: [],
  synthesisBuffer: '',
  synthesisDone: false,
  lastSequence: 0,
}

export const COUNCIL_TERMINAL_PHASES: ReadonlySet<CouncilPhase> = new Set<CouncilPhase>([
  'completed',
  'failed',
  'cancelled',
])

export function isCouncilTerminal(phase: CouncilPhase): boolean {
  return COUNCIL_TERMINAL_PHASES.has(phase)
}

function labelAt(index: number): string {
  return String.fromCharCode(65 + index)
}

/**
 * Apply a single council stream envelope. Pure and immutable like the chat
 * run-state reducer: same-reference return on no-ops/duplicates, sequence
 * dedupe (replay/live overlap), panels created on first modelRunId reference.
 *
 * Panel routing: stage-3 chairman rows carry no label; stage-2 reviewer rows
 * are distinguished from stage-1 answer rows by the current stage (events are
 * ordered, so `council.stage.started` always precedes its model events).
 */
export function reduceCouncilEvent(state: CouncilState, env: CouncilStreamEnvelope): CouncilState {
  if (env.type === 'heartbeat') return state
  if (env.sequence <= state.lastSequence) return state

  const lastSequence = env.sequence
  const data = (env.data ?? {}) as Record<string, unknown>

  switch (env.type) {
    case 'council.started':
      // Queued phase persists until the first `council.stage.started` — there
      // is no 'running' in the council lifecycle (queued/stage1/2/3/terminal).
      return { ...state, lastSequence }

    case 'council.stage.started': {
      const stage = (data as CouncilStartedData & { stage: CouncilStage }).stage
      return { ...state, stage, lastSequence }
    }
    case 'council.stage.completed':
      return { ...state, lastSequence }

    case 'council.model.started': {
      const rowId = data['modelRunId'] as string
      const provider = data['provider'] as string
      const model = data['model'] as string
      const label = data['label'] as string | undefined
      if (!rowId) return { ...state, lastSequence }
      if (label === undefined) {
        return { ...state, synthesisRowId: rowId, lastSequence }
      }
      if (state.stage === 'stage2') {
        if (state.reviews[rowId]) return { ...state, lastSequence }
        return {
          ...state,
          lastSequence,
          reviews: {
            ...state.reviews,
            [rowId]: { rowId, reviewerLabel: label, provider, model, status: 'running' },
          },
          reviewOrder: [...state.reviewOrder, rowId],
        }
      }
      if (state.answers[rowId]) return { ...state, lastSequence }
      return {
        ...state,
        lastSequence,
        answers: {
          ...state.answers,
          [rowId]: { rowId, label, provider, model, status: 'running' },
        },
        answerOrder: [...state.answerOrder, rowId],
      }
    }

    case 'council.model.completed': {
      const rowId = data['modelRunId'] as string
      if (!rowId) return { ...state, lastSequence }
      if (state.synthesisRowId === rowId) {
        return { ...state, synthesisDone: true, lastSequence }
      }
      if (state.answers[rowId]) {
        return {
          ...state,
          lastSequence,
          answers: { ...state.answers, [rowId]: { ...state.answers[rowId]!, status: 'completed' } },
        }
      }
      if (state.reviews[rowId]) {
        return {
          ...state,
          lastSequence,
          reviews: { ...state.reviews, [rowId]: { ...state.reviews[rowId]!, status: 'completed' } },
        }
      }
      return { ...state, lastSequence }
    }

    case 'council.model.failed': {
      const rowId = data['modelRunId'] as string
      const error = (data['error'] ?? {}) as { code?: string; message?: string }
      const entry = {
        code: error.code ?? 'UNKNOWN_PROVIDER_ERROR',
        message: error.message ?? 'Model run failed',
      }
      if (!rowId) return { ...state, lastSequence, error: entry }
      if (state.answers[rowId]) {
        return {
          ...state,
          lastSequence,
          answers: { ...state.answers, [rowId]: { ...state.answers[rowId]!, status: 'failed', error: entry } },
        }
      }
      if (state.reviews[rowId]) {
        return {
          ...state,
          lastSequence,
          reviews: { ...state.reviews, [rowId]: { ...state.reviews[rowId]!, status: 'failed', error: entry } },
        }
      }
      return { ...state, lastSequence, error: entry }
    }

    case 'council.ranking.completed': {
      const ballot = (data as { ballot?: ParsedBallot }).ballot
      if (!ballot) return { ...state, lastSequence }
      const rowId = state.reviewOrder.find((id) => state.reviews[id]?.reviewerLabel === ballot.reviewerLabel)
      if (!rowId) return { ...state, lastSequence }
      return {
        ...state,
        lastSequence,
        reviews: { ...state.reviews, [rowId]: { ...state.reviews[rowId]!, ballot } },
      }
    }

    case 'council.aggregate.completed': {
      const result = (data as { result?: AggregateResult }).result
      return { ...state, ...(result !== undefined && { aggregate: result }), lastSequence }
    }

    case 'council.synthesis.delta': {
      const text = (data as { text?: unknown }).text
      if (typeof text !== 'string' || text.length === 0) return { ...state, lastSequence }
      return { ...state, synthesisBuffer: state.synthesisBuffer + text, lastSequence }
    }

    case 'council.completed':
      return { ...state, phase: 'completed', synthesisDone: true, lastSequence }
    case 'council.cancelled':
      return { ...state, phase: 'cancelled', lastSequence }
    case 'council.failed': {
      const error = (data as { error?: { code?: string; message?: string } }).error
      return {
        ...state,
        phase: 'failed',
        lastSequence,
        ...(error && { error: { code: error.code ?? 'COUNCIL_RUN_FAILED', message: error.message ?? 'Council run failed' } }),
      }
    }

    default:
      return { ...state, lastSequence }
  }
}

/**
 * Rebuild state from GET detail (server truth). Used on terminal events, on
 * per-stage completion (content has no live deltas except synthesis), and on
 * demand (refresh/reconnect). Panels for failed/cancelled rows without a
 * payload fall back to positional labels: the orchestrator creates stage rows
 * sequentially in member order, so creation order == label order.
 */
export function loadCouncilDetail(run: CouncilRunDto, stageResults: CouncilStageResultDto[]): CouncilState {
  const answers: Record<string, AnswerPanel> = {}
  const answerOrder: string[] = []
  const reviews: Record<string, ReviewPanel> = {}
  const reviewOrder: string[] = []
  let aggregate: AggregateResult | undefined
  let synthesisBuffer = ''
  let synthesisRowId: string | undefined
  let synthesisDone = false

  const byStage = (stage: CouncilStage) =>
    stageResults
      .filter((r) => r.stage === stage)
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt))

  byStage('stage1').forEach((row, index) => {
    const payload = row.payloadJson
    const label =
      payload?.kind === 'stage1_answer' ? payload.label : (labelAt(index) ?? `?${index}`)
    answers[row.id] = {
      rowId: row.id,
      label,
      provider: row.modelProvider ?? 'unknown',
      model: row.modelId ?? 'unknown',
      status: row.status,
      ...(payload?.kind === 'stage1_answer' && { text: payload.text }),
      ...(payload?.kind === 'failed' && { error: payload.error }),
    }
    answerOrder.push(row.id)
  })

  byStage('stage2').forEach((row, index) => {
    const payload = row.payloadJson
    const reviewerLabel =
      payload?.kind === 'stage2_review' ? payload.reviewerLabel : (labelAt(index) ?? `?${index}`)
    reviews[row.id] = {
      rowId: row.id,
      reviewerLabel,
      provider: row.modelProvider ?? 'unknown',
      model: row.modelId ?? 'unknown',
      status: row.status,
      ...(payload?.kind === 'stage2_review' && { ballot: payload.ballot }),
      ...(payload?.kind === 'failed' && { error: payload.error }),
    }
    reviewOrder.push(row.id)
  })

  for (const row of byStage('stage3')) {
    const payload = row.payloadJson
    if (payload?.kind === 'aggregate') {
      aggregate = payload.result
    } else if (payload?.kind === 'synthesis') {
      synthesisBuffer = payload.text
      synthesisRowId = row.id
      synthesisDone = row.status === 'completed'
    }
  }

  const terminal = isCouncilTerminal(run.status)
  const stagesPresent = (['stage1', 'stage2', 'stage3'] as CouncilStage[]).filter(
    (s) => byStage(s).length > 0,
  )
  return {
    runId: run.id,
    query: run.query,
    chairmanProvider: run.chairmanProvider,
    chairmanModel: run.chairmanModel,
    phase: run.status,
    // Live statuses ARE the stage; terminal runs show the furthest reached one.
    stage:
      run.status === 'queued'
        ? null
        : terminal
          ? (stagesPresent[stagesPresent.length - 1] ?? 'stage1')
          : (run.status as CouncilStage),
    answers,
    answerOrder,
    reviews,
    reviewOrder,
    ...(aggregate !== undefined && { aggregate }),
    synthesisBuffer,
    ...(synthesisRowId !== undefined && { synthesisRowId }),
    synthesisDone,
    lastSequence: 0,
  }
}
