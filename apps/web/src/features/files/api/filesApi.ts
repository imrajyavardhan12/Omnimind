import { apiFetch } from '@/lib/api/client'

/** File record DTO as returned by the file APIs (metadata only, never storage internals). */
export interface FileDto {
  id: string
  filename: string
  mimeType: string
  sizeBytes: number
  status: 'pending' | 'uploaded' | 'processing' | 'ready' | 'failed' | 'deleted'
  sha256: string | null
}

export interface RequestUploadResponse {
  fileId: string
  uploadUrl: string
  method: 'PUT'
  headers: Record<string, string>
}

/**
 * Thin typed client over the file pipeline (apps/api files.ts). Uploads go
 * DIRECTLY to R2 via the signed URL — file bytes never touch the API, never
 * base64 into messages, never localStorage (12-file-pipeline.md).
 */
export const filesApi = {
  /** Validate + reserve: creates the pending row and returns the signed PUT target. */
  requestUpload: (
    input: { filename: string; mimeType: string; sizeBytes: number },
    token: string,
  ) =>
    apiFetch<RequestUploadResponse>('/v1/files/uploads', {
      method: 'POST',
      body: JSON.stringify(input),
      token,
    }),

  /**
   * PUT raw bytes to R2. No auth header — the signed URL IS the capability
   * (and extra headers stay out of the signature).
   */
  uploadBytes: async (uploadUrl: string, file: Blob): Promise<void> => {
    const res = await fetch(uploadUrl, { method: 'PUT', body: file })
    if (!res.ok) {
      throw new FilesApiError('UPLOAD_FAILED', `Upload failed with status ${res.status}`, res.status)
    }
  },

  /** Signal completion: the API verifies the object (+ extracts inline) and returns the record. */
  completeUpload: (fileId: string, token: string) =>
    apiFetch<{ file: FileDto }>(`/v1/files/${fileId}/complete`, { method: 'POST', token }),
}
export class FilesApiError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly status: number,
  ) {
    super(message)
    this.name = 'FilesApiError'
  }
}
