import type { Context } from 'hono'
import type { ApiVariables } from '../types.js'

type AppContext = Context<{ Variables: ApiVariables }>

export interface ErrorLogRecord {
  ts: string
  level: 'error'
  msg: 'unhandled_error'
  requestId: string
  method: string
  path: string
  errorName: string
  errorMessage: string
  stack?: string
}

/**
 * App-level uncaught-exception boundary. Individual routes already return
 * typed { error: { code, message, requestId } } JSON for expected failures;
 * this catches the unexpected (thrown Errors, failed awaits) and guarantees
 * the client still gets that stable envelope — never an HTML stack trace.
 * The exception itself is logged with context; provider keys must never reach
 * here (they are function-scoped consts in services, never attached to errors).
 */
export function onErrorHandler(err: Error, c: AppContext): Response {
  let requestId = 'unknown'
  try {
    requestId = c.get('requestId')
  } catch {
    // Context unavailable this early — keep 'unknown' rather than throwing.
  }

  const record: ErrorLogRecord = {
    ts: new Date().toISOString(),
    level: 'error',
    msg: 'unhandled_error',
    requestId,
    method: c.req.method,
    path: c.req.path,
    errorName: err?.name ?? 'Error',
    errorMessage: err?.message ?? 'Unknown error',
  }
  if (err?.stack) record.stack = err.stack
  console.error(JSON.stringify(record))

  return c.json(
    {
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Internal server error',
        requestId,
      },
    },
    500,
  )
}

/** Unknown routes return the same stable JSON envelope (not Hono's default text). */
export function notFoundHandler(c: AppContext): Response {
  let requestId = 'unknown'
  try {
    requestId = c.get('requestId')
  } catch {
    // ignore
  }
  return c.json(
    {
      error: {
        code: 'NOT_FOUND',
        message: 'Not found',
        requestId,
      },
    },
    404,
  )
}
