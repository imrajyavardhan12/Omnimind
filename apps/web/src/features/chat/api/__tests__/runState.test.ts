import { describe, it, expect } from 'vitest'
import {
  applyOutputMessageIds,
  initialRunState,
  isRunTerminal,
  reduceStreamEvent,
  resolveModelText,
  type RunState,
} from '../runState'
import type { RunStreamEnvelope } from '../sseClient'

function env(type: RunStreamEnvelope['type'], sequence: number, data: unknown): RunStreamEnvelope {
  return { type, runId: 'r1', sequence, timestamp: 't', data }
}

function apply(start: RunState, ...events: RunStreamEnvelope[]): RunState {
  return events.reduce((s, e) => reduceStreamEvent(s, e), start)
}

describe('reduceStreamEvent', () => {
  it('marks the run running on run.started and records conversation + sequence', () => {
    const next = reduceStreamEvent(initialRunState, env('run.started', 1, { conversationId: 'c1' }))
    expect(next.phase).toBe('running')
    expect(next.conversationId).toBe('c1')
    expect(next.lastSequence).toBe(1)
  })

  it('dedupes events at or below the last applied sequence (no-op, same reference)', () => {
    const afterFirst = reduceStreamEvent(initialRunState, env('run.started', 3, { conversationId: 'c1' }))
    const replay = reduceStreamEvent(afterFirst, env('model.started', 2, { modelRunId: 'm1', provider: 'openai', model: 'gpt-4o' }))
    expect(replay).toBe(afterFirst) // ignored, identical reference
    expect(replay.modelRuns['m1']).toBeUndefined()
  })

  it('treats heartbeats as a no-op without advancing sequence', () => {
    const afterStart = reduceStreamEvent(initialRunState, env('run.started', 1, { conversationId: 'c1' }))
    const afterBeat = reduceStreamEvent(afterStart, env('heartbeat', 0, {}))
    expect(afterBeat).toBe(afterStart)
    expect(afterBeat.lastSequence).toBe(1)
  })

  it('accumulates deltas into the per-model buffer and tracks status', () => {
    const next = apply(
      initialRunState,
      env('run.started', 1, { conversationId: 'c1' }),
      env('model.started', 2, { modelRunId: 'm1', provider: 'openai', model: 'gpt-4o' }),
      env('model.delta', 3, { modelRunId: 'm1', text: 'Hel' }),
      env('model.delta', 4, { modelRunId: 'm1', text: 'lo' }),
      env('model.completed', 5, { modelRunId: 'm1', costUsd: '0.0001', latencyMs: 120, usage: { inputTokens: 4, outputTokens: 2, totalTokens: 6 } }),
      env('run.completed', 6, {}),
    )
    const m = next.modelRuns['m1']!
    expect(m.buffer).toBe('Hello')
    expect(m.status).toBe('completed')
    expect(m.costUsd).toBe('0.0001')
    expect(m.usage?.totalTokens).toBe(6)
    expect(next.phase).toBe('completed')
    expect(isRunTerminal(next.phase)).toBe(true)
  })

  it('preserves model arrival order for stable panel rendering', () => {
    const next = apply(
      initialRunState,
      env('model.started', 1, { modelRunId: 'a', provider: 'openai', model: 'gpt-4o' }),
      env('model.started', 2, { modelRunId: 'b', provider: 'anthropic', model: 'claude' }),
    )
    expect(next.order).toEqual(['a', 'b'])
  })

  it('isolates a model failure — other models and the run are unaffected', () => {
    const next = apply(
      initialRunState,
      env('model.started', 1, { modelRunId: 'm1', provider: 'openai', model: 'gpt-4o' }),
      env('model.failed', 2, { modelRunId: 'm1', error: { code: 'PROVIDER_RATE_LIMITED', message: '429', retryable: true, provider: 'openai' } }),
      env('model.started', 3, { modelRunId: 'm2', provider: 'anthropic', model: 'claude' }),
      env('model.delta', 4, { modelRunId: 'm2', text: 'ok' }),
      env('model.completed', 5, { modelRunId: 'm2' }),
      env('run.completed', 6, {}),
    )
    expect(next.modelRuns['m1']!.status).toBe('failed')
    expect(next.modelRuns['m1']!.error?.code).toBe('PROVIDER_RATE_LIMITED')
    expect(next.modelRuns['m2']!.status).toBe('completed')
    expect(next.modelRuns['m2']!.buffer).toBe('ok')
    expect(next.phase).toBe('completed')
  })

  it('records retry status', () => {
    const next = apply(
      initialRunState,
      env('model.started', 1, { modelRunId: 'm1', provider: 'openai', model: 'gpt-4o' }),
      env('model.retrying', 2, { modelRunId: 'm1', attempt: 2, maxAttempts: 3, delayMs: 500, reason: 'timeout' }),
    )
    expect(next.modelRuns['m1']!.status).toBe('retrying')
    expect(next.modelRuns['m1']!.retry).toEqual({ attempt: 2, maxAttempts: 3, reason: 'timeout' })
  })

  it('sets cancelled status on model.cancelled and run.cancelled', () => {
    const next = apply(
      initialRunState,
      env('model.started', 1, { modelRunId: 'm1', provider: 'openai', model: 'gpt-4o' }),
      env('model.cancelled', 2, { modelRunId: 'm1' }),
      env('run.cancelled', 3, {}),
    )
    expect(next.modelRuns['m1']!.status).toBe('cancelled')
    expect(next.phase).toBe('cancelled')
  })

  it('captures a run-level failure error', () => {
    const next = reduceStreamEvent(initialRunState, env('run.failed', 1, { error: { code: 'ALL_MODELS_FAILED', message: 'all failed' } }))
    expect(next.phase).toBe('failed')
    expect(next.error).toEqual({ code: 'ALL_MODELS_FAILED', message: 'all failed' })
  })
})

describe('applyOutputMessageIds', () => {
  it('maps modelRunId -> outputMessageId onto existing model state', () => {
    const base = reduceStreamEvent(initialRunState, env('model.started', 1, { modelRunId: 'm1', provider: 'openai', model: 'gpt-4o' }))
    const next = applyOutputMessageIds(base, { m1: 'msg-123' })
    expect(next.modelRuns['m1']!.outputMessageId).toBe('msg-123')
  })

  it('returns the same reference when nothing changes', () => {
    const base = reduceStreamEvent(initialRunState, env('model.started', 1, { modelRunId: 'm1', provider: 'openai', model: 'gpt-4o' }))
    const once = applyOutputMessageIds(base, { m1: 'msg-1' })
    const twice = applyOutputMessageIds(once, { m1: 'msg-1' })
    expect(twice).toBe(once)
  })
})

describe('resolveModelText', () => {
  it('prefers the persisted message over the transient buffer (no double render)', () => {
    expect(resolveModelText({ contentText: 'persisted' }, 'streamed')).toBe('persisted')
  })

  it('uses the persisted message even when it is empty (canonical)', () => {
    expect(resolveModelText({ contentText: '' }, 'streamed')).toBe('')
  })

  it('falls back to the buffer when no persisted message exists yet', () => {
    expect(resolveModelText(null, 'streamed')).toBe('streamed')
    expect(resolveModelText(undefined, 'streamed')).toBe('streamed')
  })
})
