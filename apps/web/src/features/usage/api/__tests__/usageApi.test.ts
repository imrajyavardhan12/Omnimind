import { describe, it, expect, vi, beforeEach } from 'vitest'
import { formatUsd, usageApi } from '../usageApi'

const fetchMock = vi.fn()

describe('usageApi', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubGlobal('fetch', fetchMock)
  })

  it('getSummary calls the workspace-scoped endpoint with the bearer token', async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ totalCostUsd: '0.000000' }) })
    const res = await usageApi.getSummary('token-1')
    expect(res.totalCostUsd).toBe('0.000000')
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit & { headers: Headers }]
    expect(url).toContain('/v1/usage/summary')
    expect(init.headers.get('Authorization')).toBe('Bearer token-1')
  })

  it('getSummary forwards an explicit window as query params', async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({}) })
    await usageApi.getSummary('token-1', {
      from: '2026-09-01T00:00:00.000Z',
      to: '2026-09-10T00:00:00.000Z',
    })
    const [url] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(url).toContain('from=2026-09-01')
    expect(url).toContain('to=2026-09-10')
  })
})

describe('formatUsd', () => {
  it('trims ledger precision for display without float artifacts', () => {
    expect(formatUsd('0.000000')).toBe('$0')
    expect(formatUsd('0.030600')).toBe('$0.0306')
    expect(formatUsd('0.000020')).toBe('$0.00002')
    expect(formatUsd('12.500000')).toBe('$12.5')
  })

  it('never renders NaN', () => {
    expect(formatUsd('not-a-number')).toBe('—')
    expect(formatUsd('')).toBe('—')
  })
})
