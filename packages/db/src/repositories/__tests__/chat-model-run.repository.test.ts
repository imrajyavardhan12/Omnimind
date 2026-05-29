import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ChatModelRunRepository } from '../chat-model-run.repository.js'

function createMockDb() {
  const returning = vi.fn()
  const limit = vi.fn().mockReturnValue([])
  const where = vi.fn().mockReturnValue({ limit })
  const from = vi.fn().mockReturnValue({ where })
  const set = vi.fn().mockReturnValue({ where: vi.fn().mockReturnValue({ returning }) })
  const values = vi.fn().mockReturnValue({ returning })

  return {
    db: {
      insert: vi.fn().mockReturnValue({ values }),
      select: vi.fn().mockReturnValue({ from }),
      update: vi.fn().mockReturnValue({ set }),
    } as any,
    mocks: { returning, limit, where, from, set, values },
  }
}

describe('ChatModelRunRepository', () => {
  let db: any
  let mocks: ReturnType<typeof createMockDb>['mocks']
  let repo: ChatModelRunRepository

  beforeEach(() => {
    const mock = createMockDb()
    db = mock.db
    mocks = mock.mocks
    repo = new ChatModelRunRepository(db)
  })

  it('create() inserts and returns the row', async () => {
    const fakeRow = { id: 'mr_1', status: 'queued' }
    mocks.returning.mockResolvedValue([fakeRow])

    const result = await repo.create({
      chatRunId: 'run_1',
      workspaceId: 'ws_1',
      provider: 'openai',
      model: 'gpt-4o',
    })

    expect(db.insert).toHaveBeenCalled()
    expect(result).toEqual(fakeRow)
  })

  it('findById() returns the row or undefined', async () => {
    mocks.limit.mockReturnValue([{ id: 'mr_1' }])
    const result = await repo.findById('mr_1')
    expect(result?.id).toBe('mr_1')
  })

  it('findByChatRun() returns model runs for a chat run', async () => {
    const rows = [{ id: 'mr_1' }, { id: 'mr_2' }]
    mocks.where.mockReturnValue(rows)
    const result = await repo.findByChatRun('run_1')
    expect(result).toHaveLength(2)
  })

  it('updateStatus() updates status and optional fields', async () => {
    const updated = { id: 'mr_1', status: 'completed', inputTokens: 100 }
    mocks.returning.mockResolvedValue([updated])

    const result = await repo.updateStatus('mr_1', 'completed', {
      inputTokens: 100,
      outputTokens: 50,
      totalTokens: 150,
      completedAt: new Date(),
    })

    expect(db.update).toHaveBeenCalled()
    expect(result).toEqual(updated)
  })
})
