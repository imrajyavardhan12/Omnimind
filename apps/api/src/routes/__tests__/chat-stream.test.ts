import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Hono } from 'hono'
import type { GatewayStreamChunk } from '@omnimind/types'
import type { ApiVariables } from '../../types.js'

const mockFindEncrypted = vi.fn()
const mockAuditCreate = vi.fn().mockResolvedValue(undefined)
const mockGatewayStream = vi.fn()

vi.mock('@omnimind/ai', () => ({
  LLMGateway: class {
    stream = mockGatewayStream
  },
}))

vi.mock('@omnimind/db', async (importOriginal) => {
  const original = await importOriginal<typeof import('@omnimind/db')>()
  return {
    ...original,
    ProviderKeyRepository: class {
      findEncrypted = mockFindEncrypted
    },
    AuditLogRepository: class {
      create = mockAuditCreate
    },
    ModelCatalogService: class {},
  }
})

const mockDecrypt = vi.fn().mockReturnValue('sk-decrypted-test-key')
vi.mock('../../lib/encryption.js', () => ({
  decryptProviderKey: mockDecrypt,
}))

const { createChatStreamRouter } = await import('../chat-stream.js')

const FAKE_DB = {} as any
const FAKE_SECRET = 'a'.repeat(64)

function buildApp() {
  const app = new Hono<{ Variables: ApiVariables }>()
  app.use('*', async (c, next) => {
    c.set('requestId', 'req-test-123')
    c.set('clerkUserId', 'clerk_user_1')
    c.set('userId', 'user_1')
    c.set('workspaceId', 'ws_1')
    c.set('userRole', 'owner')
    await next()
  })
  app.route('/chat/stream', createChatStreamRouter(FAKE_DB, FAKE_SECRET))
  return app
}

const VALID_BODY = {
  provider: 'openai',
  model: 'gpt-4o',
  messages: [{ role: 'user', content: 'hi' }],
}

function post(app: Hono<{ Variables: ApiVariables }>, body: unknown, signal?: AbortSignal) {
  return app.request('/chat/stream', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal,
  })
}

async function readSSEEvents(res: Response): Promise<Array<{ event: string; data: string }>> {
  const text = await res.text()
  const events: Array<{ event: string; data: string }> = []
  const blocks = text.split('\n\n').filter(Boolean)
  for (const block of blocks) {
    const lines = block.split('\n')
    let event = ''
    let data = ''
    for (const line of lines) {
      if (line.startsWith('event: ')) event = line.slice(7)
      if (line.startsWith('data: ')) data = line.slice(6)
    }
    if (event || data) events.push({ event, data })
  }
  return events
}

function fixtureChunks(chunks: GatewayStreamChunk[]) {
  mockGatewayStream.mockImplementation(async function* () {
    for (const chunk of chunks) {
      yield chunk
    }
  })
}

describe('POST /chat/stream', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockAuditCreate.mockResolvedValue(undefined)
  })

  it('returns 400 on invalid body', async () => {
    const app = buildApp()
    const res = await post(app, { provider: 'openai' })
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error.code).toBe('VALIDATION_ERROR')
    expect(body.error.requestId).toBe('req-test-123')
  })

  it('returns 400 on empty body', async () => {
    const app = buildApp()
    const res = await post(app, {})
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error.code).toBe('VALIDATION_ERROR')
  })

  it('returns 400 with PROVIDER_KEY_MISSING when no key row exists', async () => {
    mockFindEncrypted.mockResolvedValue(undefined)
    const app = buildApp()
    const res = await post(app, VALID_BODY)
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error.code).toBe('PROVIDER_KEY_MISSING')
    expect(body.error.requestId).toBe('req-test-123')
  })

  it('returns 200 with Content-Type text/event-stream on happy path', async () => {
    mockFindEncrypted.mockResolvedValue({ encryptedKey: 'enc-key-base64' })
    fixtureChunks([
      { type: 'delta', delta: 'Hello' },
      { type: 'delta', delta: ' world' },
      { type: 'done', finishReason: 'stop', usage: { inputTokens: 5, outputTokens: 2, totalTokens: 7 } },
    ])
    const app = buildApp()
    const res = await post(app, VALID_BODY)
    expect(res.status).toBe(200)
    expect(res.headers.get('content-type')).toBe('text/event-stream')
    expect(res.headers.get('cache-control')).toBe('no-cache, no-transform')
    expect(res.headers.get('x-accel-buffering')).toBe('no')

    const events = await readSSEEvents(res)
    expect(events).toHaveLength(3)
    expect(events[0]!.event).toBe('delta')
    expect(JSON.parse(events[0]!.data)).toEqual({ type: 'delta', delta: 'Hello' })
    expect(events[1]!.event).toBe('delta')
    expect(events[2]!.event).toBe('done')
    const doneData = JSON.parse(events[2]!.data)
    expect(doneData.usage.totalTokens).toBe(7)
  })

  it('surfaces gateway error chunks as SSE error events', async () => {
    mockFindEncrypted.mockResolvedValue({ encryptedKey: 'enc-key-base64' })
    fixtureChunks([
      { type: 'error', error: { code: 'MODEL_NOT_FOUND', message: 'Unknown model', retryable: false } },
    ])
    const app = buildApp()
    const res = await post(app, VALID_BODY)
    expect(res.status).toBe(200)
    const events = await readSSEEvents(res)
    expect(events).toHaveLength(1)
    expect(events[0]!.event).toBe('error')
    const data = JSON.parse(events[0]!.data)
    expect(data.error.code).toBe('MODEL_NOT_FOUND')
  })

  it('threads AbortSignal into gateway.stream()', async () => {
    mockFindEncrypted.mockResolvedValue({ encryptedKey: 'enc-key-base64' })
    let capturedSignal: AbortSignal | undefined
    mockGatewayStream.mockImplementation(async function* (req: any) {
      capturedSignal = req.abortSignal
      yield { type: 'done' } as GatewayStreamChunk
    })

    const app = buildApp()
    await post(app, VALID_BODY)
    expect(capturedSignal).toBeDefined()
  })

  it('writes an audit log entry on stream open', async () => {
    mockFindEncrypted.mockResolvedValue({ encryptedKey: 'enc-key-base64' })
    fixtureChunks([{ type: 'done' }])
    const app = buildApp()
    await post(app, VALID_BODY)

    expect(mockAuditCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        workspaceId: 'ws_1',
        userId: 'user_1',
        action: 'chat.stream.requested',
        resourceType: 'chat_stream',
        resourceId: 'req-test-123',
      }),
    )
  })

  it('returns 500 with PROVIDER_KEY_INVALID when decryption fails', async () => {
    mockFindEncrypted.mockResolvedValue({ encryptedKey: 'corrupted-data' })
    mockDecrypt.mockImplementation(() => { throw new Error('GCM auth tag mismatch') })
    const app = buildApp()
    const res = await post(app, VALID_BODY)
    expect(res.status).toBe(500)
    const body = await res.json()
    expect(body.error.code).toBe('PROVIDER_KEY_INVALID')
    expect(body.error.requestId).toBe('req-test-123')
  })
})
