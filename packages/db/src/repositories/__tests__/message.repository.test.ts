import { describe, it, expect, vi, beforeEach } from 'vitest'
import { MessageRepository } from '../message.repository.js'

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
    mocks: { returning, limit, orderBy, where, from, values },
  }
}

describe('MessageRepository', () => {
  let db: any
  let mocks: ReturnType<typeof createMockDb>['mocks']
  let repo: MessageRepository

  beforeEach(() => {
    const mock = createMockDb()
    db = mock.db
    mocks = mock.mocks
    repo = new MessageRepository(db)
  })

  it('findByConversation() returns rows in fetched (ascending) order', async () => {
    const rows = [
      { id: 'm1', contentText: 'first' },
      { id: 'm2', contentText: 'second' },
    ]
    mocks.limit.mockReturnValue(rows)
    const result = await repo.findByConversation('conv_1', 'ws_1')
    expect(db.select).toHaveBeenCalled()
    expect(result).toEqual(rows)
  })

  it('findRecentByConversation() reverses the DESC fetch into chronological order', async () => {
    // The DB query orders DESC + LIMIT, so it returns newest-first. The newest
    // message (the just-persisted prompt) is row[0]; after reverse it must be last.
    const newestFirst = [
      { id: 'm3', contentText: 'newest prompt' },
      { id: 'm2', contentText: 'middle' },
      { id: 'm1', contentText: 'oldest' },
    ]
    mocks.limit.mockReturnValue(newestFirst)

    const result = await repo.findRecentByConversation('conv_1', 'ws_1', 3)

    expect(result.map((m) => m.id)).toEqual(['m1', 'm2', 'm3'])
    // the current prompt is always present and last, regardless of conversation size
    expect(result[result.length - 1]!.contentText).toBe('newest prompt')
  })

  it('findRecentByConversation() does not mutate by re-querying (returns a fresh ordered array)', async () => {
    mocks.limit.mockReturnValue([{ id: 'm2' }, { id: 'm1' }])
    const result = await repo.findRecentByConversation('conv_1', 'ws_1', 20)
    expect(result.map((m) => m.id)).toEqual(['m1', 'm2'])
  })

  it('create() inserts and returns the row', async () => {
    const fakeRow = { id: 'm1', role: 'user', contentText: 'hi' }
    mocks.returning.mockResolvedValue([fakeRow])

    const result = await repo.create({
      conversationId: 'conv_1',
      workspaceId: 'ws_1',
      role: 'user',
      contentText: 'hi',
    })

    expect(db.insert).toHaveBeenCalled()
    expect(result).toEqual(fakeRow)
  })
})
