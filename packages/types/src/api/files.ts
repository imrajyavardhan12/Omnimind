import { z } from 'zod'

/**
 * MIME allowlist for v2 uploads, mapped to a coarse category used by the
 * extraction pipeline (M7C) and the LLM Gateway attachment prep (M7D).
 * See docs/architecture/12-file-pipeline.md "Supported File Categories".
 *
 * Never trust the browser-provided MIME alone (14-security.md): M7B re-checks
 * the stored object. This allowlist is the first gate at upload-request time.
 */
export const ALLOWED_MIME_TYPES = {
  // Images
  'image/jpeg': 'image',
  'image/png': 'image',
  'image/gif': 'image',
  'image/webp': 'image',
  // Text
  'text/plain': 'text',
  'text/markdown': 'text',
  'text/csv': 'text',
  'application/json': 'text',
  // PDF
  'application/pdf': 'pdf',
  // Documents (docx)
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'document',
  // Audio (transcription deferred — stored only for now)
  'audio/mpeg': 'audio',
  'audio/wav': 'audio',
  'audio/x-wav': 'audio',
  'audio/mp4': 'audio',
  'audio/x-m4a': 'audio',
} as const

export type AllowedMimeType = keyof typeof ALLOWED_MIME_TYPES
export type FileCategory = (typeof ALLOWED_MIME_TYPES)[AllowedMimeType]

export function isAllowedMimeType(mime: string): mime is AllowedMimeType {
  return Object.prototype.hasOwnProperty.call(ALLOWED_MIME_TYPES, mime)
}

export function fileCategoryForMime(mime: AllowedMimeType): FileCategory {
  return ALLOWED_MIME_TYPES[mime]
}

/** Limits — docs/architecture/12-file-pipeline.md "File Size Defaults". */
export const MAX_FILE_SIZE_BYTES = 25 * 1024 * 1024 // 25 MB per file
export const MAX_FILES_PER_MESSAGE = 10 // enforced at run creation (M7D)
export const MAX_TOTAL_BYTES_PER_MESSAGE = 50 * 1024 * 1024 // 50 MB per message (M7D)
/** Workspace storage quota — "plan-based" in the doc; a flat default for now. */
export const DEFAULT_WORKSPACE_STORAGE_QUOTA_BYTES = 5 * 1024 * 1024 * 1024 // 5 GB

export const fileStatusSchema = z.enum([
  'pending',
  'uploaded',
  'processing',
  'ready',
  'failed',
  'deleted',
])
export type FileStatus = z.infer<typeof fileStatusSchema>

/** POST /v1/files/uploads — request the signed upload + create the pending row. */
export const createUploadRequestSchema = z.object({
  filename: z.string().min(1).max(255),
  // Allowlist + size are enforced in the route so they return specific error
  // codes (UNSUPPORTED_MEDIA_TYPE / FILE_TOO_LARGE) rather than a generic
  // VALIDATION_ERROR. Keep the schema permissive on those two fields.
  mimeType: z.string().min(1).max(255),
  sizeBytes: z.number().int().positive(),
})
export type CreateUploadRequest = z.infer<typeof createUploadRequestSchema>

export const createUploadResponseSchema = z.object({
  fileId: z.string().uuid(),
  uploadUrl: z.string(),
  method: z.literal('PUT'),
  headers: z.record(z.string(), z.string()),
  /** True while R2 is stubbed (M7A): the URL is a placeholder, not a live PUT target. */
  stub: z.boolean().optional(),
})
export type CreateUploadResponse = z.infer<typeof createUploadResponseSchema>

/** Public file metadata DTO. Never exposes storage_bucket/storage_key. */
export const fileResponseSchema = z.object({
  id: z.string().uuid(),
  filename: z.string(),
  mimeType: z.string(),
  sizeBytes: z.number().int().nonnegative(),
  status: fileStatusSchema,
  sha256: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
})
export type FileResponse = z.infer<typeof fileResponseSchema>
