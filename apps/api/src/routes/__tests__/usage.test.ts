import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Hono } from 'hono'
import type { ApiVariables } from '../../types.js'

const mockGetSummary = vi.fn()
const mockFindByWorkspace = vi.fn()

vi.mock('@omnimind/db', async (importOriginal) => {
  const original = await importOriginal<typeof import('@omnimind/db')>()
  return {
    ...original,
    UsageLedgerRepository: class {
      getSummary = mockGetSummary
      findByWorkspace = mockFindByWorkspace
    },
  }
})

const { createUsageRouter } = await import('../usage.js')

const FAKE_DB = {} as never

function buildApp() {
  const app = new Hono<{ Variables: ApiVariables }>()
  app.use('*', async (c, next) => {
    c.set('requestId', 'req-test-1')
    c.set('clerkUserId', 'clerk_1')
    c.set('userId', 'user_1')
    c.set('workspaceId', 'ws_1')
    c.set('userRole', 'member')
    await next()
  })
  app.route('/usage', createUsageRouter(FAKE_DB))
  return app
}

describe('usage routes', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetSummary.mockResolvedValue([])
    mockFindByWorkspace.mockResolvedValue([])
  })

  it('GET / returns a month-scoped summary by default', async () => {
    const res = await buildApp().request('/usage/summary')
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.totalCostUsd).toBe('0.000000')
    expect(json.byModel).toEqual([])
    // Scoped to the workspace, bounded to the current UTC month.
    expect(mockGetSummary).toHaveBeenCalledWith('ws_1', expect.any(Date), expect.any(Date))
    const [from, to] = mockGetSummary.mock.calls[0]!.slice(1) as [Date, Date]
    expect(from.getUTCDate()).toBe(1)
    expect(to.getTime()).toBeGreaterThanOrEqual(from.getTime())
  })

  it('GET / honors an explicit window and rejects from > to', async () => {
    const ok = await buildApp().request('/usage/summary?from=2026-09-01T00:00:00.000Z&to=2026-09-10T00:00:00.000Z')
    expect(ok.status).toBe(200)
    expect(mockGetSummary).toHaveBeenCalledWith(
      'ws_1',
      new Date('2026-09-01T00:00:00.000Z'),
      new Date('2026-09-10T00:00:00.000Z'),
    )

    const bad = await buildApp().request('/usage/summary?from=2026-09-10T00:00:00.000Z&to=2026-09-01T00:00:00.000Z')
    expect(bad.status).toBe(400)
    expect((await bad.json()).error.code).toBe('VALIDATION_ERROR')
    expect(mockGetSummary).toHaveBeenCalledTimes(1)
  })

  it('GET /ledger returns DTO entries with filters and a capped limit', async () => {
    mockFindByWorkspace.mockResolvedValue([
      {
        id: '11111111-1111-1111-1111-111111111111',
        provider: 'openai',
        model: 'gpt-4o',
        inputTokens: 100,
        outputTokens: 50,
        totalTokens: 150,
        usageSource: 'provider',
        costUsd: '0.010500',
        conversationId: null,
        chatRunId: null,
        createdAt: new Date('2026-09-02T00:00:00.000Z'),
      },
    ])
    const res = await buildApp().request('/usage/ledger?provider=openai&limit=10')
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.entries).toHaveLength(1)
    expect(json.entries[0]).toMatchObject({ provider: 'openai', costUsd: '0.010500' })
    expect(mockFindByWorkspace).toHaveBeenCalledWith('ws_1', { provider: 'openai', limit: 10 })

    const over = await buildApp().request('/usage/ledger?limit=500')
    expect(over.status).toBe(400)
    expect((await over.json()).error.code).toBe('VALIDATION_ERROR')
  })
})
