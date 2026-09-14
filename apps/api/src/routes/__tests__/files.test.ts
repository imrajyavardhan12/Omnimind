import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Hono } from 'hono'
import { MAX_FILE_SIZE_BYTES, DEFAULT_WORKSPACE_STORAGE_QUOTA_BYTES } from '@omnimind/types'
import type { ApiVariables } from '../../types.js'

const mockCreate = vi.fn()
const mockFindById = vi.fn()
const mockUpdateStatus = vi.fn()
const mockMarkUploaded = vi.fn()
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
      markUploaded = mockMarkUploaded
      softDelete = mockSoftDelete
      sumActiveSizeBytes = mockSumActiveSizeBytes
    },
    AuditLogRepository: class {
      create = mockAuditCreate
    },
  }
})

const mockSignedUploadUrl = vi.fn()
const mockVerifyUploadAndHash = vi.fn()
const mockSignedDownloadUrl = vi.fn()

vi.mock('../../lib/r2.js', async (importOriginal) => {
  const original = await importOriginal<typeof import('../../lib/r2.js')>()
  return {
    ...original,
    createSignedUploadUrl: (...args: unknown[]) => mockSignedUploadUrl(...args),
    verifyUploadAndHash: (...args: unknown[]) => mockVerifyUploadAndHash(...args),
    createSignedDownloadUrl: (...args: unknown[]) => mockSignedDownloadUrl(...args),
  }
})

const { createFilesRouter } = await import('../files.js')
const { R2ObjectNotFoundError } = await import('../../lib/r2.js')

const FAKE_DB = {} as never
const FAKE_R2 = { client: {} as never, bucket: 'test-bucket' }

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
  app.route('/files', createFilesRouter(FAKE_DB, FAKE_R2))
  return app
}

function fakeFileRow(over: Record<string, unknown> = {}) {
  const now = new Date('2026-06-04T00:00:00.000Z')
  return {
    id: 'f1',
    workspaceId: 'ws_1',
    uploadedByUserId: 'user_1',
    storageBucket: 'test-bucket',
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
    mockSignedUploadUrl.mockResolvedValue('https://r2.test/signed-put')
    mockSignedDownloadUrl.mockResolvedValue('https://r2.test/signed-get')
    mockVerifyUploadAndHash.mockResolvedValue({ sha256: 'abc123', sizeBytes: 1024 })
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

    it('201s, creates a pending row, and returns a real signed PUT URL (never a stub)', async () => {
      mockCreate.mockResolvedValue(fakeFileRow())
      const res = await postUpload(buildApp(), VALID_UPLOAD)
      expect(res.status).toBe(201)
      const json = await res.json()
      expect(json.fileId).toBe('f1')
      expect(json.method).toBe('PUT')
      expect(json.uploadUrl).toBe('https://r2.test/signed-put')
      expect(json.stub).toBeUndefined()
      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'pending', mimeType: 'application/pdf', workspaceId: 'ws_1' }),
      )
      expect(mockSignedUploadUrl).toHaveBeenCalledWith(
        FAKE_R2,
        // The key embeds a fresh randomUUID per upload — match the shape.
        expect.stringMatching(/^workspaces\/ws_1\/files\/[^/]+\/a\.pdf$/),
      )
    })

    it('502s (STORAGE_ERROR) when R2 signing fails', async () => {
      mockCreate.mockResolvedValue(fakeFileRow())
      mockSignedUploadUrl.mockRejectedValue(new Error('signing boom'))
      const res = await postUpload(buildApp(), VALID_UPLOAD)
      expect(res.status).toBe(502)
      expect((await res.json()).error.code).toBe('STORAGE_ERROR')
    })
  })

  describe('POST /files/:id/complete', () => {
    it('404s when the file is not found', async () => {
      mockFindById.mockResolvedValue(undefined)
      const res = await buildApp().request('/files/f1/complete', { method: 'POST' })
      expect(res.status).toBe(404)
    })

    it('verifies the R2 object, records sha256/size, and returns the DTO without the storage key', async () => {
      mockFindById.mockResolvedValue(fakeFileRow({ status: 'pending' }))
      mockMarkUploaded.mockResolvedValue(fakeFileRow({ status: 'uploaded', sha256: 'abc123' }))
      const res = await buildApp().request('/files/f1/complete', { method: 'POST' })
      expect(res.status).toBe(200)
      const json = await res.json()
      expect(json.file.status).toBe('uploaded')
      expect(json.file.sha256).toBe('abc123')
      expect(json.file.storageKey).toBeUndefined()
      expect(mockVerifyUploadAndHash).toHaveBeenCalledWith(FAKE_R2, 'workspaces/ws_1/files/f1/a.pdf')
      expect(mockMarkUploaded).toHaveBeenCalledWith('f1', 'ws_1', { sha256: 'abc123', sizeBytes: 1024 })
      expect(mockAuditCreate).toHaveBeenCalledWith(expect.objectContaining({ action: 'file.uploaded' }))
    })

    it('404s when the object never landed in R2', async () => {
      mockFindById.mockResolvedValue(fakeFileRow({ status: 'pending' }))
      mockVerifyUploadAndHash.mockRejectedValue(new R2ObjectNotFoundError('k'))
      const res = await buildApp().request('/files/f1/complete', { method: 'POST' })
      expect(res.status).toBe(404)
      expect(mockMarkUploaded).not.toHaveBeenCalled()
      expect(mockAuditCreate).not.toHaveBeenCalled()
    })

    it('502s when R2 verification fails', async () => {
      mockFindById.mockResolvedValue(fakeFileRow({ status: 'pending' }))
      mockVerifyUploadAndHash.mockRejectedValue(new Error('r2 down'))
      const res = await buildApp().request('/files/f1/complete', { method: 'POST' })
      expect(res.status).toBe(502)
      expect((await res.json()).error.code).toBe('STORAGE_ERROR')
    })

    it('is idempotent: an already-uploaded file is returned without re-verify or audit', async () => {
      mockFindById.mockResolvedValue(fakeFileRow({ status: 'uploaded', sha256: 'abc123' }))
      const res = await buildApp().request('/files/f1/complete', { method: 'POST' })
      expect(res.status).toBe(200)
      expect(mockVerifyUploadAndHash).not.toHaveBeenCalled()
      expect(mockMarkUploaded).not.toHaveBeenCalled()
      expect(mockAuditCreate).not.toHaveBeenCalled()
    })
  })

  describe('GET /files/:id', () => {
    it('404s when not found', async () => {
      mockFindById.mockResolvedValue(undefined)
      const res = await buildApp().request('/files/f1')
      expect(res.status).toBe(404)
    })

    it('returns metadata plus a signed download URL (never storage internals)', async () => {
      mockFindById.mockResolvedValue(fakeFileRow({ status: 'uploaded', sha256: 'abc123' }))
      const res = await buildApp().request('/files/f1')
      expect(res.status).toBe(200)
      const json = await res.json()
      expect(json.file).toMatchObject({ id: 'f1', filename: 'a.pdf', status: 'uploaded' })
      expect(json.file.storageKey).toBeUndefined()
      expect(json.file.storageBucket).toBeUndefined()
      expect(json.downloadUrl).toBe('https://r2.test/signed-get')
      expect(typeof json.downloadExpiresAt).toBe('string')
    })

    it('502s when download signing fails', async () => {
      mockFindById.mockResolvedValue(fakeFileRow({ status: 'uploaded' }))
      mockSignedDownloadUrl.mockRejectedValue(new Error('signing boom'))
      const res = await buildApp().request('/files/f1')
      expect(res.status).toBe(502)
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
