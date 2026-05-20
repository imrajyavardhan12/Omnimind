import type { MiddlewareHandler } from 'hono'
import type { ApiVariables } from '../types.js'

export const requestIdMiddleware: MiddlewareHandler<{ Variables: ApiVariables }> = async (c, next) => {
  const id = c.req.header('x-request-id') ?? crypto.randomUUID()
  c.set('requestId', id)
  c.header('x-request-id', id)
  await next()
}
