'use client'

import { useCallback, useRef, useState } from 'react'
import { useAuth } from '@clerk/nextjs'
import {
  ALLOWED_MIME_TYPES,
  MAX_FILES_PER_MESSAGE,
  MAX_FILE_SIZE_BYTES,
  isAllowedMimeType,
} from '@omnimind/types'
import { FilesApiError, filesApi, type FileDto } from '../api/filesApi'

export type StagedFileStatus = 'uploading' | 'ready' | 'failed'

export interface StagedFile {
  /** Client-side key (the server fileId only exists after requestUpload). */
  key: string
  name: string
  sizeBytes: number
  mimeType: string
  status: StagedFileStatus
  fileId?: string
  error?: string
}

/** Accept attribute for the file picker, derived from the shared allowlist (never duplicated). */
export const FILE_PICKER_ACCEPT = Object.keys(ALLOWED_MIME_TYPES).join(',')

export interface FileValidationError {
  code: 'UNSUPPORTED_MEDIA_TYPE' | 'FILE_TOO_LARGE'
  message: string
}

/**
 * Client-side pre-validation mirroring the server allowlist + size cap, so
 * obviously-bad picks fail instantly without a round trip. The server
 * re-validates authoritatively (codes match, so messages stay consistent).
 */
export function validateFileForUpload(file: { name: string; size: number; type: string }):
  | { ok: true }
  | { ok: false; error: FileValidationError } {
  if (!isAllowedMimeType(file.type)) {
    return { ok: false, error: { code: 'UNSUPPORTED_MEDIA_TYPE', message: `“${file.name}” is not a supported file type` } }
  }
  if (file.size > MAX_FILE_SIZE_BYTES) {
    return { ok: false, error: { code: 'FILE_TOO_LARGE', message: `“${file.name}” exceeds the 25 MB per-file limit` } }
  }
  return { ok: true }
}

export interface UseFileUploadResult {
  staged: StagedFile[]
  /** FileIds ready to submit as CreateRunRequest attachmentIds. */
  readyIds: string[]
  isUploading: boolean
  stageFiles: (files: FileList | File[]) => void
  removeStaged: (key: string) => void
  reset: () => void
}

/**
 * Upload-before-send staging (M7D): picked files upload straight to R2
 * (request → PUT → complete) and only ready fileIds reach the run request.
 * All progress is UI state — staged bytes never enter messages, stores, or
 * localStorage. Uploads run in parallel; each file tracks its own status.
 */
export function useFileUpload(): UseFileUploadResult {
  const { getToken } = useAuth()
  const [staged, setStaged] = useState<StagedFile[]>([])
  const keyRef = useRef(0)

  const patch = useCallback((key: string, update: Partial<StagedFile>) => {
    setStaged((prev) => prev.map((s) => (s.key === key ? { ...s, ...update } : s)))
  }, [])

  const runOne = useCallback(
    async (key: string, file: File, myToken: string) => {
      try {
        const { fileId, uploadUrl } = await filesApi.requestUpload(
          { filename: file.name, mimeType: file.type, sizeBytes: file.size },
          myToken,
        )
        await filesApi.uploadBytes(uploadUrl, file)
        const { file: record } = await filesApi.completeUpload(fileId, myToken)
        if (record.status === 'ready') {
          patch(key, { status: 'ready', fileId: record.id })
        } else {
          patch(key, {
            status: 'failed',
            error:
              record.status === 'failed'
                ? 'Could not read this file'
                : `File is ${record.status} — not usable yet`,
          })
        }
      } catch (err) {
        const message =
          err instanceof FilesApiError || err instanceof Error ? err.message : 'Upload failed'
        patch(key, { status: 'failed', error: message })
      }
    },
    [patch],
  )

  const stageFiles = useCallback(
    (files: FileList | File[]) => {
      const picked = Array.from(files)
      if (picked.length === 0) return
      void (async () => {
        const token = await getToken().catch(() => null)
        if (!token) {
          return
        }
        const entries = picked.map((file) => {
          keyRef.current += 1
          return { key: `staged-${keyRef.current}`, file }
        })
        // Enforce the per-message cap locally (the server re-enforces it).
        const room = Math.max(MAX_FILES_PER_MESSAGE - staged.length, 0)
        const accepted = entries.slice(0, room)
        const overflow = entries.slice(room)
        setStaged((prev) => [
          ...prev,
          ...accepted.map(({ key, file }) => {
            const validation = validateFileForUpload(file)
            return validation.ok
              ? { key, name: file.name, sizeBytes: file.size, mimeType: file.type, status: 'uploading' as const }
              : { key, name: file.name, sizeBytes: file.size, mimeType: file.type, status: 'failed' as const, error: validation.error.message }
          }),
          ...overflow.map(({ key, file }) => ({
            key,
            name: file.name,
            sizeBytes: file.size,
            mimeType: file.type,
            status: 'failed' as const,
            error: `At most ${MAX_FILES_PER_MESSAGE} files per message`,
          })),
        ])
        await Promise.all(
          accepted
            .filter(({ file }) => validateFileForUpload(file).ok)
            .map(({ key, file }) => runOne(key, file, token)),
        )
      })()
    },
    [getToken, runOne, staged.length],
  )

  const removeStaged = useCallback((key: string) => {
    setStaged((prev) => prev.filter((s) => s.key !== key))
  }, [])

  const reset = useCallback(() => {
    setStaged([])
  }, [])

  const readyIds = staged.filter((s) => s.status === 'ready' && s.fileId).map((s) => s.fileId as string)
  const isUploading = staged.some((s) => s.status === 'uploading')

  return { staged, readyIds, isUploading, stageFiles, removeStaged, reset }
}

export type { FileDto }
