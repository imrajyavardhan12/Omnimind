import { describe, it, expect, vi, beforeEach } from 'vitest'
import { FilesApiError, filesApi } from '../filesApi'

const fetchMock = vi.fn()

describe('filesApi', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubGlobal('fetch', fetchMock)
  })

  it('requestUpload posts metadata and attaches the bearer token', async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ fileId: 'f1' }) })
    await filesApi.requestUpload({ filename: 'a.pdf', mimeType: 'application/pdf', sizeBytes: 10 }, 'token-1')
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit & { headers: Headers }]
    expect(url).toContain('/v1/files/uploads')
    expect(init.method).toBe('POST')
    expect(JSON.parse(init.body as string)).toMatchObject({ filename: 'a.pdf' })
    expect(init.headers.get('Authorization')).toBe('Bearer token-1')
  })

  it('uploadBytes PUTs raw bytes with no auth header (the URL is the capability)', async () => {
    fetchMock.mockResolvedValue({ ok: true })
    const blob = new Blob(['hello'], { type: 'text/plain' })
    await filesApi.uploadBytes('https://r2.test/signed-put', blob)
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit & { headers?: Headers }]
    expect(url).toBe('https://r2.test/signed-put')
    expect(init.method).toBe('PUT')
    expect(init.body).toBe(blob)
    expect(init.headers?.get?.('Authorization') ?? null).toBeNull()
  })

  it('uploadBytes throws FilesApiError on R2 rejection', async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 403 })
    await expect(filesApi.uploadBytes('https://r2.test/x', new Blob(['x']))).rejects.toMatchObject({
      code: 'UPLOAD_FAILED',
    } satisfies Partial<FilesApiError>)
  })

  it('completeUpload posts completion and surfaces backend codes', async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ file: { id: 'f1' } }) })
    const res = await filesApi.completeUpload('f1', 'token-1')
    expect(res.file.id).toBe('f1')
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(url).toContain('/v1/files/f1/complete')
    expect(init.method).toBe('POST')
  })
})
