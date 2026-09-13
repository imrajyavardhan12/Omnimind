import { describe, it, expect, vi, beforeEach } from 'vitest'
import { CouncilRunRepository } from '../council-run.repository.js'
import { CouncilStageResultRepository } from '../council-stage-result.repository.js'

/**
 * Mocks the Drizzle query-builder chains the council repositories use, in the
 * same style as the chat-run repository tests: chain-shape mocks that verify
 * the repository calls the right builder steps, not real SQL.
 */
function createMockDb() {
  const selectLimit = vi.fn().mockResolvedValue([] as unknown[])
  let orderRows: unknown[] = []
  const selectOrderBy = vi.fn().mockImplementation(() => ({
    limit: selectLimit,
    then: (resolve: (rows: unknown[]) => void) => resolve(orderRows),
  }))
  const selectWhere = vi.fn().mockReturnValue({ limit: selectLimit, orderBy: selectOrderBy })
  const selectFrom = vi.fn().mockReturnValue({ where: selectWhere })
  const select = vi.fn().mockReturnValue({ from: selectFrom })

  const insertReturning = vi.fn().mockResolvedValue([] as unknown[])
  const insertValues = vi.fn().mockReturnValue({ returning: insertReturning })
  const insert = vi.fn().mockReturnValue({ values: insertValues })

  const updateReturning = vi.fn().mockResolvedValue([] as unknown[])
  const updateWhere = vi.fn().mockReturnValue({ returning: updateReturning })
  const updateSet = vi.fn().mockReturnValue({ where: updateWhere })
  const update = vi.fn().mockReturnValue({ set: updateSet })

  return {
    db: { select, insert, update } as never,
    mocks: {
      selectLimit,
      selectOrderBy,
      insertValues,
      insertReturning,
      updateSet,
      updateReturning,
      setOrderRows: (rows: unknown[]) => {
        orderRows = rows
      },
    },
  }
}

describe('CouncilRunRepository', () => {
  let db: never
  let mocks: ReturnType<typeof createMockDb>['mocks']
  let repo: CouncilRunRepository

  beforeEach(() => {
    const mock = createMockDb()
    db = mock.db
    mocks = mock.mocks
    repo = new CouncilRunRepository(db)
  })

  it('create() inserts and returns the row', async () => {
    const row = { id: 'c1', status: 'queued' }
    mocks.insertReturning.mockResolvedValue([row])
    const result = await repo.create({
      id: 'c1',
      workspaceId: 'ws_1',
      createdByUserId: 'u1',
      query: 'Which model is best?',
      chairmanProvider: 'anthropic',
      chairmanModel: 'claude-sonnet',
    })
    expect(mocks.insertValues).toHaveBeenCalled()
    expect(result).toEqual(row)
  })

  it('findById() returns undefined when nothing matches', async () => {
    mocks.selectLimit.mockResolvedValue([])
    expect(await repo.findById('missing')).toBeUndefined()
  })

  it('updateStatus() stamps updatedAt and applies lifecycle dates', async () => {
    const row = { id: 'c1', status: 'stage1' }
    mocks.updateReturning.mockResolvedValue([row])
    const startedAt = new Date()
    const result = await repo.updateStatus('c1', 'stage1', { startedAt })
    expect(mocks.updateSet).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'stage1', startedAt, updatedAt: expect.any(Date) }),
    )
    expect(result).toEqual(row)
  })

  it('findByConversation() rejects an invalid pagination cursor', async () => {
    await expect(repo.findByConversation('conv_1', 50, 'not-a-date')).rejects.toThrow(
      /Invalid pagination cursor/,
    )
  })
})

describe('CouncilStageResultRepository', () => {
  let db: never
  let mocks: ReturnType<typeof createMockDb>['mocks']
  let repo: CouncilStageResultRepository

  beforeEach(() => {
    const mock = createMockDb()
    db = mock.db
    mocks = mock.mocks
    repo = new CouncilStageResultRepository(db)
  })

  it('create() inserts and returns the row', async () => {
    const row = { id: 's1', stage: 'stage1' }
    mocks.insertReturning.mockResolvedValue([row])
    const result = await repo.create({ id: 's1', councilRunId: 'c1', stage: 'stage1' })
    expect(mocks.insertValues).toHaveBeenCalled()
    expect(result).toEqual(row)
  })

  it('findByCouncilRun() orders oldest-first for stage replay', async () => {
    const rows = [{ id: 's1' }, { id: 's2' }]
    mocks.setOrderRows(rows)
    const result = await repo.findByCouncilRun('c1')
    expect(mocks.selectOrderBy).toHaveBeenCalled()
    expect(result).toEqual(rows)
  })

  it('updateStatus() persists the stage payload with the transition', async () => {
    const row = { id: 's1', status: 'completed' }
    mocks.updateReturning.mockResolvedValue([row])
    const payloadJson = { text: 'answer' }
    const result = await repo.updateStatus('s1', 'completed', { payloadJson })
    expect(mocks.updateSet).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'completed', payloadJson, updatedAt: expect.any(Date) }),
    )
    expect(result).toEqual(row)
  })
})
