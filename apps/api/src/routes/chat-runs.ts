import { Hono } from 'hono'
import { streamSSE } from 'hono/streaming'
import type { Db } from '@omnimind/db'
import { AuditLogRepository, ChatRunEventRepository } from '@omnimind/db'
import { createRunRequestSchema } from '@omnimind/types'
import type { ApiVariables } from '../types.js'
import { ChatRunService, ChatRunServiceError } from '../services/chat-run.service.js'
import type { RunCoordinator, AnyStreamEnvelope } from '../services/run-coordinator.js'

const TERMINAL_RUN_EVENTS = new Set(['run.completed', 'run.failed', 'run.cancelled'])

function isTerminal(eventType: string): boolean {
  return TERMINAL_RUN_EVENTS.has(eventType)
}

export function createChatRunsRouter(db: Db, encryptionSecret: string, coordinator: RunCoordinator) {
  const router = new Hono<{ Variables: ApiVariables }>()
  const service = new ChatRunService(db, encryptionSecret, coordinator)

  // POST /v1/chat/runs — create a run (role-gated; viewers cannot execute runs).
  router.post('/', async (c) => {
    const rid = c.get('requestId')

    if (c.get('userRole') === 'viewer') {
      return c.json(
        { error: { code: 'FORBIDDEN', message: 'Viewers cannot create chat runs', requestId: rid } },
        403,
      )
    }

    const body = await c.req.json().catch(() => null)
    const parsed = createRunRequestSchema.safeParse(body)
    if (!parsed.success) {
      return c.json(
        { error: { code: 'VALIDATION_ERROR', message: parsed.error.issues[0]?.message ?? 'Invalid request body', requestId: rid } },
        400,
      )
    }

    const idempotencyKey = c.req.header('Idempotency-Key') ?? undefined
    const workspaceId = c.get('workspaceId')
    const userId = c.get('userId')

    try {
      const result = await service.startRun({
        workspaceId,
        userId,
        conversationId: parsed.data.conversationId,
        input: parsed.data.input,
        models: parsed.data.models,
        ...(parsed.data.context !== undefined && { context: parsed.data.context }),
        ...(idempotencyKey !== undefined && { idempotencyKey }),
      })

      // Detached execution: never awaited here. executeRun is fully guarded and
      // does not reject, but attach a no-op catch so a future change can't crash
      // the process with an unhandled rejection.
      result.completion.catch(() => undefined)

      new AuditLogRepository(db)
        .create({
          workspaceId,
          userId,
          action: 'chat_run.created',
          resourceType: 'chat_run',
          resourceId: result.runId,
        })
        .catch(() => undefined)

      return c.json(
        {
          runId: result.runId,
          conversationId: result.conversationId,
          eventStreamUrl: `/v1/chat/runs/${result.runId}/events`,
        },
        result.existing ? 200 : 201,
      )
    } catch (err) {
      if (err instanceof ChatRunServiceError && err.code === 'CONVERSATION_NOT_FOUND') {
        return c.json({ error: { code: 'NOT_FOUND', message: err.message, requestId: rid } }, 404)
      }
      throw err
    }
  })

  // GET /v1/chat/runs/:runId/events — SSE: replay persisted events, then live.
  router.get('/:runId/events', async (c) => {
    const rid = c.get('requestId')
    const runId = c.req.param('runId')
    const workspaceId = c.get('workspaceId')

    try {
      await service.getRun({ runId, workspaceId })
    } catch (err) {
      if (err instanceof ChatRunServiceError) {
        return c.json({ error: { code: 'CHAT_RUN_NOT_FOUND', message: err.message, requestId: rid } }, 404)
      }
      throw err
    }

    const afterRaw = c.req.query('afterSequence')
    const afterParsed = afterRaw !== undefined ? Number.parseInt(afterRaw, 10) : NaN
    const afterSequence = Number.isFinite(afterParsed) && afterParsed >= 0 ? afterParsed : undefined

    const eventRepo = new ChatRunEventRepository(db)

    const res = streamSSE(c, async (stream) => {
      const queue: AnyStreamEnvelope[] = []
      let resolveNext: (() => void) | undefined
      const wake = () => {
        const r = resolveNext
        resolveNext = undefined
        r?.()
      }

      // Subscribe FIRST so live events emitted during replay are buffered and
      // deduped (by sequence) rather than lost — closes the create-then-subscribe gap.
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

      let lastSeq = afterSequence ?? 0
      const writeEnvelope = (env: AnyStreamEnvelope) =>
        stream.writeSSE({ event: env.type, data: JSON.stringify(env) })

      try {
        const persisted = await eventRepo.findByChatRun(runId, afterSequence)
        for (const row of persisted) {
          if (closed) break // client disconnected during replay
          const env: AnyStreamEnvelope =
            (row.payloadJson as AnyStreamEnvelope | null) ?? {
              type: row.eventType,
              runId,
              sequence: row.sequence,
              timestamp: row.createdAt.toISOString(),
              data: {},
            }
          await writeEnvelope(env)
          if (row.sequence > lastSeq) lastSeq = row.sequence
          if (isTerminal(row.eventType)) closed = true
        }

        while (!closed) {
          if (queue.length === 0) {
            // Nothing pending and no live emitter for this run on this instance:
            // either the run is orphaned (e.g. the API restarted mid-run and the
            // in-process coordinator state was lost) or it finished and every
            // event has been drained. Either way nothing more will arrive — close
            // rather than block forever on heartbeats. emit() publishes a run's
            // final event before finish() clears isActive, and the double-check
            // below catches a wakeup that races registration, so a true terminal
            // event is always queued before this branch is reached.
            if (!coordinator.isActive(runId)) break
            await new Promise<void>((resolve) => {
              resolveNext = resolve
              // Double-check to avoid a missed wakeup between the length check
              // and registering the resolver.
              if (queue.length > 0 || closed) {
                resolveNext = undefined
                resolve()
              }
            })
            continue
          }
          const env = queue.shift()!
          if (env.type === 'heartbeat') {
            await writeEnvelope(env)
            continue
          }
          if (env.sequence <= lastSeq) continue // already replayed
          await writeEnvelope(env)
          lastSeq = env.sequence
          if (isTerminal(env.type)) break
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

  // POST /v1/chat/runs/:runId/cancel
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
          action: 'chat_run.cancelled',
          resourceType: 'chat_run',
          resourceId: runId,
        })
        .catch(() => undefined)
      return c.json(result)
    } catch (err) {
      if (err instanceof ChatRunServiceError) {
        return c.json({ error: { code: 'CHAT_RUN_NOT_FOUND', message: err.message, requestId: rid } }, 404)
      }
      throw err
    }
  })

  // GET /v1/chat/runs/:runId — run detail + model runs
  router.get('/:runId', async (c) => {
    const rid = c.get('requestId')
    const runId = c.req.param('runId')
    const workspaceId = c.get('workspaceId')

    try {
      const { run, modelRuns } = await service.getRun({ runId, workspaceId })
      return c.json({ run, modelRuns })
    } catch (err) {
      if (err instanceof ChatRunServiceError) {
        return c.json({ error: { code: 'CHAT_RUN_NOT_FOUND', message: err.message, requestId: rid } }, 404)
      }
      throw err
    }
  })

  return router
}
