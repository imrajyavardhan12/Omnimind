import type {
  ChatModelRunStatus,
  ChatRunStatus,
  ModelCompletedData,
  ModelDeltaData,
  ModelFailedData,
  ModelQueuedData,
  ModelRetryingData,
  ModelStartedData,
  NormalizedUsage,
  RunFailedData,
  RunStartedData,
} from '@omnimind/types'
import type { RunStreamEnvelope } from './sseClient'

/** Panel state per 09-streaming-protocol.md (`idle` before the first event). */
export type ModelPanelStatus = 'idle' | ChatModelRunStatus

export interface ModelRunState {
  modelRunId: string
  provider?: string
  model?: string
  status: ModelPanelStatus
  /**
   * Transient streamed text. This is superseded by — never shown alongside —
   * the persisted assistant message once it is available in the query cache.
   * See `resolveModelText`.
   */
  buffer: string
  error?: { code: string; message: string; retryable?: boolean; provider?: string }
  usage?: NormalizedUsage
  costUsd?: string
  latencyMs?: number
  finishReason?: string
  retry?: { attempt: number; maxAttempts: number; reason: string }
  /** Set after the run terminates (from GET /:runId modelRuns). */
  outputMessageId?: string
}

/** `idle` before submit, `creating` while POST is in flight, then the run status. */
export type RunPhase = 'idle' | 'creating' | ChatRunStatus

export interface RunState {
  runId?: string
  conversationId?: string
  phase: RunPhase
  /** Per-model state keyed by modelRunId. */
  modelRuns: Record<string, ModelRunState>
  /** modelRunId insertion order, for stable panel rendering. */
  order: string[]
  /** Highest applied sequence number; used to dedupe replayed/live overlap. */
  lastSequence: number
  /** Run-level (non-model) error, e.g. run.failed or a system error event. */
  error?: { code: string; message: string }
}

export const initialRunState: RunState = {
  phase: 'idle',
  modelRuns: {},
  order: [],
  lastSequence: 0,
}

function emptyModel(modelRunId: string): ModelRunState {
  return { modelRunId, status: 'idle', buffer: '' }
}

/**
 * Apply a single stream envelope to the run state.
 *
 * - Pure and immutable: returns a new state (or the same reference when the
 *   event is a no-op / duplicate), so it is safe inside `useReducer`.
 * - Dedupes by sequence: any non-heartbeat event whose sequence is <= the last
 *   applied sequence is ignored (replay/live overlap). Heartbeats carry
 *   sequence 0 and are always a no-op.
 * - Model events create panel state on first reference to a modelRunId,
 *   preserving arrival order.
 */
export function reduceStreamEvent(state: RunState, env: RunStreamEnvelope): RunState {
  if (env.type === 'heartbeat') return state
  if (env.sequence <= state.lastSequence) return state

  const lastSequence = env.sequence

  switch (env.type) {
    case 'run.started': {
      const data = env.data as RunStartedData
      return { ...state, phase: 'running', conversationId: data.conversationId, lastSequence }
    }
    case 'run.completed':
      return { ...state, phase: 'completed', lastSequence }
    case 'run.cancelled':
      return { ...state, phase: 'cancelled', lastSequence }
    case 'run.failed': {
      const data = env.data as RunFailedData
      return {
        ...state,
        phase: 'failed',
        lastSequence,
        ...(data.error && { error: { code: data.error.code, message: data.error.message } }),
      }
    }
    case 'model.queued': {
      const data = env.data as ModelQueuedData
      return patchModel(state, data.modelRunId, lastSequence, (m) => ({
        ...m,
        provider: data.provider,
        model: data.model,
        status: 'queued',
      }))
    }
    case 'model.started': {
      const data = env.data as ModelStartedData
      return patchModel(state, data.modelRunId, lastSequence, (m) => ({
        ...m,
        provider: data.provider,
        model: data.model,
        status: 'running',
      }))
    }
    case 'model.delta': {
      const data = env.data as ModelDeltaData
      return patchModel(state, data.modelRunId, lastSequence, (m) => ({
        ...m,
        status: m.status === 'idle' || m.status === 'queued' ? 'running' : m.status,
        buffer: m.buffer + data.text,
      }))
    }
    case 'model.retrying': {
      const data = env.data as ModelRetryingData
      return patchModel(state, data.modelRunId, lastSequence, (m) => ({
        ...m,
        status: 'retrying',
        retry: { attempt: data.attempt, maxAttempts: data.maxAttempts, reason: data.reason },
      }))
    }
    case 'model.completed': {
      const data = env.data as ModelCompletedData
      return patchModel(state, data.modelRunId, lastSequence, (m) => ({
        ...m,
        status: 'completed',
        ...(data.usage && { usage: data.usage }),
        ...(data.costUsd !== undefined && { costUsd: data.costUsd }),
        ...(data.latencyMs !== undefined && { latencyMs: data.latencyMs }),
        ...(data.finishReason !== undefined && { finishReason: data.finishReason }),
      }))
    }
    case 'model.failed': {
      const data = env.data as ModelFailedData
      return patchModel(state, data.modelRunId, lastSequence, (m) => ({
        ...m,
        status: 'failed',
        error: {
          code: data.error.code,
          message: data.error.message,
          ...(data.error.retryable !== undefined && { retryable: data.error.retryable }),
          ...(data.error.provider !== undefined && { provider: data.error.provider }),
        },
      }))
    }
    case 'model.cancelled': {
      const data = env.data as { modelRunId: string }
      return patchModel(state, data.modelRunId, lastSequence, (m) => ({ ...m, status: 'cancelled' }))
    }
    case 'usage.updated':
      // Run-level usage roll-up is rendered per model; nothing to store here yet.
      return { ...state, lastSequence }
    case 'error': {
      const data = env.data as { code: string; message: string }
      return { ...state, lastSequence, error: { code: data.code, message: data.message } }
    }
    default:
      return { ...state, lastSequence }
  }
}

function patchModel(
  state: RunState,
  modelRunId: string,
  lastSequence: number,
  patch: (m: ModelRunState) => ModelRunState,
): RunState {
  const existing = state.modelRuns[modelRunId] ?? emptyModel(modelRunId)
  const isNew = state.modelRuns[modelRunId] === undefined
  return {
    ...state,
    lastSequence,
    modelRuns: { ...state.modelRuns, [modelRunId]: patch(existing) },
    order: isNew ? [...state.order, modelRunId] : state.order,
  }
}

/** Apply the `modelRunId -> outputMessageId` map from GET /:runId after terminal. */
export function applyOutputMessageIds(
  state: RunState,
  map: Record<string, string>,
): RunState {
  let changed = false
  const modelRuns = { ...state.modelRuns }
  for (const [modelRunId, outputMessageId] of Object.entries(map)) {
    const existing = modelRuns[modelRunId]
    if (existing && existing.outputMessageId !== outputMessageId) {
      modelRuns[modelRunId] = { ...existing, outputMessageId }
      changed = true
    }
  }
  return changed ? { ...state, modelRuns } : state
}

/**
 * The reconciliation invariant (09-streaming-protocol.md "Client Rendering"):
 * show the persisted assistant message if it exists in the cache, otherwise the
 * transient streamed buffer — never both, never neither. The persisted message
 * supersedes the buffer; it is not deleted by the terminal event.
 */
export function resolveModelText(
  persisted: { contentText: string } | null | undefined,
  buffer: string,
): string {
  return persisted ? persisted.contentText : buffer
}

export const RUN_TERMINAL_PHASES: ReadonlySet<RunPhase> = new Set<RunPhase>([
  'completed',
  'failed',
  'cancelled',
])

export function isRunTerminal(phase: RunPhase): boolean {
  return RUN_TERMINAL_PHASES.has(phase)
}
