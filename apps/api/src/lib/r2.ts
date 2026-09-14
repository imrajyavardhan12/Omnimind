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

/**
 * Verify the client's upload actually landed, then hash it. Streams the object
 * (never fully buffered beyond the hash update) and returns the hex sha256 +
 * the authoritative byte size — the route trusts THESE, not the claimed size
 * from the upload request. Throws R2ObjectNotFoundError when the client
 * signalled completion without uploading.
 */
export async function verifyUploadAndHash(deps: R2Deps, key: string): Promise<VerifiedUpload> {
  let body: unknown
  try {
    const out = await deps.client.send(new GetObjectCommand({ Bucket: deps.bucket, Key: key }))
    body = out.Body
  } catch (err) {
    if (isNotFound(err)) throw new R2ObjectNotFoundError(key)
    throw new R2StorageError('Failed to read back R2 object for verification', err)
  }
  if (!isAsyncIterable(body)) {
    throw new R2StorageError('Unexpected R2 response body while verifying upload')
  }
  try {
    const hash = createHash('sha256')
    let sizeBytes = 0
    for await (const chunk of body) {
      const buf = typeof chunk === 'string' ? Buffer.from(chunk) : (chunk as Uint8Array)
      sizeBytes += buf.byteLength
      hash.update(buf)
    }
    return { sha256: hash.digest('hex'), sizeBytes }
  } catch (err) {
    throw new R2StorageError('Failed to hash R2 object during verification', err)
  }
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
