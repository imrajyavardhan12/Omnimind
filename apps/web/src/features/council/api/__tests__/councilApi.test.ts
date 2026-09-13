import { describe, it, expect, vi, beforeEach } from 'vitest'
import { councilApi } from '../councilApi'

const fetchMock = vi.fn()

describe('councilApi', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubGlobal('fetch', fetchMock)
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({}),
    })
  })

  it('createRun posts the query plus model selections (never keys)', async () => {
    await councilApi.createRun(
      {
        query: 'Which DB?',
        councilModels: [{ provider: 'openai', model: 'gpt-4o' }],
        chairmanModel: { provider: 'anthropic', model: 'claude-sonnet' },
      },
      'token-1',
    )
    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit & { headers: Headers }]
    expect(url).toContain('/v1/council/runs')
    expect(init.method).toBe('POST')
    const body = JSON.parse(init.body as string)
    expect(body).toMatchObject({ query: 'Which DB?' })
    expect(JSON.stringify(body)).not.toMatch(/sk-|apiKey/i)
    expect(init.headers.get('Authorization')).toBe('Bearer token-1')
    expect(init.headers.get('Idempotency-Key')).toBeNull()
  })

  it('getRun fetches detail and cancelRun posts cancel', async () => {
    await councilApi.getRun('c1', 'token-1')
    const [getUrl] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(getUrl).toContain('/v1/council/runs/c1')

    await councilApi.cancelRun('c1', 'token-1')
    const [cancelUrl, cancelInit] = fetchMock.mock.calls[1] as [string, RequestInit]
    expect(cancelUrl).toContain('/v1/council/runs/c1/cancel')
    expect(cancelInit.method).toBe('POST')
  })

  it('openEventStream never sends afterSequence (live-only contract)', async () => {
    await councilApi.openEventStream('c1', 'token-1')
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit & { headers: Headers }]
    expect(url).toContain('/v1/council/runs/c1/events')
    expect(url).not.toContain('afterSequence')
    expect(init.headers.get('Authorization')).toBe('Bearer token-1')
  })

  it('surfaces the backend error code on non-2xx', async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 403,
      json: async () => ({ error: { code: 'FORBIDDEN', message: 'nope' } }),
    })
    await expect(councilApi.createRun({ query: 'q', councilModels: [], chairmanModel: { provider: 'openai', model: 'x' } }, 't')).rejects.toMatchObject({
      code: 'FORBIDDEN',
    })
  })
})
