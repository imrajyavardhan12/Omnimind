import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { Hono } from 'hono'
import { notFoundHandler, onErrorHandler } from '../error-response.js'
import type { ApiVariables } from '../../types.js'

function buildApp() {
  const app = new Hono<{ Variables: ApiVariables }>()
  app.use('*', async (c, next) => {
    c.set('requestId', 'req-test-9')
    await next()
  })
  app.onError(onErrorHandler)
  app.notFound(notFoundHandler)
  app.get('/ok', (c) => c.json({ ok: true }))
  app.get('/throw', () => {
    throw new Error('database exploded')
  })
  return app
}

describe('app error boundary', () => {
  let errorSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined)
  })

  afterEach(() => {
    errorSpy.mockRestore()
  })

  it('leaves healthy routes untouched', async () => {
    const res = await buildApp().request('/ok')
    expect(res.status).toBe(200)
    expect(errorSpy).not.toHaveBeenCalled()
  })

  it('converts a thrown error into a stable 500 JSON envelope', async () => {
    const res = await buildApp().request('/throw')
    expect(res.status).toBe(500)
    const body = await res.json()
    expect(body).toEqual({
      error: { code: 'INTERNAL_ERROR', message: 'Internal server error', requestId: 'req-test-9' },
    })
  })

  it('logs the exception server-side with context, without leaking it to the client', async () => {
    await buildApp().request('/throw')
    expect(errorSpy).toHaveBeenCalledTimes(1)
    const record = JSON.parse(errorSpy.mock.calls[0]![0] as string)
    expect(record).toMatchObject({
      level: 'error',
      msg: 'unhandled_error',
      requestId: 'req-test-9',
      method: 'GET',
      path: '/throw',
      errorName: 'Error',
      errorMessage: 'database exploded',
    })
  })

  it('returns a stable 404 JSON envelope for unknown routes', async () => {
    const res = await buildApp().request('/nope')
    expect(res.status).toBe(404)
    const body = await res.json()
    expect(body).toEqual({
      error: { code: 'NOT_FOUND', message: 'Not found', requestId: 'req-test-9' },
    })
  })
})
