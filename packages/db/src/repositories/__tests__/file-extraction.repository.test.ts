import { describe, it, expect, vi, beforeEach } from 'vitest'
import { FileExtractionRepository } from '../file-extraction.repository.js'

function createMockDb() {
  const selectLimit = vi.fn().mockResolvedValue([] as unknown[])
  const selectOrderBy = vi.fn().mockImplementation(() => ({
    limit: selectLimit,
    then: (resolve: (rows: unknown[]) => void) => resolve([] as unknown[]),
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
    mocks: { selectLimit, selectOrderBy, insertValues, insertReturning, updateSet, updateReturning },
  }
}

describe('FileExtractionRepository', () => {
  let db: never
  let mocks: ReturnType<typeof createMockDb>['mocks']
  let repo: FileExtractionRepository

  beforeEach(() => {
    const mock = createMockDb()
    db = mock.db
    mocks = mock.mocks
    repo = new FileExtractionRepository(db)
  })

  it('create() inserts and returns the row', async () => {
    const row = { id: 'x1', status: 'running' }
    mocks.insertReturning.mockResolvedValue([row])
    const result = await repo.create({ id: 'x1', fileId: 'f1', extractionType: 'pdf_text', status: 'running' })
    expect(mocks.insertValues).toHaveBeenCalled()
    expect(result).toEqual(row)
  })

  it('updateStatus() records output text on completion', async () => {
    const row = { id: 'x1', status: 'completed' }
    mocks.updateReturning.mockResolvedValue([row])
    const result = await repo.updateStatus('x1', 'completed', { outputText: 'hello' })
    expect(mocks.updateSet).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'completed', outputText: 'hello' }),
    )
    expect(result).toEqual(row)
  })

  it('updateStatus() records the error message on failure', async () => {
    const row = { id: 'x1', status: 'failed' }
    mocks.updateReturning.mockResolvedValue([row])
    await repo.updateStatus('x1', 'failed', { errorMessage: 'boom' })
    expect(mocks.updateSet).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'failed', errorMessage: 'boom' }),
    )
  })

  it('findLatestByFileId() returns undefined when no extraction ran', async () => {
    mocks.selectLimit.mockResolvedValue([])
    expect(await repo.findLatestByFileId('f1')).toBeUndefined()
  })
})
