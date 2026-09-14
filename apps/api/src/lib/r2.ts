import { createHash } from 'node:crypto'
import {
  GetObjectCommand,
  HeadBucketCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'

/**
 * Cloudflare R2 object storage access (ADR 0007, M7B).
 *
 * R2 is S3-compatible, so the AWS SDK is the client — but every helper here
 * speaks R2 concepts (buckets are private; all browser access is through
 * short-expiry signed URLs issued by the API). Credentials arrive only via
 * the Zod-validated server env (`packages/config` apiEnvSchema) and are never
 * logged, never returned, and never leave this module except inside the SDK
 * client's own request signer.
 */

export interface R2Env {
  accountId: string
  accessKeyId: string
  secretAccessKey: string
  bucket: string
  endpoint: string
}

export interface R2Deps {
  client: S3Client
  bucket: string
}

/** Short-expiry signed URLs: 15 minutes for both directions. */
export const SIGNED_UPLOAD_TTL_SECS = 15 * 60
export const SIGNED_DOWNLOAD_TTL_SECS = 15 * 60

export class R2ObjectNotFoundError extends Error {
  constructor(key: string) {
    super(`Stored object not found: ${key}`)
    this.name = 'R2ObjectNotFoundError'
  }
}

export class R2StorageError extends Error {
  constructor(message: string, public readonly cause?: unknown) {
    super(message)
    this.name = 'R2StorageError'
  }
}

export function createR2Client(env: R2Env): S3Client {
  return new S3Client({
    region: 'auto',
    endpoint: env.endpoint,
    credentials: {
      accessKeyId: env.accessKeyId,
      secretAccessKey: env.secretAccessKey,
    },
  })
}

/**
 * Liveness check: does the bucket exist and do the credentials work?
 * Read-only, touches no objects. Used for smoke tests, not boot (boot must
 * not depend on network — missing *configuration* fails fast via Zod instead).
 */
export async function checkR2Bucket(deps: R2Deps): Promise<void> {
  try {
    await deps.client.send(new HeadBucketCommand({ Bucket: deps.bucket }))
  } catch (err) {
    throw new R2StorageError('R2 bucket unreachable — check R2_* env and bucket CORS/name', err)
  }
}

/**
 * Signed PUT URL for direct browser → R2 upload. The signature does NOT bind
 * Content-Type (any content type uploads) to keep browser uploads robust;
 * MIME is enforced at upload-request time by the route allowlist and rechecked
 * server-side on complete.
 */
export async function createSignedUploadUrl(
  deps: R2Deps,
  key: string,
  expiresInSecs = SIGNED_UPLOAD_TTL_SECS,
): Promise<string> {
  try {
    return await getSignedUrl(
      deps.client,
      new PutObjectCommand({ Bucket: deps.bucket, Key: key }),
      { expiresIn: expiresInSecs },
    )
  } catch (err) {
    throw new R2StorageError('Failed to sign R2 upload URL', err)
  }
}

/** Signed GET URL for private-object download (composer previews, exports). */
export async function createSignedDownloadUrl(
  deps: R2Deps,
  key: string,
  expiresInSecs = SIGNED_DOWNLOAD_TTL_SECS,
): Promise<string> {
  try {
    return await getSignedUrl(
      deps.client,
      new GetObjectCommand({ Bucket: deps.bucket, Key: key }),
      { expiresIn: expiresInSecs },
    )
  } catch (err) {
    throw new R2StorageError('Failed to sign R2 download URL', err)
  }
}

export interface VerifiedUpload {
  sha256: string
  sizeBytes: number
}

/** SHA-256 hex digest of in-memory bytes. */
export function sha256Hex(bytes: Uint8Array): string {
  return createHash('sha256').update(bytes).digest('hex')
}

/**
 * Download the full object into memory. Files are capped at 25 MB at
 * upload-request time, so one bounded buffer is safe and keeps verify +
 * extract on a single download. Throws R2ObjectNotFoundError / R2StorageError.
 */
export async function downloadObject(deps: R2Deps, key: string): Promise<Buffer> {
  let body: unknown
  try {
    const out = await deps.client.send(new GetObjectCommand({ Bucket: deps.bucket, Key: key }))
    body = out.Body
  } catch (err) {
    if (isNotFound(err)) throw new R2ObjectNotFoundError(key)
    throw new R2StorageError('Failed to read R2 object', err)
  }
  if (!isAsyncIterable(body)) {
    throw new R2StorageError('Unexpected R2 response body while downloading object')
  }
  const chunks: Uint8Array[] = []
  try {
    for await (const chunk of body) {
      chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : (chunk as Uint8Array))
    }
  } catch (err) {
    throw new R2StorageError('Failed to stream R2 object body', err)
  }
  return Buffer.concat(chunks)
}

/**
 * Verify the client's upload actually landed, then hash it. Small wrapper
 * over downloadObject for callers that only need provenance, not content.
 */
export async function verifyUploadAndHash(deps: R2Deps, key: string): Promise<VerifiedUpload> {
  const bytes = await downloadObject(deps, key)
  return { sha256: sha256Hex(bytes), sizeBytes: bytes.byteLength }
}

function isNotFound(err: unknown): boolean {
  if (err === null || typeof err !== 'object') return false
  const code = err as { name?: string; Code?: string; $metadata?: { httpStatusCode?: number } }
  return (
    code.name === 'NotFound' ||
    code.name === 'NoSuchKey' ||
    code.Code === 'NoSuchKey' ||
    code.$metadata?.httpStatusCode === 404
  )
}

function isAsyncIterable(value: unknown): value is AsyncIterable<Uint8Array | string> {
  return (
    value !== null &&
    typeof value === 'object' &&
    Symbol.asyncIterator in (value as Record<symbol, unknown>)
  )
}
