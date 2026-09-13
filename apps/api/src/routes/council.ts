import { Hono } from 'hono'
import { streamSSE } from 'hono/streaming'
import type { Db } from '@omnimind/db'
import { AuditLogRepository } from '@omnimind/db'
import { createCouncilRunRequestSchema } from '@omnimind/types'
import type { CouncilRunStatus } from '@omnimind/types'
import type { ApiVariables } from '../types.js'
import { CouncilService, CouncilServiceError } from '../services/council.service.js'
import type { RunCoordinator, AnyStreamEnvelope } from '../services/run-coordinator.js'

const TERMINAL_COUNCIL_EVENTS = new Set(['council.completed', 'council.failed', 'council.cancelled'])

function terminalEnvelopeFor(status: CouncilRunStatus, runId: string): AnyStreamEnvelope {
  const envelope = (type: string, data: object): AnyStreamEnvelope => ({
    type,
    runId,
    sequence: 0,
    timestamp: new Date().toISOString(),
    data,
  })
  if (status === 'completed') return envelope('council.completed', {})
  if (status === 'failed') {
    return envelope('council.failed', {
      error: { code: 'COUNCIL_RUN_FAILED', message: 'Council run failed — see stage results for details' },
    })
  }
  return envelope('council.cancelled', {})
}

export function createCouncilRouter(db: Db, encryptionSecret: string, coordinator: RunCoordinator) {
  const router = new Hono<{ Variables: ApiVariables }>()
  const service = new CouncilService(db, encryptionSecret, coordinator)

  // POST /v1/council/runs — create a durable council workflow (viewers cannot execute).
  router.post('/', async (c) => {
    const rid = c.get('requestId')

    if (c.get('userRole') === 'viewer') {
      return c.json(
        { error: { code: 'FORBIDDEN', message: 'Viewers cannot create council runs', requestId: rid } },
        403,
      )
    }

    const body = await c.req.json().catch(() => null)
    const parsed = createCouncilRunRequestSchema.safeParse(body)
    if (!parsed.success) {
      return c.json(
        { error: { code: 'VALIDATION_ERROR', message: parsed.error.issues[0]?.message ?? 'Invalid request body', requestId: rid } },
        400,
      )
    }

    const workspaceId = c.get('workspaceId')
    const userId = c.get('userId')

    try {
      const result = await service.startRun({
        workspaceId,
        userId,
        query: parsed.data.query,
        councilModels: parsed.data.councilModels,
        chairmanModel: parsed.data.chairmanModel,
        ...(parsed.data.conversationId !== undefined && { conversationId: parsed.data.conversationId }),
      })

      // Detached execution: never awaited here. executeRun is fully guarded and
      // does not reject, but attach a no-op catch so a future change can't crash
      // the process with an unhandled rejection.
      result.completion.catch(() => undefined)

      new AuditLogRepository(db)
        .create({
          workspaceId,
          userId,
          action: 'council_run.created',
          resourceType: 'council_run',
          resourceId: result.runId,
        })
        .catch(() => undefined)

      return c.json({ runId: result.runId, eventStreamUrl: `/v1/council/runs/${result.runId}/events` }, 201)
    } catch (err) {
      if (err instanceof CouncilServiceError && err.code === 'CONVERSATION_NOT_FOUND') {
        return c.json({ error: { code: 'NOT_FOUND', message: err.message, requestId: rid } }, 404)
      }
      throw err
    }
  })

  // GET /v1/council/runs/:runId — run detail + durable stage results.
  // This (not the stream) is the source of truth for state and reconnects:
  // council SSE is live-only because stage rows — not an event log — are the
  // durable record (see 10-data-model.md; there is no council events table).
  router.get('/:runId', async (c) => {
    const rid = c.get('requestId')
    const runId = c.req.param('runId')
    const workspaceId = c.get('workspaceId')

    try {
      const { run, stageResults } = await service.getRun({ runId, workspaceId })
      return c.json({ run, stageResults })
    } catch (err) {
      if (err instanceof CouncilServiceError) {
        return c.json({ error: { code: 'COUNCIL_RUN_NOT_FOUND', message: err.message, requestId: rid } }, 404)
      }
      throw err
    }
  })

  // GET /v1/council/runs/:runId/events — live-only SSE (no replay).
  router.get('/:runId/events', async (c) => {
    const rid = c.get('requestId')
    const runId = c.req.param('runId')
    const workspaceId = c.get('workspaceId')

    if (c.req.query('afterSequence') !== undefined) {
      return c.json(
        {
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Event replay is not supported for council runs; refetch GET /v1/council/runs/:runId for state',
            requestId: rid,
          },
        },
        400,
      )
    }

    let status: CouncilRunStatus
    try {
      const { run } = await service.getRun({ runId, workspaceId })
      status = run.status
    } catch (err) {
      if (err instanceof CouncilServiceError) {
        return c.json({ error: { code: 'COUNCIL_RUN_NOT_FOUND', message: err.message, requestId: rid } }, 404)
      }
      throw err
    }

    const res = streamSSE(c, async (stream) => {
      // Already terminal: deliver the terminal event once so late subscribers
      // never hang, then close. Fresh state comes from GET detail.
      if (status === 'completed' || status === 'failed' || status === 'cancelled') {
        await stream.writeSSE({
          event: terminalEnvelopeFor(status, runId).type,
          data: JSON.stringify(terminalEnvelopeFor(status, runId)),
        })
        return
      }

      const queue: AnyStreamEnvelope[] = []
      let resolveNext: (() => void) | undefined
      const wake = () => {
        const r = resolveNext
        resolveNext = undefined
        r?.()
      }

      const unsub = coordinator.subscribe(runId, (env) => {
        queue.push(env)
        wake()
      })

      let closed = false
      stream.onAbort(() => {
        closed = true
        wake()
      })

      const heartbeat = setInterval(() => {
        queue.push({ type: 'heartbeat', runId, sequence: 0, timestamp: new Date().toISOString(), data: {} })
        wake()
      }, 20_000)

      try {
        while (!closed) {
          if (queue.length === 0) {
            // Nothing pending and no live emitter for this run on this instance
            // (orphaned by a restart, or drained after terminal): close rather
            // than block forever. Subscribers recover state from GET detail.
            if (!coordinator.isActive(runId)) break
            await new Promise<void>((resolve) => {
              resolveNext = resolve
              if (queue.length > 0 || closed) {
                resolveNext = undefined
                resolve()
              }
            })
            continue
          }
          const env = queue.shift()!
          await stream.writeSSE({ event: env.type, data: JSON.stringify(env) })
          if (TERMINAL_COUNCIL_EVENTS.has(env.type)) break
        }
      } finally {
        clearInterval(heartbeat)
        unsub()
      }
    })

    res.headers.set('Cache-Control', 'no-cache, no-transform')
    res.headers.set('X-Accel-Buffering', 'no')
    return res
  })

  // POST /v1/council/runs/:runId/cancel
  router.post('/:runId/cancel', async (c) => {
    const rid = c.get('requestId')
    const runId = c.req.param('runId')
    const workspaceId = c.get('workspaceId')

    try {
      const result = await service.cancelRun({ runId, workspaceId })
      new AuditLogRepository(db)
        .create({
          workspaceId,
          userId: c.get('userId'),
          action: 'council_run.cancelled',
          resourceType: 'council_run',
          resourceId: runId,
        })
        .catch(() => undefined)
      return c.json(result)
    } catch (err) {
      if (err instanceof CouncilServiceError) {
        return c.json({ error: { code: 'COUNCIL_RUN_NOT_FOUND', message: err.message, requestId: rid } }, 404)
      }
      throw err
    }
  })

  return router
}
