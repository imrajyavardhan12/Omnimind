import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { GatewayStreamChunk } from '@omnimind/types'

// --- shared mocks ---
const mockCouncilCreate = vi.fn()
const mockCouncilFindById = vi.fn()
const mockCouncilUpdateStatus = vi.fn().mockResolvedValue(undefined)
const mockStageCreate = vi.fn()
const mockStageFindByCouncilRun = vi.fn().mockResolvedValue([])
const mockStageUpdateStatus = vi.fn().mockResolvedValue(undefined)
const mockConvFindById = vi.fn()
const mockFindEncrypted = vi.fn()
const mockFindByProviderModel = vi.fn()
const mockUsageCreate = vi.fn().mockResolvedValue(undefined)
const mockGatewayStream = vi.fn()

vi.mock('@omnimind/db', async (importOriginal) => {
  const original = await importOriginal<typeof import('@omnimind/db')>()
  return {
    ...original,
    CouncilRunRepository: class {
      create = mockCouncilCreate
      findById = mockCouncilFindById
      updateStatus = mockCouncilUpdateStatus
    },
    CouncilStageResultRepository: class {
      create = mockStageCreate
      findByCouncilRun = mockStageFindByCouncilRun
      updateStatus = mockStageUpdateStatus
    },
    ConversationRepository: class {
      findById = mockConvFindById
    },
    ProviderKeyRepository: class {
      findEncrypted = mockFindEncrypted
    },
    ModelCatalogRepository: class {
      findByProviderModel = mockFindByProviderModel
    },
    UsageLedgerRepository: class {
      create = mockUsageCreate
    },
    ModelCatalogService: class {},
  }
})

vi.mock('@omnimind/ai', async (importOriginal) => {
  const original = await importOriginal<typeof import('@omnimind/ai')>()
  return {
    ...original,
    LLMGateway: class {
      stream = mockGatewayStream
    },
  }
})

vi.mock('../../lib/encryption.js', () => ({
  decryptProviderKey: vi.fn().mockReturnValue('sk-decrypted'),
}))

const { CouncilService } = await import('../council.service.js')
const { RunCoordinator } = await import('../run-coordinator.js')

const FAKE_DB = {} as never
const FAKE_SECRET = 'a'.repeat(64)

function fixtureChunks(chunks: GatewayStreamChunk[]) {
  return async function* () {
    for (const chunk of chunks) yield chunk
  }
}

const baseParams = {
  workspaceId: 'ws-1',
  userId: 'user-1',
  query: 'Which database should we use?',
  councilModels: [
    { provider: 'openai' as const, model: 'gpt-4o' },
    { provider: 'anthropic' as const, model: 'claude-sonnet' },
  ],
  chairmanModel: { provider: 'anthropic' as const, model: 'claude-sonnet' },
}

const REVIEW_B_FIRST =
  'Both are solid. FINAL RANKING:\n1. Response B\n2. Response A'
const REVIEW_A_FIRST =
  'A is more complete. FINAL RANKING:\n1. Response A\n2. Response B'

describe('CouncilService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockCouncilUpdateStatus.mockResolvedValue(undefined)
    mockStageUpdateStatus.mockResolvedValue(undefined)
    mockStageFindByCouncilRun.mockResolvedValue([])
    mockUsageCreate.mockResolvedValue(undefined)
    mockCouncilFindById.mockResolvedValue(undefined)
    mockStageCreate.mockImplementation(async (input: { id: string }) => ({ ...input }))
    mockConvFindById.mockResolvedValue({ id: 'conv-1', workspaceId: 'ws-1' })
    mockFindEncrypted.mockResolvedValue({ encryptedKey: 'enc' })
    mockFindByProviderModel.mockResolvedValue({
      inputCostPer1m: '1.000000',
      outputCostPer1m: '2.000000',
    })
  })

  function happyPathCalls() {
    mockGatewayStream
      .mockImplementationOnce(
        fixtureChunks([
          { type: 'delta', delta: 'Answer A' },
          { type: 'done', usage: { inputTokens: 10, outputTokens: 5, totalTokens: 15 } },
        ]),
      )
      .mockImplementationOnce(
        fixtureChunks([
          { type: 'delta', delta: 'Answer B' },
          { type: 'done', usage: { inputTokens: 10, outputTokens: 6, totalTokens: 16 } },
        ]),
      )
      .mockImplementationOnce(fixtureChunks([{ type: 'delta', delta: REVIEW_B_FIRST }, { type: 'done' }]))
      .mockImplementationOnce(fixtureChunks([{ type: 'delta', delta: REVIEW_A_FIRST }, { type: 'done' }]))
      .mockImplementationOnce(
        fixtureChunks([
          { type: 'delta', delta: 'Final: use Postgres. ' },
          { type: 'delta', delta: 'Both agree.' },
          { type: 'done', usage: { inputTokens: 50, outputTokens: 10, totalTokens: 60 } },
        ]),
      )
  }

  it('runs all three stages: answers, parsed ballots, Borda aggregate, synthesis', async () => {
    happyPathCalls()
    const coordinator = new RunCoordinator()
    // Spy on publish (not subscribe): startRun returns after the first emits
    // are already queued, so only a publish spy sees the full lifecycle.
    const published: { type: string; data: unknown }[] = []
    const origPublish = coordinator.publish.bind(coordinator)
    coordinator.publish = (runId: string, env) => {
      published.push({ type: env.type, data: env.data })
      return origPublish(runId, env)
    }
    const service = new CouncilService(FAKE_DB, FAKE_SECRET, coordinator)
    const result = await service.startRun(baseParams)
    await result.completion

    // Run row created with the query + chairman, then staged to completion.
    expect(mockCouncilCreate).toHaveBeenCalledTimes(1)
    expect(mockCouncilCreate.mock.calls[0]![0]).toMatchObject({
      query: baseParams.query,
      chairmanProvider: 'anthropic',
      chairmanModel: 'claude-sonnet',
      status: 'queued',
    })
    expect(mockCouncilUpdateStatus).toHaveBeenCalledWith(result.runId, 'completed', expect.any(Object))

    // Stage rows: 2 answers + 2 reviews + 1 aggregate + 1 synthesis.
    const createdStages = mockStageCreate.mock.calls.map((call) => call[0].stage as string)
    expect(createdStages).toEqual(['stage1', 'stage1', 'stage2', 'stage2', 'stage3', 'stage3'])

    // Ballots parsed (not fallback) and versioned.
    const rankingUpdates = mockStageUpdateStatus.mock.calls.filter(
      (call) => (call[2] as { payloadJson?: { kind?: string } })?.payloadJson?.kind === 'stage2_review',
    )
    expect(rankingUpdates).toHaveLength(2)
    for (const call of rankingUpdates) {
      const ballot = (call[2] as { payloadJson: { ballot: { parseStatus: string; promptTemplateId: string } } })
        .payloadJson.ballot
      expect(ballot.parseStatus).toBe('parsed')
      expect(ballot.promptTemplateId).toBe('council-v1')
    }

    // Aggregate row: tied Borda (N=2: rank1=1pt; A: 0+1, B: 1+0) → display-order winner A.
    const aggregateCreate = mockStageCreate.mock.calls.find(
      (call) => (call[0] as { payloadJson?: { kind?: string } }).payloadJson?.kind === 'aggregate',
    )
    expect(aggregateCreate).toBeDefined()
    const aggregates = (
      aggregateCreate![0] as { payloadJson: { result: { aggregates: { label: string; bordaPoints: number }[] } } }
    ).payloadJson.result.aggregates
    expect(aggregates).toMatchObject([
      { label: 'A', bordaPoints: 1, averageRank: 1.5, reviewCount: 2 },
      { label: 'B', bordaPoints: 1, averageRank: 1.5, reviewCount: 2 },
    ])

    // Usage ledger: one row per successful model call (2 + 2 + 1).
    expect(mockUsageCreate).toHaveBeenCalledTimes(5)

    // Event stream carries the full lifecycle, synthesis deltas included.
    const types = published.map((e) => e.type)
    expect(types[0]).toBe('council.started')
    expect(types).toContain('council.stage.started')
    expect(types.filter((t) => t === 'council.model.completed')).toHaveLength(5)
    expect(types.filter((t) => t === 'council.ranking.completed')).toHaveLength(2)
    expect(types).toContain('council.aggregate.completed')
    expect(types.filter((t) => t === 'council.synthesis.delta')).toHaveLength(2)
    expect(types[types.length - 1]).toBe('council.completed')
  })

  it('fails the run when fewer than 2 stage-1 answers succeed', async () => {
    mockGatewayStream.mockImplementation(
      fixtureChunks([{ type: 'error', error: { code: 'PROVIDER_RATE_LIMITED', message: 'slow down' } }]),
    )
    const coordinator = new RunCoordinator()
    const service = new CouncilService(FAKE_DB, FAKE_SECRET, coordinator)
    const result = await service.startRun(baseParams)
    const events: string[] = []
    coordinator.subscribe(result.runId, (env) => events.push(env.type))
    await result.completion

    expect(mockCouncilUpdateStatus).toHaveBeenCalledWith(result.runId, 'failed', expect.any(Object))
    expect(events[events.length - 1]).toBe('council.failed')
    // No reviewer calls happened.
    expect(mockGatewayStream).toHaveBeenCalledTimes(2)
    expect(mockUsageCreate).not.toHaveBeenCalled()
  })

  it('fails the run when no reviewer produces a ballot', async () => {
    mockGatewayStream
      .mockImplementationOnce(fixtureChunks([{ type: 'delta', delta: 'Answer A' }, { type: 'done' }]))
      .mockImplementationOnce(fixtureChunks([{ type: 'delta', delta: 'Answer B' }, { type: 'done' }]))
      .mockImplementation(
        fixtureChunks([{ type: 'error', error: { code: 'PROVIDER_TIMEOUT', message: 'timed out' } }]),
      )
    const service = new CouncilService(FAKE_DB, FAKE_SECRET, new RunCoordinator())
    const result = await service.startRun(baseParams)
    await result.completion

    expect(mockCouncilUpdateStatus).toHaveBeenCalledWith(result.runId, 'failed', expect.any(Object))
  })

  it('cancels mid-run and marks the run cancelled', async () => {
    let releaseStream!: () => void
    const gate = new Promise<void>((resolve) => {
      releaseStream = resolve
    })
    mockGatewayStream.mockImplementation(async function* (req: { abortSignal?: AbortSignal }) {
      yield { type: 'delta', delta: 'partial' } as GatewayStreamChunk
      await gate
      if (req.abortSignal?.aborted) {
        yield { type: 'error', error: { code: 'CANCELLED', message: 'aborted' } } as GatewayStreamChunk
        return
      }
      yield { type: 'done' } as GatewayStreamChunk
    })

    const coordinator = new RunCoordinator()
    const service = new CouncilService(FAKE_DB, FAKE_SECRET, coordinator)
    const result = await service.startRun(baseParams)
    const events: string[] = []
    coordinator.subscribe(result.runId, (env) => events.push(env.type))

    await new Promise((r) => setTimeout(r, 0))
    mockCouncilFindById.mockResolvedValue({ id: result.runId, workspaceId: 'ws-1', status: 'stage1' })
    const cancelResult = await service.cancelRun({ runId: result.runId, workspaceId: 'ws-1' })
    expect(cancelResult.status).toBe('cancelled')
    releaseStream()
    await result.completion

    expect(mockCouncilUpdateStatus).toHaveBeenCalledWith(result.runId, 'cancelled', expect.any(Object))
    expect(events[events.length - 1]).toBe('council.cancelled')
  })

  it('throws CONVERSATION_NOT_FOUND for an unknown conversation', async () => {
    mockConvFindById.mockResolvedValue(undefined)
    const service = new CouncilService(FAKE_DB, FAKE_SECRET, new RunCoordinator())
    await expect(
      service.startRun({ ...baseParams, conversationId: 'missing' }),
    ).rejects.toMatchObject({ code: 'CONVERSATION_NOT_FOUND' })
    expect(mockCouncilCreate).not.toHaveBeenCalled()
  })

  it('throws COUNCIL_RUN_NOT_FOUND for cross-workspace reads', async () => {
    mockCouncilFindById.mockResolvedValue({ id: 'c1', workspaceId: 'ws-other', status: 'completed' })
    const service = new CouncilService(FAKE_DB, FAKE_SECRET, new RunCoordinator())
    await expect(service.getRun({ runId: 'c1', workspaceId: 'ws-1' })).rejects.toMatchObject({
      code: 'COUNCIL_RUN_NOT_FOUND',
    })
  })
})
