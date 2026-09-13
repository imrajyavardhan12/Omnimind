import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Hono } from 'hono'
import type { ApiVariables } from '../../types.js'

// --- shared mocks (repo level; the real CouncilService executes against them) ---
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
const mockAuditCreate = vi.fn().mockResolvedValue(undefined)
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
    AuditLogRepository: class {
      create = mockAuditCreate
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

const { createCouncilRouter } = await import('../council.js')
const { RunCoordinator } = await import('../../services/run-coordinator.js')

const FAKE_DB = {} as never
const FAKE_SECRET = 'a'.repeat(64)

function buildApp(role: ApiVariables['userRole'] = 'member', coordinator = new RunCoordinator()) {
  const app = new Hono<{ Variables: ApiVariables }>()
  app.use('*', async (c, next) => {
    c.set('requestId', 'req-test-1')
    c.set('clerkUserId', 'clerk_1')
    c.set('userId', 'user_1')
    c.set('workspaceId', 'ws_1')
    c.set('userRole', role)
    await next()
  })
  app.route('/council/runs', createCouncilRouter(FAKE_DB, FAKE_SECRET, coordinator))
  return { app, coordinator }
}

const VALID_BODY = {
  query: 'Which database?',
  councilModels: [
    { provider: 'openai', model: 'gpt-4o' },
    { provider: 'anthropic', model: 'claude-sonnet' },
  ],
  chairmanModel: { provider: 'anthropic', model: 'claude-sonnet' },
}

describe('council routes', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockCouncilUpdateStatus.mockResolvedValue(undefined)
    mockStageUpdateStatus.mockResolvedValue(undefined)
    mockStageFindByCouncilRun.mockResolvedValue([])
    mockUsageCreate.mockResolvedValue(undefined)
    mockAuditCreate.mockResolvedValue(undefined)
    mockFindEncrypted.mockResolvedValue({ encryptedKey: 'enc' })
    mockFindByProviderModel.mockResolvedValue({ inputCostPer1m: '1.0', outputCostPer1m: '2.0' })
    mockStageCreate.mockImplementation(async (input: { id: string }) => ({ ...input }))
  })

  describe('POST /council/runs', () => {
    it('403s for viewers', async () => {
      const { app } = buildApp('viewer')
      const res = await app.request('/council/runs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(VALID_BODY),
      })
      expect(res.status).toBe(403)
      expect(mockCouncilCreate).not.toHaveBeenCalled()
    })

    it('400s when fewer than 2 council models are submitted', async () => {
      const { app } = buildApp()
      const res = await app.request('/council/runs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...VALID_BODY, councilModels: [VALID_BODY.councilModels[0]] }),
      })
      expect(res.status).toBe(400)
      expect((await res.json()).error.code).toBe('VALIDATION_ERROR')
    })

    it('201s with a run id + event stream URL and audits creation', async () => {
      mockCouncilCreate.mockResolvedValue({ id: 'c1' })
      mockGatewayStream.mockImplementation(async function* () {
        yield { type: 'done' }
      })
      const { app } = buildApp()
      const res = await app.request('/council/runs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(VALID_BODY),
      })
      expect(res.status).toBe(201)
      const json = await res.json()
      expect(json.runId).toBeTruthy()
      expect(json.eventStreamUrl).toBe(`/v1/council/runs/${json.runId}/events`)
      expect(mockAuditCreate).toHaveBeenCalledWith(expect.objectContaining({ action: 'council_run.created' }))
    })
  })

  describe('GET /council/runs/:runId', () => {
    it('404s with COUNCIL_RUN_NOT_FOUND', async () => {
      mockCouncilFindById.mockResolvedValue(undefined)
      const { app } = buildApp()
      const res = await app.request('/council/runs/missing')
      expect(res.status).toBe(404)
      expect((await res.json()).error.code).toBe('COUNCIL_RUN_NOT_FOUND')
    })

    it('returns the run plus durable stage results', async () => {
      mockCouncilFindById.mockResolvedValue({ id: 'c1', workspaceId: 'ws_1', status: 'completed' })
      mockStageFindByCouncilRun.mockResolvedValue([{ id: 's1', stage: 'stage1' }])
      const { app } = buildApp()
      const res = await app.request('/council/runs/c1')
      expect(res.status).toBe(200)
      const json = await res.json()
      expect(json.run.id).toBe('c1')
      expect(json.stageResults).toHaveLength(1)
    })
  })

  describe('GET /council/runs/:runId/events', () => {
    it('404s for unknown runs', async () => {
      mockCouncilFindById.mockResolvedValue(undefined)
      const { app } = buildApp()
      const res = await app.request('/council/runs/missing/events')
      expect(res.status).toBe(404)
    })

    it('400s when afterSequence replay is requested (live-only stream)', async () => {
      mockCouncilFindById.mockResolvedValue({ id: 'c1', workspaceId: 'ws_1', status: 'running' })
      const { app } = buildApp()
      const res = await app.request('/council/runs/c1/events?afterSequence=3')
      expect(res.status).toBe(400)
      expect((await res.json()).error.code).toBe('VALIDATION_ERROR')
    })

    it('delivers the terminal event immediately for finished runs', async () => {
      mockCouncilFindById.mockResolvedValue({ id: 'c1', workspaceId: 'ws_1', status: 'completed' })
      const { app } = buildApp()
      const res = await app.request('/council/runs/c1/events')
      expect(res.status).toBe(200)
      const text = await res.text()
      expect(text).toContain('council.completed')
    })

    it('streams live events until the terminal event', async () => {
      mockCouncilFindById.mockResolvedValue({ id: 'c1', workspaceId: 'ws_1', status: 'stage1' })
      const coordinator = new RunCoordinator()
      // The route closes an idle stream when no emitter is registered (orphan
      // guard), so register the run like a live execution would.
      coordinator.registerRun('c1')
      const { app } = buildApp('member', coordinator)
      const resPromise = app.request('/council/runs/c1/events')
      await new Promise((r) => setTimeout(r, 10))
      coordinator.publish('c1', {
        type: 'council.model.started',
        runId: 'c1',
        sequence: 7,
        timestamp: new Date().toISOString(),
        data: {},
      })
      coordinator.publish('c1', {
        type: 'council.completed',
        runId: 'c1',
        sequence: 8,
        timestamp: new Date().toISOString(),
        data: {},
      })
      const res = await resPromise
      expect(res.status).toBe(200)
      const text = await res.text()
      expect(text).toContain('council.model.started')
      expect(text).toContain('council.completed')
    })
  })

  describe('POST /council/runs/:runId/cancel', () => {
    it('404s for unknown runs', async () => {
      mockCouncilFindById.mockResolvedValue(undefined)
      const { app } = buildApp()
      const res = await app.request('/council/runs/missing/cancel', { method: 'POST' })
      expect(res.status).toBe(404)
    })

    it('cancels and audits council_run.cancelled', async () => {
      mockCouncilFindById.mockResolvedValue({ id: 'c1', workspaceId: 'ws_1', status: 'stage2' })
      const { app } = buildApp()
      const res = await app.request('/council/runs/c1/cancel', { method: 'POST' })
      expect(res.status).toBe(200)
      expect((await res.json()).status).toBe('cancelled')
      expect(mockAuditCreate).toHaveBeenCalledWith(expect.objectContaining({ action: 'council_run.cancelled' }))
    })
  })
})
