import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ChatRunEventRepository } from '../chat-run-event.repository.js'

function createMockDb() {
  const returning = vi.fn()
  const orderBy = vi.fn().mockReturnValue([])
  const where = vi.fn().mockReturnValue({ orderBy })
  const from = vi.fn().mockReturnValue({ where })
  const values = vi.fn().mockReturnValue({ returning })

  return {
    db: {
      insert: vi.fn().mockReturnValue({ values }),
      select: vi.fn().mockReturnValue({ from }),
    } as any,
    mocks: { returning, where, from, values, orderBy },
  }
}

describe('ChatRunEventRepository', () => {
  let db: any
  let mocks: ReturnType<typeof createMockDb>['mocks']
  let repo: ChatRunEventRepository

  beforeEach(() => {
    const mock = createMockDb()
    db = mock.db
    mocks = mock.mocks
    repo = new ChatRunEventRepository(db)
  })

  it('create() inserts an event row', async () => {
    const fakeRow = { id: 'evt_1', sequence: 1, eventType: 'run.started' }
    mocks.returning.mockResolvedValue([fakeRow])

    const result = await repo.create({
      chatRunId: 'run_1',
      sequence: 1,
      eventType: 'run.started',
      payloadJson: { conversationId: 'conv_1' },
    })

    expect(db.insert).toHaveBeenCalled()
    expect(result.eventType).toBe('run.started')
  })

  it('findByChatRun() returns events ordered by sequence', async () => {
    const events = [
      { id: 'evt_1', sequence: 1 },
      { id: 'evt_2', sequence: 2 },
    ]
    mocks.orderBy.mockReturnValue(events)

    const result = await repo.findByChatRun('run_1')
    expect(result).toHaveLength(2)
  })

  it('findByChatRun() supports afterSequence filter', async () => {
    mocks.orderBy.mockReturnValue([])
    const result = await repo.findByChatRun('run_1', 5)
    expect(db.select).toHaveBeenCalled()
    expect(result).toEqual([])
  })
})
