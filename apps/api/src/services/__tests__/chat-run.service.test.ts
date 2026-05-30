import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { GatewayStreamChunk } from '@omnimind/types'

// --- shared repo mocks ---
const mockFindByIdem = vi.fn()
const mockRunFindById = vi.fn()
const mockReleaseIdem = vi.fn().mockResolvedValue(undefined)
const mockRunUpdateStatus = vi.fn().mockResolvedValue(undefined)
const mockModelUpdateStatus = vi.fn().mockResolvedValue(undefined)
const mockModelFindByChatRun = vi.fn().mockResolvedValue([])
const mockEventCreate = vi.fn().mockResolvedValue(undefined)
const mockCreateRunSetup = vi.fn().mockResolvedValue(undefined)
const mockCompleteModelRun = vi.fn().mockResolvedValue(undefined)
const mockConvFindById = vi.fn()
const mockMsgFindRecent = vi.fn()
const mockFindEncrypted = vi.fn()
const mockFindByProviderModel = vi.fn()
const mockGatewayStream = vi.fn()

vi.mock('@omnimind/db', async (importOriginal) => {
  const original = await importOriginal<typeof import('@omnimind/db')>()
  return {
    ...original,
    ChatRunRepository: class {
      findByIdempotencyKey = mockFindByIdem
      findById = mockRunFindById
      releaseIdempotencyKey = mockReleaseIdem
      updateStatus = mockRunUpdateStatus
    },
    ChatModelRunRepository: class {
      updateStatus = mockModelUpdateStatus
      findByChatRun = mockModelFindByChatRun
    },
    ChatRunEventRepository: class {
      create = mockEventCreate
    },
    ChatRunWriteRepository: class {
      createRunSetup = mockCreateRunSetup
      completeModelRun = mockCompleteModelRun
    },
    ConversationRepository: class {
      findById = mockConvFindById
    },
    MessageRepository: class {
      findRecentByConversation = mockMsgFindRecent
    },
    ProviderKeyRepository: class {
      findEncrypted = mockFindEncrypted
    },
    ModelCatalogRepository: class {
      findByProviderModel = mockFindByProviderModel
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

const { ChatRunService } = await import('../chat-run.service.js')
const { RunCoordinator } = await import('../run-coordinator.js')

const FAKE_DB = {} as never
const FAKE_SECRET = 'a'.repeat(64)

function fixtureChunks(chunks: GatewayStreamChunk[]) {
  return async function* () {
    for (const chunk of chunks) yield chunk
  }
}

function eventTypes() {
  return mockEventCreate.mock.calls.map((call) => call[0].eventType as string)
}

function eventSequences() {
  return mockEventCreate.mock.calls.map((call) => call[0].sequence as number)
}

const baseParams = {
  workspaceId: 'ws-1',
  userId: 'user-1',
  conversationId: '11111111-1111-1111-1111-111111111111',
  input: { text: 'hi' },
  models: [{ provider: 'openai' as const, model: 'gpt-4o' }],
}

describe('ChatRunService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockReleaseIdem.mockResolvedValue(undefined)
    mockRunUpdateStatus.mockResolvedValue(undefined)
    mockModelUpdateStatus.mockResolvedValue(undefined)
    mockModelFindByChatRun.mockResolvedValue([])
    mockEventCreate.mockResolvedValue(undefined)
    mockCreateRunSetup.mockResolvedValue(undefined)
    mockCompleteModelRun.mockResolvedValue(undefined)
    mockConvFindById.mockResolvedValue({ id: baseParams.conversationId, workspaceId: 'ws-1' })
    mockMsgFindRecent.mockResolvedValue([
      { role: 'user', contentText: 'hi' },
    ])
    mockFindEncrypted.mockResolvedValue({ encryptedKey: 'enc' })
    mockFindByProviderModel.mockResolvedValue({
      inputCostPer1m: '1.000000',
      outputCostPer1m: '2.000000',
    })
  })

  it('runs the happy path: setup, stream, persist, complete', async () => {
    mockFindByIdem.mockResolvedValue(undefined)
    mockGatewayStream.mockImplementation(
      fixtureChunks([
        { type: 'delta', delta: 'Hello' },
        { type: 'delta', delta: ' world' },
        { type: 'done', finishReason: 'stop', usage: { inputTokens: 10, outputTokens: 5, totalTokens: 15 } },
      ]),
    )

    const service = new ChatRunService(FAKE_DB, FAKE_SECRET, new RunCoordinator())
    const result = await service.startRun(baseParams)
    expect(result.existing).toBe(false)
    await result.completion

    // run setup committed atomically before streaming
    expect(mockCreateRunSetup).toHaveBeenCalledTimes(1)
    const setupArg = mockCreateRunSetup.mock.calls[0]![0]
    expect(setupArg.run.id).toBe(result.runId)
    expect(setupArg.userMessage.role).toBe('user')
    expect(setupArg.userMessage.contentText).toBe('hi')
    expect(setupArg.modelRuns).toHaveLength(1)

    // completion persisted assistant message + usage + cost
    expect(mockCompleteModelRun).toHaveBeenCalledTimes(1)
    const completeArg = mockCompleteModelRun.mock.calls[0]![0]
    expect(completeArg.assistantMessage.contentText).toBe('Hello world')
    expect(completeArg.assistantMessage.role).toBe('assistant')
    // calculateCost(10, 5, 1, 2) = (10*1 + 5*2)/1e6 = 0.000020
    expect(completeArg.modelRun.costUsd).toBe('0.000020')
    expect(completeArg.usageEntry.totalTokens).toBe(15)
    expect(completeArg.usageEntry.usageSource).toBe('provider')

    // event stream: typed envelopes with monotonic sequence
    expect(eventTypes()).toEqual([
      'run.started',
      'model.started',
      'model.delta',
      'model.delta',
      'model.completed',
      'usage.updated',
      'run.completed',
    ])
    expect(eventSequences()).toEqual([1, 2, 3, 4, 5, 6, 7])

    // run transitioned running -> completed
    expect(mockRunUpdateStatus).toHaveBeenCalledWith(result.runId, 'running', expect.objectContaining({ startedAt: expect.any(Date) }))
    expect(mockRunUpdateStatus).toHaveBeenCalledWith(result.runId, 'completed', expect.objectContaining({ completedAt: expect.any(Date) }))
  })

  it('dedups on idempotency key without creating a new run', async () => {
    mockFindByIdem.mockResolvedValue({ id: 'run-existing', conversationId: 'conv-existing', status: 'running' })

    const service = new ChatRunService(FAKE_DB, FAKE_SECRET, new RunCoordinator())
    const result = await service.startRun({ ...baseParams, idempotencyKey: 'idem-1' })
    await result.completion

    expect(result.existing).toBe(true)
    expect(result.runId).toBe('run-existing')
    expect(mockCreateRunSetup).not.toHaveBeenCalled()
    expect(mockGatewayStream).not.toHaveBeenCalled()
  })

  it('retries a failed run with the same key by releasing the key and creating a new run', async () => {
    mockFindByIdem.mockResolvedValue({ id: 'run-failed', conversationId: 'conv-1', status: 'failed' })
    mockGatewayStream.mockImplementation(fixtureChunks([{ type: 'done' }]))

    const service = new ChatRunService(FAKE_DB, FAKE_SECRET, new RunCoordinator())
    const result = await service.startRun({ ...baseParams, idempotencyKey: 'idem-1' })
    await result.completion

    expect(mockReleaseIdem).toHaveBeenCalledWith('run-failed')
    expect(result.existing).toBe(false)
    expect(result.runId).not.toBe('run-failed')
    expect(mockCreateRunSetup).toHaveBeenCalledTimes(1)
  })

  it('dedups a concurrent double-submit when the setup insert hits the unique index', async () => {
    // First lookup misses (both requests raced past it); the other request wins
    // the unique key, so our createRunSetup throws 23505; the re-fetch finds the winner.
    mockFindByIdem.mockResolvedValueOnce(undefined).mockResolvedValueOnce({
      id: 'run-winner',
      conversationId: 'conv-1',
      status: 'running',
    })
    const uniqueViolation = Object.assign(new Error('duplicate key value violates unique constraint'), { code: '23505' })
    mockCreateRunSetup.mockRejectedValueOnce(uniqueViolation)

    const service = new ChatRunService(FAKE_DB, FAKE_SECRET, new RunCoordinator())
    const result = await service.startRun({ ...baseParams, idempotencyKey: 'idem-1' })
    await result.completion

    expect(result.existing).toBe(true)
    expect(result.runId).toBe('run-winner')
    expect(mockGatewayStream).not.toHaveBeenCalled()
  })

  it('rethrows a non-unique-violation setup failure', async () => {
    mockFindByIdem.mockResolvedValue(undefined)
    mockCreateRunSetup.mockRejectedValue(new Error('connection reset'))

    const service = new ChatRunService(FAKE_DB, FAKE_SECRET, new RunCoordinator())
    await expect(service.startRun({ ...baseParams, idempotencyKey: 'idem-1' })).rejects.toThrow('connection reset')
  })

  it('completes the run when one model fails and another succeeds', async () => {
    mockFindByIdem.mockResolvedValue(undefined)
    mockGatewayStream
      .mockImplementationOnce(
        fixtureChunks([{ type: 'error', error: { code: 'PROVIDER_RATE_LIMITED', message: 'slow down', retryable: true } }]),
      )
      .mockImplementationOnce(
        fixtureChunks([
          { type: 'delta', delta: 'ok' },
          { type: 'done', usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 } },
        ]),
      )

    const service = new ChatRunService(FAKE_DB, FAKE_SECRET, new RunCoordinator())
    const result = await service.startRun({
      ...baseParams,
      models: [
        { provider: 'openai', model: 'gpt-4o' },
        { provider: 'anthropic', model: 'claude-sonnet' },
      ],
    })
    await result.completion

    const types = eventTypes()
    expect(types).toContain('model.failed')
    expect(types).toContain('model.completed')
    expect(types[types.length - 1]).toBe('run.completed')
    expect(mockCompleteModelRun).toHaveBeenCalledTimes(1)
    expect(mockRunUpdateStatus).toHaveBeenCalledWith(result.runId, 'completed', expect.any(Object))
  })

  it('fails the run when the only model fails', async () => {
    mockFindByIdem.mockResolvedValue(undefined)
    mockGatewayStream.mockImplementation(
      fixtureChunks([{ type: 'error', error: { code: 'PROVIDER_AUTH_FAILED', message: 'bad key' } }]),
    )

    const service = new ChatRunService(FAKE_DB, FAKE_SECRET, new RunCoordinator())
    const result = await service.startRun(baseParams)
    await result.completion

    expect(mockCompleteModelRun).not.toHaveBeenCalled()
    expect(mockModelUpdateStatus).toHaveBeenCalledWith(expect.any(String), 'failed', expect.objectContaining({ errorCode: 'PROVIDER_AUTH_FAILED' }))
    expect(mockRunUpdateStatus).toHaveBeenCalledWith(result.runId, 'failed', expect.any(Object))
    expect(eventTypes()).toContain('model.failed')
    expect(eventTypes()[eventTypes().length - 1]).toBe('run.failed')
  })

  it('transitions to cancelled when the run is cancelled mid-stream', async () => {
    mockFindByIdem.mockResolvedValue(undefined)
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
    const service = new ChatRunService(FAKE_DB, FAKE_SECRET, coordinator)
    const result = await service.startRun(baseParams)

    // Let executeRun reach the blocked stream, then cancel.
    await new Promise((r) => setTimeout(r, 0))
    mockRunFindById.mockResolvedValue({ id: result.runId, workspaceId: 'ws-1', status: 'running' })
    const cancelResult = await service.cancelRun({ runId: result.runId, workspaceId: 'ws-1' })
    expect(cancelResult.status).toBe('cancelled')
    releaseStream()
    await result.completion

    expect(mockModelUpdateStatus).toHaveBeenCalledWith(expect.any(String), 'cancelled', expect.any(Object))
    expect(mockRunUpdateStatus).toHaveBeenCalledWith(result.runId, 'cancelled', expect.any(Object))
    const types = eventTypes()
    expect(types).toContain('model.cancelled')
    expect(types[types.length - 1]).toBe('run.cancelled')
  })

  it('throws CONVERSATION_NOT_FOUND when the conversation is not in the workspace', async () => {
    mockFindByIdem.mockResolvedValue(undefined)
    mockConvFindById.mockResolvedValue(undefined)

    const service = new ChatRunService(FAKE_DB, FAKE_SECRET, new RunCoordinator())
    await expect(service.startRun(baseParams)).rejects.toMatchObject({ code: 'CONVERSATION_NOT_FOUND' })
    expect(mockCreateRunSetup).not.toHaveBeenCalled()
  })
})
