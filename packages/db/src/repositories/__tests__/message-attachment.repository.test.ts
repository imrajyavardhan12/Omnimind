import { describe, it, expect, vi, beforeEach } from 'vitest'
import { MessageAttachmentRepository } from '../message-attachment.repository.js'

function createMockDb() {
  const selectWhere = vi.fn().mockResolvedValue([] as unknown[])
  const selectJoin = vi.fn().mockReturnValue({ where: selectWhere })
  const selectFrom = vi.fn().mockReturnValue({ innerJoin: selectJoin })
  const select = vi.fn().mockReturnValue({ from: selectFrom })
  return { db: { select } as never, mocks: { selectJoin, selectWhere } }
}

describe('MessageAttachmentRepository', () => {
  let db: never
  let mocks: ReturnType<typeof createMockDb>['mocks']
  let repo: MessageAttachmentRepository

  beforeEach(() => {
    const mock = createMockDb()
    db = mock.db
    mocks = mock.mocks
    repo = new MessageAttachmentRepository(db)
  })

  it('returns [] without querying for an empty message list', async () => {
    const result = await repo.findFilesByMessageIds([])
    expect(result).toEqual([])
  })

  it('joins files for attachment metadata (never storage internals)', async () => {
    const rows = [{ messageId: 'm1', fileId: 'f1', filename: 'a.pdf', mimeType: 'application/pdf' }]
    mocks.selectWhere.mockResolvedValue(rows)
    const result = await repo.findFilesByMessageIds(['m1'])
    expect(mocks.selectJoin).toHaveBeenCalled()
    expect(result).toEqual(rows)
    expect(result[0]).not.toHaveProperty('storageKey')
    expect(result[0]).not.toHaveProperty('storageBucket')
  })
})
