import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Hono } from 'hono'
import type { ApiVariables } from '../../types.js'

const mockStartRun = vi.fn()
const mockGetRun = vi.fn()
const mockCancelRun = vi.fn()
const mockAuditCreate = vi.fn().mockResolvedValue(undefined)
const mockEventFindByChatRun = vi.fn().mockResolvedValue([])

vi.mock('../../services/chat-run.service.js', async (importOriginal) => {
  const original = await importOriginal<typeof import('../../services/chat-run.service.js')>()
  return {
    ...original,
    ChatRunService: class {
      startRun = mockStartRun
      getRun = mockGetRun
      cancelRun = mockCancelRun
    },
  }
})

vi.mock('@omnimind/db', async (importOriginal) => {
  const original = await importOriginal<typeof import('@omnimind/db')>()
  return {
    ...original,
    AuditLogRepository: class {
      create = mockAuditCreate
    },
    ChatRunEventRepository: class {
      findByChatRun = mockEventFindByChatRun
    },
  }
})

const { createChatRunsRouter } = await import('../chat-runs.js')
const { ChatRunServiceError } = await import('../../services/chat-run.service.js')
const { RunCoordinator } = await import('../../services/run-coordinator.js')

const FAKE_DB = {} as never
const FAKE_SECRET = 'a'.repeat(64)

function buildAppWith(coordinator: InstanceType<typeof RunCoordinator>, role: ApiVariables['userRole'] = 'member') {
  const app = new Hono<{ Variables: ApiVariables }>()
  app.use('*', async (c, next) => {
    c.set('requestId', 'req-test-1')
    c.set('clerkUserId', 'clerk_1')
    c.set('userId', 'user_1')
    c.set('workspaceId', 'ws_1')
    c.set('userRole', role)
    await next()
  })
  app.route('/chat/runs', createChatRunsRouter(FAKE_DB, FAKE_SECRET, coordinator))
  return app
}

function buildApp(role: ApiVariables['userRole'] = 'member') {
  return buildAppWith(new RunCoordinator(), role)
}

const VALID_BODY = {
  conversationId: '11111111-1111-1111-1111-111111111111',
  input: { text: 'hi' },
  models: [{ provider: 'openai', model: 'gpt-4o' }],
}

function postRun(app: Hono<{ Variables: ApiVariables }>, body: unknown, headers: Record<string, string> = {}) {
  return app.request('/chat/runs', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify(body),
  })
}

async function readSSEEvents(res: Response): Promise<Array<{ event: string; data: string }>> {
  const text = await res.text()
  const events: Array<{ event: string; data: string }> = []
  for (const block of text.split('\n\n').filter(Boolean)) {
    let event = ''
    let data = ''
    for (const line of block.split('\n')) {
      if (line.startsWith('event: ')) event = line.slice(7)
      if (line.startsWith('data: ')) data = line.slice(6)
    }
    if (event || data) events.push({ event, data })
  }
  return events
}

describe('chat-runs routes', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockAuditCreate.mockResolvedValue(undefined)
    mockEventFindByChatRun.mockResolvedValue([])
  })

  describe('POST /chat/runs', () => {
    it('returns 400 on invalid body', async () => {
      const res = await postRun(buildApp(), { input: { text: 'hi' } })
      expect(res.status).toBe(400)
      expect((await res.json()).error.code).toBe('VALIDATION_ERROR')
      expect(mockStartRun).not.toHaveBeenCalled()
    })

    it('returns 403 for viewers', async () => {
      const res = await postRun(buildApp('viewer'), VALID_BODY)
      expect(res.status).toBe(403)
      expect((await res.json()).error.code).toBe('FORBIDDEN')
      expect(mockStartRun).not.toHaveBeenCalled()
    })

    it('creates a run and returns the event stream url', async () => {
      mockStartRun.mockResolvedValue({
        runId: 'run-1',
        conversationId: 'conv-1',
        existing: false,
        completion: Promise.resolve(),
      })
      const res = await postRun(buildApp(), VALID_BODY)
      expect(res.status).toBe(201)
      const body = await res.json()
      expect(body.runId).toBe('run-1')
      expect(body.eventStreamUrl).toBe('/v1/chat/runs/run-1/events')
      expect(mockAuditCreate).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'chat_run.created', resourceId: 'run-1' }),
      )
    })

    it('returns 200 when an existing run is deduped', async () => {
      mockStartRun.mockResolvedValue({
        runId: 'run-existing',
        conversationId: 'conv-1',
        existing: true,
        completion: Promise.resolve(),
      })
      const res = await postRun(buildApp(), VALID_BODY, { 'Idempotency-Key': 'idem-1' })
      expect(res.status).toBe(200)
      expect((await res.json()).runId).toBe('run-existing')
    })

    it('returns 404 when the conversation is not found', async () => {
      mockStartRun.mockRejectedValue(new ChatRunServiceError('CONVERSATION_NOT_FOUND', 'Conversation not found'))
      const res = await postRun(buildApp(), VALID_BODY)
      expect(res.status).toBe(404)
      expect((await res.json()).error.code).toBe('NOT_FOUND')
    })
  })

  describe('GET /chat/runs/:runId/events', () => {
    it('replays persisted events for a terminal run', async () => {
      mockGetRun.mockResolvedValue({ run: { id: 'run-1' }, modelRuns: [] })
      mockEventFindByChatRun.mockResolvedValue([
        {
          eventType: 'run.started',
          sequence: 1,
          payloadJson: { type: 'run.started', runId: 'run-1', sequence: 1, timestamp: 't', data: { conversationId: 'c' } },
          createdAt: new Date(),
        },
        {
          eventType: 'run.completed',
          sequence: 2,
          payloadJson: { type: 'run.completed', runId: 'run-1', sequence: 2, timestamp: 't', data: {} },
          createdAt: new Date(),
        },
      ])

      const res = await buildApp().request('/chat/runs/run-1/events')
      expect(res.status).toBe(200)
      expect(res.headers.get('content-type')).toBe('text/event-stream')
      const events = await readSSEEvents(res)
      expect(events.map((e) => e.event)).toEqual(['run.started', 'run.completed'])
    })

    it('passes afterSequence to the event query', async () => {
      mockGetRun.mockResolvedValue({ run: { id: 'run-1' }, modelRuns: [] })
      mockEventFindByChatRun.mockResolvedValue([
        {
          eventType: 'run.completed',
          sequence: 5,
          payloadJson: { type: 'run.completed', runId: 'run-1', sequence: 5, timestamp: 't', data: {} },
          createdAt: new Date(),
        },
      ])
      await readSSEEvents(await buildApp().request('/chat/runs/run-1/events?afterSequence=4'))
      expect(mockEventFindByChatRun).toHaveBeenCalledWith('run-1', 4)
    })

    it('returns 404 when the run is not found', async () => {
      mockGetRun.mockRejectedValue(new ChatRunServiceError('CHAT_RUN_NOT_FOUND', 'Chat run not found'))
      const res = await buildApp().request('/chat/runs/missing/events')
      expect(res.status).toBe(404)
      expect((await res.json()).error.code).toBe('CHAT_RUN_NOT_FOUND')
    })

    it('streams live events for an active (non-terminal) run and dedupes against replay', async () => {
      // Active run: only run.started persisted (non-terminal), so the live loop runs.
      mockGetRun.mockResolvedValue({ run: { id: 'run-1', status: 'running' }, modelRuns: [] })
      const coordinator = new RunCoordinator()

      // The route subscribes synchronously before awaiting the replay query. We
      // publish live events as a side effect of the replay await so they land in
      // the subscriber queue: seq 1 (dup of replay, must be deduped), seq 2
      // (delta), seq 3 (terminal, ends the stream).
      mockEventFindByChatRun.mockImplementation(async () => {
        coordinator.publish('run-1', { type: 'run.started', runId: 'run-1', sequence: 1, timestamp: 't', data: { conversationId: 'c' } })
        coordinator.publish('run-1', { type: 'model.delta', runId: 'run-1', sequence: 2, timestamp: 't', data: { modelRunId: 'mr', text: 'hi' } })
        coordinator.publish('run-1', { type: 'run.completed', runId: 'run-1', sequence: 3, timestamp: 't', data: {} })
        return [
          {
            eventType: 'run.started',
            sequence: 1,
            payloadJson: { type: 'run.started', runId: 'run-1', sequence: 1, timestamp: 't', data: { conversationId: 'c' } },
            createdAt: new Date(),
          },
        ]
      })

      const res = await buildAppWith(coordinator).request('/chat/runs/run-1/events')
      expect(res.status).toBe(200)
      const events = await readSSEEvents(res)
      // replayed run.started (seq 1) once, then live delta (seq 2) + completed (seq 3).
      // The live seq-1 republish is deduped (sequence <= lastSeq).
      const nonHeartbeat = events.filter((e) => e.event !== 'heartbeat')
      expect(nonHeartbeat.map((e) => e.event)).toEqual(['run.started', 'model.delta', 'run.completed'])
      const seqs = nonHeartbeat.map((e) => JSON.parse(e.data).sequence)
      expect(seqs).toEqual([1, 2, 3])
    })

    it('closes (does not hang) for an orphaned run with no live emitter and no terminal event', async () => {
      // Run looks 'running' in the DB but the coordinator has no emitter for it
      // (e.g. the API restarted mid-run). Replay yields only non-terminal events.
      // Without the isActive guard the stream would block forever on heartbeats.
      mockGetRun.mockResolvedValue({ run: { id: 'run-1', status: 'running' }, modelRuns: [] })
      mockEventFindByChatRun.mockResolvedValue([
        {
          eventType: 'run.started',
          sequence: 1,
          payloadJson: { type: 'run.started', runId: 'run-1', sequence: 1, timestamp: 't', data: { conversationId: 'c' } },
          createdAt: new Date(),
        },
        {
          eventType: 'model.started',
          sequence: 2,
          payloadJson: { type: 'model.started', runId: 'run-1', sequence: 2, timestamp: 't', data: { modelRunId: 'mr', provider: 'openai', model: 'gpt-4o' } },
          createdAt: new Date(),
        },
      ])

      // A fresh coordinator with no registered run => isActive('run-1') === false.
      const res = await buildAppWith(new RunCoordinator()).request('/chat/runs/run-1/events')
      expect(res.status).toBe(200)
      const events = await readSSEEvents(res)
      const nonHeartbeat = events.filter((e) => e.event !== 'heartbeat')
      expect(nonHeartbeat.map((e) => e.event)).toEqual(['run.started', 'model.started'])
    })
  })

  describe('POST /chat/runs/:runId/cancel', () => {
    it('cancels a run', async () => {
      mockCancelRun.mockResolvedValue({ status: 'cancelled' })
      const res = await buildApp().request('/chat/runs/run-1/cancel', { method: 'POST' })
      expect(res.status).toBe(200)
      expect((await res.json()).status).toBe('cancelled')
      expect(mockAuditCreate).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'chat_run.cancelled', resourceId: 'run-1' }),
      )
    })

    it('returns 404 for an unknown run', async () => {
      mockCancelRun.mockRejectedValue(new ChatRunServiceError('CHAT_RUN_NOT_FOUND', 'nope'))
      const res = await buildApp().request('/chat/runs/missing/cancel', { method: 'POST' })
      expect(res.status).toBe(404)
    })
  })

  describe('GET /chat/runs/:runId', () => {
    it('returns the run and its model runs', async () => {
      mockGetRun.mockResolvedValue({ run: { id: 'run-1', status: 'completed' }, modelRuns: [{ id: 'mr-1' }] })
      const res = await buildApp().request('/chat/runs/run-1')
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.run.id).toBe('run-1')
      expect(body.modelRuns).toHaveLength(1)
    })

    it('returns 404 for an unknown run', async () => {
      mockGetRun.mockRejectedValue(new ChatRunServiceError('CHAT_RUN_NOT_FOUND', 'nope'))
      const res = await buildApp().request('/chat/runs/missing')
      expect(res.status).toBe(404)
    })
  })
})
