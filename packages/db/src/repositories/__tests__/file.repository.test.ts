import { describe, it, expect, vi, beforeEach } from 'vitest'
import { FileRepository } from '../file.repository.js'

/**
 * Mocks the Drizzle query-builder chains the FileRepository uses:
 *   insert(files).values(x).returning()
 *   select().from(files).where(...).limit(1)            -> findById
 *   select({total}).from(files).where(...)   (awaited)  -> sumActiveSizeBytes
 *   update(files).set(x).where(...).returning()         -> updateStatus / softDelete
 */
function createMockDb() {
  const selectLimit = vi.fn().mockResolvedValue([] as unknown[])
  let sumResult: unknown[] = [{ total: '0' }]
  const selectWhere = vi.fn().mockImplementation(() => ({
    limit: selectLimit,
    then: (resolve: (rows: unknown[]) => void) => resolve(sumResult),
  }))
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
      insertReturning,
      insertValues,
      updateReturning,
      updateSet,
      setSumResult: (rows: unknown[]) => {
        sumResult = rows
      },
    },
  }
}

describe('FileRepository', () => {
  let db: never
  let mocks: ReturnType<typeof createMockDb>['mocks']
  let repo: FileRepository

  beforeEach(() => {
    const mock = createMockDb()
    db = mock.db
    mocks = mock.mocks
    repo = new FileRepository(db)
  })

  it('create() inserts and returns the row', async () => {
    const row = { id: 'f1', filename: 'a.pdf', status: 'pending' }
    mocks.insertReturning.mockResolvedValue([row])
    const result = await repo.create({
      id: 'f1',
      workspaceId: 'ws_1',
      uploadedByUserId: 'u1',
      storageBucket: 'b',
      storageKey: 'k',
      filename: 'a.pdf',
      mimeType: 'application/pdf',
      sizeBytes: 10,
    })
    expect(mocks.insertValues).toHaveBeenCalled()
    expect(result).toEqual(row)
  })

  it('findById() returns the first matching row', async () => {
    const row = { id: 'f1', filename: 'a.pdf' }
    mocks.selectLimit.mockResolvedValue([row])
    const result = await repo.findById('f1', 'ws_1')
    expect(result).toEqual(row)
  })

  it('findById() returns undefined when nothing matches', async () => {
    mocks.selectLimit.mockResolvedValue([])
    expect(await repo.findById('missing', 'ws_1')).toBeUndefined()
  })

  it('updateStatus() returns the updated row', async () => {
    const row = { id: 'f1', status: 'uploaded' }
    mocks.updateReturning.mockResolvedValue([row])
    const result = await repo.updateStatus('f1', 'ws_1', 'uploaded')
    expect(mocks.updateSet).toHaveBeenCalledWith(expect.objectContaining({ status: 'uploaded' }))
    expect(result).toEqual(row)
  })

  it('softDelete() returns true when a row was soft-deleted', async () => {
    mocks.updateReturning.mockResolvedValue([{ id: 'f1' }])
    expect(await repo.softDelete('f1', 'ws_1')).toBe(true)
    expect(mocks.updateSet).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'deleted', deletedAt: expect.any(Date) }),
    )
  })

  it('softDelete() returns false when no row matched', async () => {
    mocks.updateReturning.mockResolvedValue([])
    expect(await repo.softDelete('missing', 'ws_1')).toBe(false)
  })

  it('sumActiveSizeBytes() coerces the SQL string sum to a number', async () => {
    mocks.setSumResult([{ total: '12345' }])
    expect(await repo.sumActiveSizeBytes('ws_1')).toBe(12345)
  })

  it('sumActiveSizeBytes() returns 0 when the workspace has no files', async () => {
    mocks.setSumResult([{ total: '0' }])
    expect(await repo.sumActiveSizeBytes('ws_1')).toBe(0)
  })
})
