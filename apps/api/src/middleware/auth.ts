import { verifyToken } from '@clerk/backend'
import type { Context, MiddlewareHandler, Next } from 'hono'
import type { ApiVariables } from '../types.js'

export function createAuthMiddleware(clerkSecretKey: string, authorizedParties: string[]): MiddlewareHandler<{ Variables: ApiVariables }> {
  return async (c: Context<{ Variables: ApiVariables }>, next: Next) => {
    const rid = c.get('requestId')
    const authHeader = c.req.header('Authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return c.json(
        { error: { code: 'UNAUTHENTICATED', message: 'Missing authorization token', requestId: rid } },
        401,
      )
    }

    const token = authHeader.slice(7)
    try {
      const payload = await verifyToken(token, { secretKey: clerkSecretKey, authorizedParties })
      c.set('clerkUserId', payload.sub)
      await next()
    } catch {
      return c.json(
        { error: { code: 'UNAUTHENTICATED', message: 'Invalid or expired token', requestId: rid } },
        401,
      )
    }
  }
}
