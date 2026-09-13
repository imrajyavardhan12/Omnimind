import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { Hono } from 'hono'
import { requestLoggerMiddleware, serializeRequestLog } from '../request-logger.js'
import type { ApiVariables } from '../../types.js'

describe('serializeRequestLog', () => {
  it('emits the narrow allowlisted shape', () => {
    const record = serializeRequestLog({
      requestId: 'req-1',
      method: 'POST',
      path: '/v1/chat/runs',
      status: 201,
      latencyMs: 42,
      userId: 'u-1',
      workspaceId: 'ws-1',
    })
    expect(record).toMatchObject({
      level: 'info',
      msg: 'http_request',
      requestId: 'req-1',
      method: 'POST',
      path: '/v1/chat/runs',
      status: 201,
      latencyMs: 42,
      userId: 'u-1',
      workspaceId: 'ws-1',
    })
    // Redaction contract: no headers, no query, no body — ever.
    expect(record).not.toHaveProperty('headers')
    expect(record).not.toHaveProperty('query')
    expect(record).not.toHaveProperty('body')
    expect(record).not.toHaveProperty('authorization')
  })

  it('omits user/workspace ids when auth has not run (public routes)', () => {
    const record = serializeRequestLog({
      requestId: 'req-1',
      method: 'GET',
      path: '/health',
      status: 200,
      latencyMs: 1,
    })
    expect(record).not.toHaveProperty('userId')
    expect(record).not.toHaveProperty('workspaceId')
  })
})

describe('requestLoggerMiddleware', () => {
  let logSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined)
  })

  afterEach(() => {
    logSpy.mockRestore()
  })

  function buildApp(withIdentity = false) {
    const app = new Hono<{ Variables: ApiVariables }>()
    app.use('*', async (c, next) => {
      c.set('requestId', 'req-test-1')
      if (withIdentity) {
        c.set('userId', 'user_1')
        c.set('workspaceId', 'ws_1')
      }
      await next()
    })
    app.use('*', requestLoggerMiddleware)
    app.get('/things', (c) => c.json({ ok: true }))
    app.get('/boom', () => {
      throw new Error('handler blew up')
    })
    return app
  }

  it('logs one JSON line with method/path/status/latency/requestId', async () => {
    const res = await buildApp().request('/things')
    expect(res.status).toBe(200)
    expect(logSpy).toHaveBeenCalledTimes(1)
    const line = logSpy.mock.calls[0]![0] as string
    const record = JSON.parse(line)
    expect(record).toMatchObject({
      level: 'info',
      msg: 'http_request',
      requestId: 'req-test-1',
      method: 'GET',
      path: '/things',
      status: 200,
    })
    expect(typeof record.latencyMs).toBe('number')
    expect(record).not.toHaveProperty('userId')
  })

  it('strips query strings (tokens must never reach logs)', async () => {
    await buildApp().request('/things?token=secret&next=/x')
    const record = JSON.parse(logSpy.mock.calls[0]![0] as string)
    expect(record.path).toBe('/things')
    expect(JSON.stringify(record)).not.toContain('secret')
  })

  it('includes identity when auth already ran', async () => {
    await buildApp(true).request('/things')
    const record = JSON.parse(logSpy.mock.calls[0]![0] as string)
    expect(record).toMatchObject({ userId: 'user_1', workspaceId: 'ws_1' })
  })

  it('never logs request headers (Authorization)', async () => {
    await buildApp().request('/things', { headers: { Authorization: 'Bearer sk-live-123' } })
    expect(JSON.stringify(logSpy.mock.calls[0]![0])).not.toContain('sk-live-123')
  })
})
