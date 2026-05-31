import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { chatApi } from '../chatApi'
import type { CreateRunRequest } from '@omnimind/types'

const BASE = 'http://localhost:3001'

type FetchArgs = { url: string; init: RequestInit }

function stubFetch(response: Response): { calls: FetchArgs[] } {
  const calls: FetchArgs[] = []
  vi.stubGlobal(
    'fetch',
    vi.fn((url: string, init: RequestInit = {}) => {
      calls.push({ url, init })
      return Promise.resolve(response)
    }),
  )
  return { calls }
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
}

function headerValue(init: RequestInit, name: string): string | null {
  return new Headers(init.headers).get(name)
}

beforeEach(() => {
  vi.unstubAllGlobals()
})
afterEach(() => {
  vi.unstubAllGlobals()
})

const sampleInput: CreateRunRequest = {
  conversationId: '11111111-1111-1111-1111-111111111111',
  input: { text: 'hello' },
  models: [{ provider: 'openai', model: 'gpt-4o' }],
}

describe('chatApi.createRun', () => {
  it('POSTs the run with the Idempotency-Key HEADER, bearer token, and JSON body', async () => {
    const { calls } = stubFetch(
      jsonResponse({ runId: 'r1', conversationId: sampleInput.conversationId, eventStreamUrl: '/v1/chat/runs/r1/events' }),
    )

    const res = await chatApi.createRun(sampleInput, 'idem-key-1', 'tok-abc')

    expect(calls).toHaveLength(1)
    const { url, init } = calls[0]!
    expect(url).toBe(`${BASE}/v1/chat/runs`)
    expect(init.method).toBe('POST')
    expect(headerValue(init, 'Idempotency-Key')).toBe('idem-key-1')
    expect(headerValue(init, 'Authorization')).toBe('Bearer tok-abc')
    expect(headerValue(init, 'Content-Type')).toBe('application/json')
    expect(JSON.parse(init.body as string)).toEqual(sampleInput)
    // Idempotency-Key must NOT leak into the body.
    expect(JSON.parse(init.body as string)).not.toHaveProperty('idempotencyKey')
    expect(res.runId).toBe('r1')
  })

  it('throws an ApiError carrying the backend error code on non-2xx', async () => {
    stubFetch(jsonResponse({ error: { code: 'FORBIDDEN', message: 'Viewers cannot create chat runs' } }, 403))
    await expect(chatApi.createRun(sampleInput, 'k', 't')).rejects.toMatchObject({ code: 'FORBIDDEN', status: 403 })
  })
})

describe('chatApi.openEventStream', () => {
  it('GETs the events URL with the bearer token and no afterSequence by default', async () => {
    const { calls } = stubFetch(new Response('', { status: 200 }))
    await chatApi.openEventStream('r1', 'tok')
    const { url, init } = calls[0]!
    expect(url).toBe(`${BASE}/v1/chat/runs/r1/events`)
    expect(init.method).toBe('GET')
    expect(headerValue(init, 'Authorization')).toBe('Bearer tok')
  })

  it('appends ?afterSequence=N for reconnect', async () => {
    const { calls } = stubFetch(new Response('', { status: 200 }))
    await chatApi.openEventStream('r1', 'tok', { afterSequence: 42 })
    expect(calls[0]!.url).toBe(`${BASE}/v1/chat/runs/r1/events?afterSequence=42`)
  })
})

describe('chatApi.cancelRun', () => {
  it('POSTs to the cancel endpoint and returns the status', async () => {
    const { calls } = stubFetch(jsonResponse({ status: 'cancelled' }))
    const res = await chatApi.cancelRun('r1', 'tok')
    expect(calls[0]!.url).toBe(`${BASE}/v1/chat/runs/r1/cancel`)
    expect(calls[0]!.init.method).toBe('POST')
    expect(res.status).toBe('cancelled')
  })
})

describe('chatApi.getRun', () => {
  it('GETs run detail (run + modelRuns)', async () => {
    const { calls } = stubFetch(jsonResponse({ run: { id: 'r1' }, modelRuns: [{ id: 'm1', outputMessageId: 'msg-1' }] }))
    const res = await chatApi.getRun('r1', 'tok')
    expect(calls[0]!.url).toBe(`${BASE}/v1/chat/runs/r1`)
    expect(calls[0]!.init.method ?? 'GET').toBe('GET')
    expect(res.modelRuns[0]!.outputMessageId).toBe('msg-1')
  })
})
