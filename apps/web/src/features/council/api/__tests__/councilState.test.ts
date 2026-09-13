import { describe, it, expect } from 'vitest'
import {
  initialCouncilState,
  isCouncilTerminal,
  loadCouncilDetail,
  reduceCouncilEvent,
  type CouncilState,
  type CouncilStreamEnvelope,
} from '../councilState'
import type { CouncilRunDto, CouncilStageResultDto } from '../councilApi'

function env(seq: number, type: string, data: unknown = {}): CouncilStreamEnvelope {
  return { type, runId: 'c1', sequence: seq, timestamp: new Date().toISOString(), data }
}

function reduceAll(types: { type: string; data?: unknown }[]): CouncilState {
  let state = initialCouncilState
  types.forEach((t, i) => {
    state = reduceCouncilEvent(state, env(i + 1, t.type, t.data ?? {}))
  })
  return state
}

describe('reduceCouncilEvent', () => {
  it('runs the full lifecycle: started, stages, panels, ballot, aggregate, synthesis, completed', () => {
    const state = reduceAll([
      { type: 'council.started', data: { conversationId: null, councilSize: 2 } },
      { type: 'council.stage.started', data: { stage: 'stage1' } },
      { type: 'council.model.started', data: { modelRunId: 'r-a', provider: 'openai', model: 'gpt-4o', label: 'A' } },
      { type: 'council.model.completed', data: { modelRunId: 'r-a', provider: 'openai', model: 'gpt-4o', label: 'A' } },
      { type: 'council.stage.completed', data: { stage: 'stage1' } },
      { type: 'council.stage.started', data: { stage: 'stage2' } },
      { type: 'council.model.started', data: { modelRunId: 'r-r', provider: 'openai', model: 'gpt-4o', label: 'A' } },
      {
        type: 'council.ranking.completed',
        data: {
          ballot: { reviewerLabel: 'A', entries: [{ label: 'A', rank: 1 }], parseStatus: 'parsed' },
        },
      },
      { type: 'council.model.completed', data: { modelRunId: 'r-r', provider: 'openai', model: 'gpt-4o', label: 'A' } },
      { type: 'council.stage.completed', data: { stage: 'stage2' } },
      { type: 'council.stage.started', data: { stage: 'stage3' } },
      {
        type: 'council.aggregate.completed',
        data: { result: { aggregates: [], ballots: [], method: 'borda_plus_average_rank' } },
      },
      { type: 'council.model.started', data: { modelRunId: 'r-s', provider: 'anthropic', model: 'claude-sonnet' } },
      { type: 'council.synthesis.delta', data: { text: 'Final: ' } },
      { type: 'council.synthesis.delta', data: { text: 'Postgres.' } },
      { type: 'council.model.completed', data: { modelRunId: 'r-s', provider: 'anthropic', model: 'claude-sonnet' } },
      { type: 'council.completed' },
    ])

    expect(state.phase).toBe('completed')
    expect(state.stage).toBe('stage3')
    expect(state.answerOrder).toEqual(['r-a'])
    expect(state.answers['r-a']).toMatchObject({ label: 'A', status: 'completed' })
    expect(state.reviews['r-r']?.ballot?.parseStatus).toBe('parsed')
    expect(state.aggregate?.method).toBe('borda_plus_average_rank')
    expect(state.synthesisBuffer).toBe('Final: Postgres.')
    expect(state.synthesisDone).toBe(true)
    expect(isCouncilTerminal(state.phase)).toBe(true)
  })

  it('routes labelled stage-2 rows to reviews, not answers', () => {
    const state = reduceAll([
      { type: 'council.started' },
      { type: 'council.stage.started', data: { stage: 'stage2' } },
      { type: 'council.model.started', data: { modelRunId: 'r-x', provider: 'openai', model: 'gpt-4o', label: 'B' } },
    ])
    expect(state.answerOrder).toEqual([])
    expect(state.reviews['r-x']).toMatchObject({ reviewerLabel: 'B', status: 'running' })
  })

  it('isolates a model failure without failing the run', () => {
    const state = reduceAll([
      { type: 'council.started' },
      { type: 'council.stage.started', data: { stage: 'stage1' } },
      { type: 'council.model.started', data: { modelRunId: 'r-a', provider: 'openai', model: 'gpt-4o', label: 'A' } },
      {
        type: 'council.model.failed',
        data: { modelRunId: 'r-a', provider: 'openai', model: 'gpt-4o', label: 'A', error: { code: 'PROVIDER_RATE_LIMITED', message: 'slow' } },
      },
    ])
    expect(state.phase).not.toBe('failed')
    expect(state.phase).not.toBe('cancelled')
    expect(state.answers['r-a']).toMatchObject({ status: 'failed', error: { code: 'PROVIDER_RATE_LIMITED' } })
  })

  it('dedupes by sequence and ignores heartbeats', () => {
    let state = reduceCouncilEvent(initialCouncilState, env(1, 'council.started'))
    const again = reduceCouncilEvent(state, env(1, 'council.started'))
    expect(again).toBe(state)
    const hb = reduceCouncilEvent(state, env(0, 'heartbeat'))
    expect(hb).toBe(state)
    const older = reduceCouncilEvent(
      reduceCouncilEvent(state, env(2, 'council.stage.started', { stage: 'stage1' })),
      env(1, 'council.started'),
    )
    expect(older.stage).toBe('stage1')
  })

  it('marks the run failed with the server error', () => {
    const state = reduceAll([
      { type: 'council.started' },
      { type: 'council.failed', data: { error: { code: 'COUNCIL_NO_BALLOTS', message: 'empty' } } },
    ])
    expect(state.phase).toBe('failed')
    expect(state.error).toEqual({ code: 'COUNCIL_NO_BALLOTS', message: 'empty' })
  })

  it('ignores unknown event types without losing sequence', () => {
    const state = reduceAll([
      { type: 'council.started' },
      { type: 'council.something.new', data: { foo: 1 } },
      { type: 'council.stage.started', data: { stage: 'stage1' } },
    ])
    expect(state.stage).toBe('stage1')
    expect(state.lastSequence).toBe(3)
  })
})

describe('loadCouncilDetail', () => {
  const run: CouncilRunDto = {
    id: 'c1',
    workspaceId: 'ws-1',
    conversationId: null,
    query: 'Which DB?',
    chairmanProvider: 'anthropic',
    chairmanModel: 'claude-sonnet',
    status: 'completed',
    startedAt: null,
    completedAt: null,
    createdAt: new Date().toISOString(),
  }

  function row(over: Partial<CouncilStageResultDto> & { id: string }): CouncilStageResultDto {
    return {
      councilRunId: 'c1',
      stage: 'stage1',
      modelProvider: 'openai',
      modelId: 'gpt-4o',
      payloadJson: null,
      status: 'completed',
      createdAt: new Date().toISOString(),
      ...over,
    }
  }

  it('rebuilds answers, reviews, aggregate, and synthesis from rows', () => {
    const state = loadCouncilDetail(run, [
      row({
        id: 'r-a',
        payloadJson: { kind: 'stage1_answer', label: 'A', provider: 'openai', model: 'gpt-4o', text: 'Answer A', costUsd: '0.000001', latencyMs: 5 },
      }),
      row({
        id: 'r-r',
        stage: 'stage2',
        payloadJson: {
          kind: 'stage2_review',
          reviewerLabel: 'A',
          reviewerProvider: 'openai',
          reviewerModel: 'gpt-4o',
          reviewText: 'good',
          ballot: { reviewerLabel: 'A', entries: [{ label: 'A', rank: 1 }], parseStatus: 'parsed' },
          costUsd: '0.000001',
          latencyMs: 5,
        },
      }),
      row({ id: 'r-g', stage: 'stage3', modelProvider: null, modelId: null, payloadJson: { kind: 'aggregate', result: { aggregates: [], ballots: [], method: 'borda_plus_average_rank' } } }),
      row({
        id: 'r-s',
        stage: 'stage3',
        modelProvider: 'anthropic',
        modelId: 'claude-sonnet',
        payloadJson: { kind: 'synthesis', text: 'Final answer', costUsd: '0.000002', latencyMs: 9 },
      }),
    ])

    expect(state.phase).toBe('completed')
    expect(state.query).toBe('Which DB?')
    expect(state.answerOrder).toEqual(['r-a'])
    expect(state.reviews['r-r']?.ballot?.parseStatus).toBe('parsed')
    expect(state.aggregate?.method).toBe('borda_plus_average_rank')
    expect(state.synthesisBuffer).toBe('Final answer')
    expect(state.synthesisDone).toBe(true)
    expect(state.stage).toBe('stage3')
  })

  it('falls back to positional labels for rows without payloads', () => {
    const failedRun = { ...run, status: 'failed' as const }
    const state = loadCouncilDetail(failedRun, [
      row({ id: 'r-a', status: 'failed', payloadJson: { kind: 'failed', error: { code: 'X', message: 'boom' } } }),
      row({ id: 'r-b', status: 'cancelled', payloadJson: null }),
    ])
    expect(state.answers['r-a']).toMatchObject({ label: 'A', status: 'failed', error: { code: 'X' } })
    expect(state.answers['r-b']).toMatchObject({ label: 'B', status: 'cancelled' })
    expect(state.phase).toBe('failed')
    expect(state.stage).toBe('stage1')
  })
})
