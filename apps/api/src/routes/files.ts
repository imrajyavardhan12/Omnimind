import { randomUUID } from 'node:crypto'
import { Hono } from 'hono'
import type { Db } from '@omnimind/db'
import { AuditLogRepository, FileRepository, type FileRecord } from '@omnimind/db'
import {
  createUploadRequestSchema,
  isAllowedMimeType,
  MAX_FILE_SIZE_BYTES,
  DEFAULT_WORKSPACE_STORAGE_QUOTA_BYTES,
  type FileResponse,
} from '@omnimind/types'
import type { ApiVariables } from '../types.js'

// M7A: R2 is not yet wired. The bucket name is a placeholder; M7B injects the
// real bucket from env (R2_BUCKET) and issues a signed PUT URL instead of a stub.
const STORAGE_BUCKET = 'omnimind-files'

// Allowlist: keep alphanumerics, dot, underscore, hyphen. Everything else
// (path separators, spaces, control chars, unicode) becomes "_", so a filename
// can't escape its key prefix or inject control bytes into the R2 object key.
const UNSAFE_FILENAME_CHARS = /[^a-zA-Z0-9._-]+/g

/** Make a filename safe to embed in an R2 object key. */
function sanitizeFilename(name: string): string {
  const cleaned = name.replace(UNSAFE_FILENAME_CHARS, '_').slice(0, 255)
  return cleaned.length > 0 ? cleaned : 'file'
}

function buildStorageKey(workspaceId: string, fileId: string, filename: string): string {
  return `workspaces/${workspaceId}/files/${fileId}/${sanitizeFilename(filename)}`
}

/** Public DTO — never leaks storage_bucket/storage_key. */
function toFileResponse(f: FileRecord): FileResponse {
  return {
    id: f.id,
    filename: f.filename,
    mimeType: f.mimeType,
    sizeBytes: f.sizeBytes,
    status: f.status,
    sha256: f.sha256 ?? null,
    createdAt: f.createdAt.toISOString(),
    updatedAt: f.updatedAt.toISOString(),
  }
}

export function createFilesRouter(db: Db) {
  const router = new Hono<{ Variables: ApiVariables }>()

  // POST /v1/files/uploads — validate + create a pending row + return upload info.
  router.post('/uploads', async (c) => {
    const rid = c.get('requestId')

    if (c.get('userRole') === 'viewer') {
      return c.json({ error: { code: 'FORBIDDEN', message: 'Viewers cannot upload files', requestId: rid } }, 403)
    }

    const body = await c.req.json().catch(() => null)
    const parsed = createUploadRequestSchema.safeParse(body)
    if (!parsed.success) {
      return c.json({ error: { code: 'VALIDATION_ERROR', message: parsed.error.issues[0]?.message ?? 'Invalid request body', requestId: rid } }, 400)
    }

    const { filename, mimeType, sizeBytes } = parsed.data

    if (!isAllowedMimeType(mimeType)) {
      return c.json({ error: { code: 'UNSUPPORTED_MEDIA_TYPE', message: `MIME type not allowed: ${mimeType}`, requestId: rid } }, 415)
    }
    if (sizeBytes > MAX_FILE_SIZE_BYTES) {
      return c.json({ error: { code: 'FILE_TOO_LARGE', message: `File exceeds the ${MAX_FILE_SIZE_BYTES}-byte limit`, requestId: rid } }, 413)
    }

    const workspaceId = c.get('workspaceId')
    const repo = new FileRepository(db)

    const used = await repo.sumActiveSizeBytes(workspaceId)
    if (used + sizeBytes > DEFAULT_WORKSPACE_STORAGE_QUOTA_BYTES) {
      return c.json({ error: { code: 'QUOTA_EXCEEDED', message: 'Workspace storage quota exceeded', requestId: rid } }, 413)
    }

    const fileId = randomUUID()
    const storageKey = buildStorageKey(workspaceId, fileId, filename)

    const file = await repo.create({
      id: fileId,
      workspaceId,
      uploadedByUserId: c.get('userId'),
      storageBucket: STORAGE_BUCKET,
      storageKey,
      filename,
      mimeType,
      sizeBytes,
      status: 'pending',
    })

    return c.json(
      {
        fileId: file.id,
        // M7B replaces this with a real short-expiry signed PUT URL.
        uploadUrl: `stub://r2/${STORAGE_BUCKET}/${storageKey}`,
        method: 'PUT' as const,
        headers: {},
        stub: true,
      },
      201,
    )
  })

  // POST /v1/files/:fileId/complete — client signals the upload finished.
  router.post('/:fileId/complete', async (c) => {
    const rid = c.get('requestId')

    if (c.get('userRole') === 'viewer') {
      return c.json({ error: { code: 'FORBIDDEN', message: 'Viewers cannot upload files', requestId: rid } }, 403)
    }

    const workspaceId = c.get('workspaceId')
    const repo = new FileRepository(db)
    const existing = await repo.findById(c.req.param('fileId'), workspaceId)
    if (!existing) {
      return c.json({ error: { code: 'NOT_FOUND', message: 'File not found', requestId: rid } }, 404)
    }

    // M7A: no R2 object to verify and no extraction yet — pending -> uploaded.
    // Idempotent: a file already past pending is returned as-is with NO second
    // audit row, so client retries of `complete` don't fabricate duplicate
    // file.uploaded events. M7B verifies the R2 object + records sha256; M7C
    // runs inline extraction (uploaded -> ready).
    let file = existing
    if (existing.status === 'pending') {
      file = (await repo.updateStatus(existing.id, workspaceId, 'uploaded')) ?? existing

      new AuditLogRepository(db)
        .create({ workspaceId, userId: c.get('userId'), action: 'file.uploaded', resourceType: 'file', resourceId: file.id })
        .catch(() => undefined)
    }

    return c.json({ file: toFileResponse(file) })
  })

  // GET /v1/files/:fileId — metadata only (no object, no storage key).
  router.get('/:fileId', async (c) => {
    const rid = c.get('requestId')
    const repo = new FileRepository(db)
    const file = await repo.findById(c.req.param('fileId'), c.get('workspaceId'))
    if (!file) {
      return c.json({ error: { code: 'NOT_FOUND', message: 'File not found', requestId: rid } }, 404)
    }
    return c.json({ file: toFileResponse(file) })
  })

  // DELETE /v1/files/:fileId — soft delete (object cleanup is a later retention job).
  router.delete('/:fileId', async (c) => {
    const rid = c.get('requestId')

    if (c.get('userRole') === 'viewer') {
      return c.json({ error: { code: 'FORBIDDEN', message: 'Viewers cannot delete files', requestId: rid } }, 403)
    }

    const workspaceId = c.get('workspaceId')
    const repo = new FileRepository(db)
    const deleted = await repo.softDelete(c.req.param('fileId'), workspaceId)
    if (!deleted) {
      return c.json({ error: { code: 'NOT_FOUND', message: 'File not found', requestId: rid } }, 404)
    }

    new AuditLogRepository(db)
      .create({ workspaceId, userId: c.get('userId'), action: 'file.deleted', resourceType: 'file', resourceId: c.req.param('fileId') })
      .catch(() => undefined)

    return c.json({ success: true })
  })

  return router
}
