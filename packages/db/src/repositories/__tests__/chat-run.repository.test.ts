import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ChatRunRepository } from '../chat-run.repository.js'

function createMockDb() {
  const returning = vi.fn()
  const limit = vi.fn().mockReturnValue([])
  const where = vi.fn().mockReturnValue({ limit, orderBy: vi.fn().mockReturnValue({ limit }) })
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

describe('ChatRunRepository', () => {
  let db: any
  let mocks: ReturnType<typeof createMockDb>['mocks']
  let repo: ChatRunRepository

  beforeEach(() => {
    const mock = createMockDb()
    db = mock.db
    mocks = mock.mocks
    repo = new ChatRunRepository(db)
  })

  it('create() inserts and returns the row', async () => {
    const fakeRow = { id: 'run_1', status: 'queued' }
    mocks.returning.mockResolvedValue([fakeRow])

    const result = await repo.create({
      workspaceId: 'ws_1',
      conversationId: 'conv_1',
      createdByUserId: 'user_1',
      mode: 'single',
    })

    expect(db.insert).toHaveBeenCalled()
    expect(result).toEqual(fakeRow)
  })

  it('findById() queries by id', async () => {
    const fakeRow = { id: 'run_1' }
    mocks.limit.mockReturnValue([fakeRow])

    const result = await repo.findById('run_1')
    expect(db.select).toHaveBeenCalled()
    expect(result).toEqual(fakeRow)
  })

  it('findById() returns undefined when not found', async () => {
    mocks.limit.mockReturnValue([])
    const result = await repo.findById('missing')
    expect(result).toBeUndefined()
  })

  it('findByIdempotencyKey() queries by workspace + key', async () => {
    mocks.limit.mockReturnValue([{ id: 'run_1', idempotencyKey: 'idem_1' }])
    const result = await repo.findByIdempotencyKey('ws_1', 'idem_1')
    expect(result).toBeDefined()
    expect(result?.id).toBe('run_1')
  })

  it('updateStatus() updates and returns the row', async () => {
    const updated = { id: 'run_1', status: 'running' }
    mocks.returning.mockResolvedValue([updated])

    const result = await repo.updateStatus('run_1', 'running', {
      startedAt: new Date(),
    })

    expect(db.update).toHaveBeenCalled()
    expect(result).toEqual(updated)
  })
})
