import type { Context, MiddlewareHandler } from 'hono'
import type { ApiVariables } from '../types.js'

/**
 * Request log record. Deliberately narrow: method + path + outcome + ids.
 * NEVER includes query strings (may carry tokens), headers (Authorization),
 * or bodies (prompts, keys). See docs/architecture/14-security.md logging
 * redaction and 16-observability.md structured logging.
 */
export interface RequestLogRecord {
  ts: string
  level: 'info'
  msg: 'http_request'
  requestId: string
  method: string
  /** Route path only — c.req.path excludes the query string by construction. */
  path: string
  status: number
  latencyMs: number
  userId?: string
  workspaceId?: string
}

type Variables = { Variables: ApiVariables }

/** Pure serializer so the redaction contract is unit-testable without HTTP. */
export function serializeRequestLog(args: {
  requestId: string
  method: string
  path: string
  status: number
  latencyMs: number
  userId?: string
  workspaceId?: string
}): RequestLogRecord {
  const record: RequestLogRecord = {
    ts: new Date().toISOString(),
    level: 'info',
    msg: 'http_request',
    requestId: args.requestId,
    method: args.method,
    path: args.path,
    status: args.status,
    latencyMs: args.latencyMs,
  }
  if (args.userId !== undefined) record.userId = args.userId
  if (args.workspaceId !== undefined) record.workspaceId = args.workspaceId
  return record
}

/** Best-effort context read: auth hasn't run for public routes (/health). */
function maybeGet(c: Context<Variables>, key: 'userId' | 'workspaceId'): string | undefined {
  try {
    const value = c.get(key)
    return typeof value === 'string' ? value : undefined
  } catch {
    return undefined
  }
}

/**
 * Structured access logging. Must run AFTER requestIdMiddleware (needs the
 * request id) and BEFORE route handlers so the post-next() timing covers the
 * full handler. Emits one JSON line per request to stdout (Axiom-shippable);
 * failures to log must never fail the request.
 */
export const requestLoggerMiddleware: MiddlewareHandler<Variables> = async (c, next) => {
  const startedAt = Date.now()
  await next()
  try {
    const record = serializeRequestLog({
      requestId: c.get('requestId'),
      method: c.req.method,
      path: c.req.path,
      status: c.res.status,
      latencyMs: Date.now() - startedAt,
      userId: maybeGet(c, 'userId'),
      workspaceId: maybeGet(c, 'workspaceId'),
    })
    console.log(JSON.stringify(record))
  } catch {
    // Logging is observability, not control flow. Swallow everything.
  }
}
