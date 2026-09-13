import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Hono } from 'hono'
import { MAX_FILE_SIZE_BYTES, DEFAULT_WORKSPACE_STORAGE_QUOTA_BYTES } from '@omnimind/types'
import type { ApiVariables } from '../../types.js'

const mockCreate = vi.fn()
const mockFindById = vi.fn()
const mockUpdateStatus = vi.fn()
const mockSoftDelete = vi.fn()
const mockSumActiveSizeBytes = vi.fn().mockResolvedValue(0)
const mockAuditCreate = vi.fn().mockResolvedValue(undefined)

vi.mock('@omnimind/db', async (importOriginal) => {
  const original = await importOriginal<typeof import('@omnimind/db')>()
  return {
    ...original,
    FileRepository: class {
      create = mockCreate
      findById = mockFindById
      updateStatus = mockUpdateStatus
      softDelete = mockSoftDelete
      sumActiveSizeBytes = mockSumActiveSizeBytes
    },
    AuditLogRepository: class {
      create = mockAuditCreate
    },
  }
})

const { createFilesRouter } = await import('../files.js')

const FAKE_DB = {} as never

function buildApp(role: ApiVariables['userRole'] = 'member') {
  const app = new Hono<{ Variables: ApiVariables }>()
  app.use('*', async (c, next) => {
    c.set('requestId', 'req-test-1')
    c.set('clerkUserId', 'clerk_1')
    c.set('userId', 'user_1')
    c.set('workspaceId', 'ws_1')
    c.set('userRole', role)
    await next()
  })
  app.route('/files', createFilesRouter(FAKE_DB))
  return app
}

function fakeFileRow(over: Record<string, unknown> = {}) {
  const now = new Date('2026-06-04T00:00:00.000Z')
  return {
    id: 'f1',
    workspaceId: 'ws_1',
    uploadedByUserId: 'user_1',
    storageBucket: 'omnimind-files',
    storageKey: 'workspaces/ws_1/files/f1/a.pdf',
    filename: 'a.pdf',
    mimeType: 'application/pdf',
    sizeBytes: 1024,
    sha256: null,
    status: 'pending',
    extractedTextKey: null,
    metadataJson: null,
    deletedAt: null,
    createdAt: now,
    updatedAt: now,
    ...over,
  }
}

function postUpload(app: Hono<{ Variables: ApiVariables }>, body: unknown) {
  return app.request('/files/uploads', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

const VALID_UPLOAD = { filename: 'a.pdf', mimeType: 'application/pdf', sizeBytes: 1024 }

describe('files routes', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockSumActiveSizeBytes.mockResolvedValue(0)
  })

  describe('POST /files/uploads', () => {
    it('403s for viewers', async () => {
      const res = await postUpload(buildApp('viewer'), VALID_UPLOAD)
      expect(res.status).toBe(403)
      expect(mockCreate).not.toHaveBeenCalled()
    })

    it('400s on invalid body', async () => {
      const res = await postUpload(buildApp(), { filename: '' })
      expect(res.status).toBe(400)
      expect((await res.json()).error.code).toBe('VALIDATION_ERROR')
    })

    it('415s on a disallowed MIME type', async () => {
      const res = await postUpload(buildApp(), { ...VALID_UPLOAD, mimeType: 'application/x-msdownload' })
      expect(res.status).toBe(415)
      expect((await res.json()).error.code).toBe('UNSUPPORTED_MEDIA_TYPE')
      expect(mockCreate).not.toHaveBeenCalled()
    })

    it('413s (FILE_TOO_LARGE) when the file exceeds the per-file limit', async () => {
      const res = await postUpload(buildApp(), { ...VALID_UPLOAD, sizeBytes: MAX_FILE_SIZE_BYTES + 1 })
      expect(res.status).toBe(413)
      expect((await res.json()).error.code).toBe('FILE_TOO_LARGE')
      expect(mockCreate).not.toHaveBeenCalled()
    })

    it('413s (QUOTA_EXCEEDED) when the workspace quota would be exceeded', async () => {
      mockSumActiveSizeBytes.mockResolvedValue(DEFAULT_WORKSPACE_STORAGE_QUOTA_BYTES)
      const res = await postUpload(buildApp(), VALID_UPLOAD)
      expect(res.status).toBe(413)
      expect((await res.json()).error.code).toBe('QUOTA_EXCEEDED')
      expect(mockCreate).not.toHaveBeenCalled()
    })

    it('201s, creates a pending row, and returns a stubbed upload URL', async () => {
      mockCreate.mockResolvedValue(fakeFileRow())
      const res = await postUpload(buildApp(), VALID_UPLOAD)
      expect(res.status).toBe(201)
      const json = await res.json()
      expect(json.fileId).toBe('f1')
      expect(json.method).toBe('PUT')
      expect(json.stub).toBe(true)
      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'pending', mimeType: 'application/pdf', workspaceId: 'ws_1' }),
      )
    })
  })

  describe('POST /files/:id/complete', () => {
    it('404s when the file is not found', async () => {
      mockFindById.mockResolvedValue(undefined)
      const res = await buildApp().request('/files/f1/complete', { method: 'POST' })
      expect(res.status).toBe(404)
    })

    it('transitions pending -> uploaded and returns the DTO without the storage key', async () => {
      mockFindById.mockResolvedValue(fakeFileRow({ status: 'pending' }))
      mockUpdateStatus.mockResolvedValue(fakeFileRow({ status: 'uploaded' }))
      const res = await buildApp().request('/files/f1/complete', { method: 'POST' })
      expect(res.status).toBe(200)
      const json = await res.json()
      expect(json.file.status).toBe('uploaded')
      expect(json.file.storageKey).toBeUndefined()
      expect(mockUpdateStatus).toHaveBeenCalledWith('f1', 'ws_1', 'uploaded')
      expect(mockAuditCreate).toHaveBeenCalledWith(expect.objectContaining({ action: 'file.uploaded' }))
    })

    it('is idempotent: an already-uploaded file is returned without a second update or audit', async () => {
      mockFindById.mockResolvedValue(fakeFileRow({ status: 'uploaded' }))
      const res = await buildApp().request('/files/f1/complete', { method: 'POST' })
      expect(res.status).toBe(200)
      expect(mockUpdateStatus).not.toHaveBeenCalled()
      expect(mockAuditCreate).not.toHaveBeenCalled()
    })
  })

  describe('GET /files/:id', () => {
    it('404s when not found', async () => {
      mockFindById.mockResolvedValue(undefined)
      const res = await buildApp().request('/files/f1')
      expect(res.status).toBe(404)
    })

    it('returns metadata only (never storage internals)', async () => {
      mockFindById.mockResolvedValue(fakeFileRow({ status: 'uploaded' }))
      const res = await buildApp().request('/files/f1')
      expect(res.status).toBe(200)
      const json = await res.json()
      expect(json.file).toMatchObject({ id: 'f1', filename: 'a.pdf', status: 'uploaded' })
      expect(json.file.storageKey).toBeUndefined()
      expect(json.file.storageBucket).toBeUndefined()
    })
  })

  describe('DELETE /files/:id', () => {
    it('403s for viewers', async () => {
      const res = await buildApp('viewer').request('/files/f1', { method: 'DELETE' })
      expect(res.status).toBe(403)
      expect(mockSoftDelete).not.toHaveBeenCalled()
    })

    it('404s when nothing was deleted', async () => {
      mockSoftDelete.mockResolvedValue(false)
      const res = await buildApp().request('/files/f1', { method: 'DELETE' })
      expect(res.status).toBe(404)
    })

    it('soft-deletes and audits file.deleted', async () => {
      mockSoftDelete.mockResolvedValue(true)
      const res = await buildApp().request('/files/f1', { method: 'DELETE' })
      expect(res.status).toBe(200)
      expect((await res.json()).success).toBe(true)
      expect(mockAuditCreate).toHaveBeenCalledWith(expect.objectContaining({ action: 'file.deleted' }))
    })
  })
})
