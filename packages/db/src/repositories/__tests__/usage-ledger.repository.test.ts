import { describe, it, expect, vi, beforeEach } from 'vitest'
import { UsageLedgerRepository } from '../usage-ledger.repository.js'

function createMockDb() {
  const returning = vi.fn()
  const limit = vi.fn().mockReturnValue([])
  const orderBy = vi.fn().mockReturnValue({ limit })
  const where = vi.fn().mockReturnValue({ orderBy })
  const from = vi.fn().mockReturnValue({ where })
  const values = vi.fn().mockReturnValue({ returning })

  return {
    db: {
      insert: vi.fn().mockReturnValue({ values }),
      select: vi.fn().mockReturnValue({ from }),
    } as any,
    mocks: { returning, limit, where, from, values },
  }
}

describe('UsageLedgerRepository', () => {
  let db: any
  let mocks: ReturnType<typeof createMockDb>['mocks']
  let repo: UsageLedgerRepository

  beforeEach(() => {
    const mock = createMockDb()
    db = mock.db
    mocks = mock.mocks
    repo = new UsageLedgerRepository(db)
  })

  it('create() inserts an append-only entry', async () => {
    const fakeRow = {
      id: 'ul_1',
      provider: 'openai',
      model: 'gpt-4o',
      inputTokens: 100,
      outputTokens: 50,
      totalTokens: 150,
      costUsd: '0.010500',
    }
    mocks.returning.mockResolvedValue([fakeRow])

    const result = await repo.create({
      workspaceId: 'ws_1',
      userId: 'user_1',
      provider: 'openai',
      model: 'gpt-4o',
      inputTokens: 100,
      outputTokens: 50,
      totalTokens: 150,
      usageSource: 'provider',
      costUsd: '0.010500',
    })

    expect(db.insert).toHaveBeenCalled()
    expect(result.costUsd).toBe('0.010500')
  })

  it('findByWorkspace() queries with filters', async () => {
    mocks.limit.mockReturnValue([])
    const result = await repo.findByWorkspace('ws_1', { provider: 'openai', limit: 10 })
    expect(db.select).toHaveBeenCalled()
    expect(result).toEqual([])
  })
})
